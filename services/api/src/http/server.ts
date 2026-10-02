/**
 * The HTTP API (decision 0005): Fastify, with request and response shapes from @docsmart/schemas and
 * the OpenAPI document generated from them at /openapi.json. Every route but /health and
 * /openapi.json needs a bearer token; every change runs in one transaction for the caller's tenant.
 */
import { randomUUID } from 'node:crypto';
import { type AssemblyRefused, assemble, type FieldCatalogue } from '@docsmart/assembly';
import type { DocumentLifecycle } from '@docsmart/domain';
import { getEvidence, type ObjectStore, setPolicy } from '@docsmart/platform';
import {
  AssembledVersion,
  AssembleRequest,
  CreateDocument,
  DispositionRequest,
  DocumentList,
  DocumentParams,
  DocumentResponse,
  ErrorResponse,
  FindingParams,
  FindingsResponse,
  ImportedTemplate,
  ImportTemplateQuery,
  ListDocumentsQuery,
  ListRecordsParams,
  ListRecordsQuery,
  PolicyChange,
  PolicyParams,
  PolicyVersion,
  RecordList,
  RecordParams,
  RecordResponse,
  SavedRecord,
  SubmissionPackage,
  TemplateVersion,
  VersionParams,
  VersionResponse,
  WithdrawRequest,
} from '@docsmart/schemas';
import {
  ApprovalRefused,
  type Catalogue,
  checkImportRules,
  ImportFailure,
  importWord,
} from '@docsmart/template-library';
import fastifySwagger from '@fastify/swagger';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { withTenant } from '../db/connect.js';
import type { Database } from '../db/schema.js';
import {
  CHECKS_POLICY,
  createDocument,
  DocumentError,
  markReady,
  recordDisposition,
  recordVersion,
  WORD_MEDIA_TYPE,
  withdraw,
} from '../documents.js';
import { currentRecord, InvalidRecord, listRecords, saveRecord } from '../records.js';
import { approveTemplate, storeTemplate, templateVersions } from '../templates.js';
import { assemblyInput, NotFound } from './assembly-input.js';
import { AuthError, authenticate, type Principal, requireRole } from './auth.js';

export interface ServerDeps {
  db: Kysely<Database>;
  store: ObjectStore;
  catalogue: FieldCatalogue;
  tokens: ReadonlyMap<string, Principal>;
  /** For logging; false in tests. */
  logger?: boolean;
  /** Overridable for tests. */
  now?: () => Date;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal;
  }
}

const Errors = {
  400: ErrorResponse,
  401: ErrorResponse,
  403: ErrorResponse,
  404: ErrorResponse,
  409: ErrorResponse,
  422: ErrorResponse,
};
const PUBLIC = new Set(['/health', '/openapi.json']);

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const now = deps.now ?? (() => new Date());
  const app = Fastify({
    logger: deps.logger ?? false,
    bodyLimit: 20 * 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Document Factory API',
        version: '0.1.0',
        description: 'Sponsor-side assembly of BVI SPC documents. Not legal advice.',
      },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
      security: [{ bearer: [] }],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  // Template masters arrive as Word files.
  app.addContentTypeParser(WORD_MEDIA_TYPE, { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  app.addHook('onRequest', async (req: FastifyRequest) => {
    if (PUBLIC.has(req.routeOptions.url ?? '')) return;
    req.principal = authenticate(req.headers.authorization, deps.tokens);
  });

  app.setErrorHandler((err, req, reply) => {
    const send = (status: number, body: z.infer<typeof ErrorResponse>) => reply.status(status).send(body);
    if (hasZodFastifySchemaValidationErrors(err)) {
      return send(400, {
        error: 'invalid_request',
        message: 'The request does not match the API contract.',
        issues: err.validation.map((v) => `${v.instancePath || '(body)'}: ${v.message}`),
      });
    }
    if (err instanceof AuthError)
      return send(err.status, { error: err.status === 401 ? 'unauthenticated' : 'forbidden', message: err.message });
    if (err instanceof NotFound) return send(404, { error: 'not_found', message: err.message });
    if (err instanceof InvalidRecord)
      return send(400, {
        error: 'invalid_record',
        message: `The ${err.entity} record is not valid.`,
        issues: err.issues,
      });
    if (err instanceof ImportFailure)
      return send(422, {
        error: 'import_failed',
        message: 'The Word file cannot be imported.',
        problems: err.problems,
      });
    if (err instanceof ApprovalRefused) return send(422, { error: 'approval_refused', message: err.message });
    if (err instanceof DocumentError) {
      return err.gate
        ? send(409, { error: 'gate_refused', message: err.message, gate: err.gate })
        : send(409, { error: 'conflict', message: err.message });
    }
    if ((err as { name?: string }).name === 'AssemblyRefused')
      return send(422, { error: 'approval_refused', message: (err as AssemblyRefused).message });
    if ((err as { code?: string }).code === '23505')
      return send(409, { error: 'conflict', message: 'That already exists.' });
    req.log.error(err);
    return reply.status(500).send({ error: 'internal', message: 'Something went wrong.' });
  });

  const tenant = <T>(req: FastifyRequest, work: Parameters<typeof withTenant<T>>[2]) =>
    withTenant(deps.db, req.principal.tenant_id, work);
  const who = (req: FastifyRequest) => ({ tenant_id: req.principal.tenant_id, actor: req.principal.actor });

  app.get('/health', { schema: { hide: true } }, async () => ({ ok: true }));
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  // ---------- records ----------

  app.put(
    '/records/:entity/:id',
    {
      schema: {
        tags: ['records'],
        params: RecordParams,
        body: z.record(z.string(), z.unknown()),
        response: { 200: SavedRecord, ...Errors },
      },
    },
    async (req) => {
      requireRole(req.principal, 'sponsor');
      const version = await tenant(req, (tx) => saveRecord(tx, who(req), req.params.entity, req.params.id, req.body));
      return { entity: req.params.entity, id: req.params.id, version };
    },
  );

  app.get(
    '/records/:entity/:id',
    { schema: { tags: ['records'], params: RecordParams, response: { 200: RecordResponse, ...Errors } } },
    async (req) => {
      const data = await tenant(req, (tx) =>
        currentRecord<Record<string, unknown>>(tx, req.params.entity, req.params.id),
      );
      if (!data) throw new NotFound(`No ${req.params.entity} ${req.params.id}.`);
      return { entity: req.params.entity, id: req.params.id, data };
    },
  );

  app.get(
    '/records/:entity',
    {
      schema: {
        tags: ['records'],
        params: ListRecordsParams,
        querystring: ListRecordsQuery,
        response: { 200: RecordList, ...Errors },
      },
    },
    async (req) => {
      const rows = await tenant(req, (tx) => listRecords(tx, req.params.entity, req.query.portfolio_id));
      return { records: rows.map((r) => ({ entity: req.params.entity, ...r })) };
    },
  );

  // ---------- templates ----------

  app.post(
    '/templates',
    {
      schema: { tags: ['templates'], querystring: ImportTemplateQuery, response: { 201: ImportedTemplate, ...Errors } },
    },
    async (req, reply) => {
      if (!Buffer.isBuffer(req.body))
        throw new ImportFailure([
          { code: 'not_word', at: 'file', message: `Send the Word file as ${WORD_MEDIA_TYPE}.` },
        ]);
      const q = req.query;
      const { tree } = await importWord(new Uint8Array(req.body), q.template);
      const rule_problems = checkImportRules(tree, deps.catalogue as unknown as Catalogue);
      const template = await tenant(req, (tx) =>
        storeTemplate(tx, who(req), {
          id: q.id,
          class: q.class,
          version: q.version,
          jurisdictions: q.jurisdictions
            .split(',')
            .map((j) => j.trim())
            .filter(Boolean),
          tree,
        }),
      );
      return reply.status(201).send({ template, rule_problems });
    },
  );

  app.get(
    '/templates',
    { schema: { tags: ['templates'], response: { 200: z.array(TemplateVersion), ...Errors } } },
    async (req) => tenant(req, (tx) => templateVersions(tx)),
  );

  app.post(
    '/templates/:id/approve',
    { schema: { tags: ['templates'], params: DocumentParams, response: { 200: TemplateVersion, ...Errors } } },
    async (req) => {
      const counsel = requireRole(req.principal, 'counsel');
      return tenant(req, (tx) =>
        approveTemplate(
          tx,
          who(req),
          req.params.id,
          deps.catalogue as unknown as Catalogue,
          { lawyer_id: counsel.actor, ...counsel.lawyer },
          now().toISOString(),
        ),
      );
    },
  );

  // ---------- policy ----------

  app.put(
    '/policies/:key',
    {
      schema: {
        tags: ['policy'],
        params: PolicyParams,
        body: PolicyChange,
        response: { 200: PolicyVersion, ...Errors },
      },
    },
    async (req) => {
      const counsel = requireRole(req.principal, 'counsel');
      const version = await tenant(req, (tx) =>
        setPolicy(tx, {
          tenant_id: counsel.tenant_id,
          key: req.params.key,
          value: req.body.value,
          approved_by: counsel.actor,
          change_ref: req.body.change_ref,
        }),
      );
      return { key: req.params.key, version };
    },
  );

  // ---------- documents ----------

  const documentView = (row: {
    id: string;
    class: string;
    scope: 'umbrella' | 'portfolio';
    umbrella_id: string;
    portfolio_id: string | null;
    lifecycle: unknown;
  }) => {
    const l = row.lifecycle as DocumentLifecycle;
    return {
      id: row.id,
      class: row.class as z.infer<typeof DocumentResponse>['class'],
      scope: row.scope,
      umbrella_id: row.umbrella_id,
      portfolio_id: row.portfolio_id,
      state: l.state,
      current_version: l.context.current_version,
      ready_version_id: l.context.ready_version_id,
    };
  };
  const loadDocument = async (req: FastifyRequest, id: string) => {
    const row = await tenant(req, (tx) =>
      tx.selectFrom('documents').selectAll().where('id', '=', id).executeTakeFirst(),
    );
    if (!row) throw new NotFound(`No document ${id}.`);
    return row;
  };

  app.post(
    '/documents',
    { schema: { tags: ['documents'], body: CreateDocument, response: { 201: DocumentResponse, ...Errors } } },
    async (req, reply) => {
      requireRole(req.principal, 'sponsor');
      await tenant(req, (tx) => createDocument(tx, who(req), req.body));
      return reply.status(201).send(documentView(await loadDocument(req, req.body.id)));
    },
  );

  app.get(
    '/documents',
    {
      schema: { tags: ['documents'], querystring: ListDocumentsQuery, response: { 200: DocumentList, ...Errors } },
    },
    async (req) => {
      const rows = await tenant(req, (tx) => {
        let q = tx.selectFrom('documents').selectAll();
        if (req.query.scope) q = q.where('scope', '=', req.query.scope);
        if (req.query.portfolio_id) q = q.where('portfolio_id', '=', req.query.portfolio_id);
        return q.orderBy('id').execute();
      });
      return { documents: rows.map(documentView) };
    },
  );

  app.get(
    '/documents/:id',
    { schema: { tags: ['documents'], params: DocumentParams, response: { 200: DocumentResponse, ...Errors } } },
    async (req) => documentView(await loadDocument(req, req.params.id)),
  );

  app.post(
    '/documents/:id/versions',
    {
      schema: {
        tags: ['documents'],
        params: DocumentParams,
        body: AssembleRequest,
        response: { 201: AssembledVersion, ...Errors },
      },
    },
    async (req, reply) => {
      requireRole(req.principal, 'sponsor');
      const versionId = `ver_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
      const result = await tenant(req, async (tx) => {
        const doc = await tx
          .selectFrom('documents')
          .select(['id', 'class', 'umbrella_id', 'portfolio_id'])
          .where('id', '=', req.params.id)
          .executeTakeFirst();
        if (!doc) throw new NotFound(`No document ${req.params.id}.`);
        const { input, references } = await assemblyInput(tx, deps.catalogue, doc, req.body);
        const assembled = assemble(input);
        const recorded = await recordVersion(tx, who(req), {
          document_id: doc.id,
          version_id: versionId,
          template_version_id: req.body.template_version_id,
          assembled,
          references,
          store: deps.store,
        });
        return { recorded, problems: assembled.document.problems };
      });
      return reply.status(201).send({
        version_id: versionId,
        number: result.recorded.number,
        content_hash: result.recorded.content_hash,
        problems: result.problems,
        rendering: result.recorded.rendering as string,
      });
    },
  );

  app.get(
    '/documents/:id/versions/:version',
    { schema: { tags: ['documents'], params: VersionParams, response: { 200: VersionResponse, ...Errors } } },
    async (req) => {
      const row = await tenant(req, (tx) =>
        tx
          .selectFrom('draft_versions')
          .select(['id', 'document_id', 'number', 'content_hash', 'content'])
          .where('id', '=', req.params.version)
          .where('document_id', '=', req.params.id)
          .executeTakeFirst(),
      );
      if (!row) throw new NotFound(`No version ${req.params.version} of document ${req.params.id}.`);
      return { ...row, content: row.content as z.infer<typeof VersionResponse>['content'] };
    },
  );

  // The Word rendering (decision 0006), as a file: no JSON response schema.
  app.get(
    '/documents/:id/versions/:version/word',
    { schema: { tags: ['documents'], params: VersionParams } },
    async (req, reply) => {
      const word = await tenant(req, async (tx) => {
        const row = await tx
          .selectFrom('draft_versions')
          .select('rendering_sha256')
          .where('id', '=', req.params.version)
          .where('document_id', '=', req.params.id)
          .executeTakeFirst();
        if (!row?.rendering_sha256) throw new NotFound(`No Word rendering of version ${req.params.version}.`);
        return getEvidence(tx, deps.store, row.rendering_sha256);
      });
      return reply
        .header('content-type', word.media_type)
        .header('content-disposition', `attachment; filename="${req.params.id}-${req.params.version}.docx"`)
        .send(Buffer.from(word.bytes));
    },
  );

  app.get(
    '/documents/:id/versions/:version/findings',
    { schema: { tags: ['documents'], params: VersionParams, response: { 200: FindingsResponse, ...Errors } } },
    async (req) => {
      const findings = await tenant(req, (tx) =>
        tx
          .selectFrom('findings')
          .select(['id', 'check', 'severity', 'at', 'message'])
          .where('version_id', '=', req.params.version)
          .orderBy('id')
          .execute(),
      );
      return { findings };
    },
  );

  app.post(
    '/findings/:id/disposition',
    {
      schema: {
        tags: ['documents'],
        params: FindingParams,
        body: DispositionRequest,
        response: { 204: z.null(), ...Errors },
      },
    },
    async (req, reply) => {
      requireRole(req.principal, 'sponsor');
      await tenant(req, (tx) => recordDisposition(tx, who(req), { finding_id: req.params.id, ...req.body }));
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/documents/:id/ready',
    { schema: { tags: ['documents'], params: DocumentParams, response: { 200: SubmissionPackage, ...Errors } } },
    async (req) => {
      requireRole(req.principal, 'sponsor');
      const pkg = await tenant(req, (tx) => markReady(tx, who(req), req.params.id, now().toISOString()));
      return pkg as unknown as z.infer<typeof SubmissionPackage>;
    },
  );

  app.get(
    '/documents/:id/package',
    { schema: { tags: ['documents'], params: DocumentParams, response: { 200: SubmissionPackage, ...Errors } } },
    async (req) => {
      const row = await tenant(req, async (tx) => {
        const doc = await tx
          .selectFrom('documents')
          .select('lifecycle')
          .where('id', '=', req.params.id)
          .executeTakeFirst();
        const ready = (doc?.lifecycle as DocumentLifecycle | undefined)?.context.ready_version_id;
        return ready
          ? tx.selectFrom('submission_packages').select('package').where('version_id', '=', ready).executeTakeFirst()
          : undefined;
      });
      if (!row) throw new NotFound(`Document ${req.params.id} has no submission package.`);
      return row.package as z.infer<typeof SubmissionPackage>;
    },
  );

  app.post(
    '/documents/:id/withdraw',
    {
      schema: {
        tags: ['documents'],
        params: DocumentParams,
        body: WithdrawRequest,
        response: { 204: z.null(), ...Errors },
      },
    },
    async (req, reply) => {
      requireRole(req.principal, 'sponsor');
      await tenant(req, (tx) => withdraw(tx, who(req), req.params.id, req.body.reason));
      return reply.status(204).send(null);
    },
  );

  return app;
}

export { CHECKS_POLICY };
