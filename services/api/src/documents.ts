/**
 * Documents (build plan B2, B9, decisions 0001 and 0009). Each operation is one transaction: it reads
 * the stored lifecycle, applies the event with @docsmart/domain, writes the new rows and the audit
 * entry, and commits them together. The submission gate is enforced here, not in the UI.
 */
import { type AssemblyResult, renderWord } from '@docsmart/assembly';
import {
  applyEvent,
  type CheckId,
  createSubmissionPackage,
  type Disposition,
  type DocumentClass,
  type DocumentLifecycle,
  type Finding,
  type GateFacts,
  type GateResult,
  type LifecycleEvent,
  type ReferenceFacts,
  type SubmissionPackage,
  startDocument,
} from '@docsmart/domain';
import { audit, getPolicy, type ObjectStore, putEvidence } from '@docsmart/platform';
import type { Actor, Tx } from './db/connect.js';

export const WORD_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class DocumentError extends Error {
  readonly gate: GateResult | undefined;

  constructor(message: string, gate?: GateResult) {
    super(message);
    this.name = 'DocumentError';
    this.gate = gate;
  }
}

/** Reads a document for change, locking its row until the transaction ends. */
async function lockDocument(tx: Tx, id: string) {
  const row = await tx.selectFrom('documents').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
  if (!row) throw new DocumentError(`No document ${id}.`);
  return { ...row, lifecycle: row.lifecycle as DocumentLifecycle };
}

async function transition(
  tx: Tx,
  who: Actor,
  doc: { id: string; row_version: number; lifecycle: DocumentLifecycle },
  event: LifecycleEvent,
) {
  const r = applyEvent(doc.lifecycle, event);
  if (!r.ok) throw new DocumentError(r.reason, r.gate);
  const updated = await tx
    .updateTable('documents')
    .set({
      state: r.to,
      lifecycle: JSON.stringify(r.lifecycle),
      row_version: doc.row_version + 1,
      updated_at: new Date(),
    })
    .where('id', '=', doc.id)
    .where('row_version', '=', doc.row_version)
    .executeTakeFirst();
  if (updated.numUpdatedRows !== 1n) throw new DocumentError(`Document ${doc.id} changed underneath this request.`);
  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: who.actor,
    action: `document.${event.type.toLowerCase()}`,
    entity: 'document',
    entity_id: doc.id,
    ...(r.lifecycle.context.current_version ? { version_hash: r.lifecycle.context.current_version.content_hash } : {}),
    details: { from: r.from, to: r.to },
  });
  return r.lifecycle;
}

export async function createDocument(
  tx: Tx,
  who: Actor,
  d: {
    id: string;
    class: DocumentClass;
    scope: 'umbrella' | 'portfolio';
    umbrella_id: string;
    portfolio_id: string | null;
  },
): Promise<DocumentLifecycle> {
  const lifecycle = startDocument({
    document_id: d.id,
    document_class: d.class,
    scope: d.scope,
    portfolio_id: d.portfolio_id,
  });
  await tx
    .insertInto('documents')
    .values({
      tenant_id: who.tenant_id,
      id: d.id,
      class: d.class,
      scope: d.scope,
      umbrella_id: d.umbrella_id,
      portfolio_id: d.portfolio_id,
      state: lifecycle.state,
      lifecycle: JSON.stringify(lifecycle),
    })
    .execute();
  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: who.actor,
    action: 'document.created',
    entity: 'document',
    entity_id: d.id,
    details: { class: d.class },
  });
  return lifecycle;
}

/** A document this version is built on (for D1-SP: U3 and D13), by the version it used. */
export interface Reference {
  kind: 'U3' | 'D13';
  document_id: string;
  version_id: string;
}

/**
 * Records an assembled version (INV-3: a new row, never an update) and moves the lifecycle. Assembly's
 * own problems become blocking findings, so a version with a missing slot cannot pass the gate. With
 * an object store, the Word rendering is kept as evidence.
 */
export async function recordVersion(
  tx: Tx,
  who: Actor,
  v: {
    document_id: string;
    version_id: string;
    template_version_id: string;
    assembled: AssemblyResult;
    references?: Reference[];
    store?: ObjectStore;
  },
): Promise<{ number: number; content_hash: string; rendering?: string }> {
  const doc = await lockDocument(tx, v.document_id);
  const template = await tx
    .selectFrom('template_versions')
    .select('status')
    .where('id', '=', v.template_version_id)
    .executeTakeFirst();
  if (template?.status !== 'approved')
    throw new DocumentError(`Template version ${v.template_version_id} is not approved.`);
  const references: Record<string, Reference & { content_hash: string }> = {};
  for (const ref of v.references ?? []) {
    const row = await tx
      .selectFrom('draft_versions')
      .select('content_hash')
      .where('id', '=', ref.version_id)
      .where('document_id', '=', ref.document_id)
      .executeTakeFirst();
    if (!row) throw new DocumentError(`No version ${ref.version_id} of document ${ref.document_id}.`);
    if (v.assembled.referenced_hashes[ref.kind] !== row.content_hash) {
      throw new DocumentError(`The ${ref.kind} this version was assembled on is not version ${ref.version_id}.`);
    }
    references[ref.kind] = { ...ref, content_hash: row.content_hash };
  }
  let rendering: string | undefined;
  if (v.store) {
    rendering = await putEvidence(tx, v.store, {
      tenant_id: who.tenant_id,
      bytes: await renderWord(v.assembled.document),
      media_type: WORD_MEDIA_TYPE,
      created_by: who.actor,
    });
  }
  const previous = doc.lifecycle.context.current_version;
  const number = (previous?.number ?? 0) + 1;
  const ref = { id: v.version_id, number, content_hash: v.assembled.content_hash };
  await tx
    .insertInto('draft_versions')
    .values({
      tenant_id: who.tenant_id,
      id: v.version_id,
      document_id: v.document_id,
      number,
      parent_version_id: previous?.id ?? null,
      template_version_id: v.template_version_id,
      content_hash: v.assembled.content_hash,
      content: JSON.stringify(v.assembled.document),
      slot_snapshot: JSON.stringify(v.assembled.values),
      calculations: JSON.stringify(v.assembled.calculations),
      referenced_hashes: JSON.stringify(references),
      rendering_sha256: rendering ?? null,
      created_by: who.actor,
    })
    .execute();
  await transition(tx, who, doc, { type: 'VERSION_ASSEMBLED', version: ref });

  // Assembly's problems are findings of the required-slot and contracting-party checks.
  const problems = v.assembled.document.problems;
  for (const [i, p] of problems.entries()) {
    await tx
      .insertInto('findings')
      .values({
        tenant_id: who.tenant_id,
        id: `${v.version_id}_a${i + 1}`,
        version_id: v.version_id,
        check: p.kind === 'locked_wording' ? 'contracting_party' : 'required_slot',
        severity: 'blocks',
        at: p.at,
        message: `${p.field}: ${p.reason}`,
      })
      .execute();
  }
  await tx
    .insertInto('check_runs')
    .values({ tenant_id: who.tenant_id, version_id: v.version_id, check: 'required_slot' })
    .execute();

  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: who.actor,
    action: 'version.recorded',
    entity: 'draft_version',
    entity_id: v.version_id,
    version_hash: v.assembled.content_hash,
    details: { document_id: v.document_id, number, problems: problems.length, ...(rendering ? { rendering } : {}) },
  });
  return { number, content_hash: v.assembled.content_hash, ...(rendering ? { rendering } : {}) };
}

/** Records the checks that ran on a version and what they found (build plan B6). */
export async function recordChecks(
  tx: Tx,
  who: Actor,
  c: { version_id: string; checks_run: CheckId[]; findings: Omit<Finding, 'version_id'>[] },
): Promise<void> {
  for (const check of c.checks_run) {
    await tx
      .insertInto('check_runs')
      .values({ tenant_id: who.tenant_id, version_id: c.version_id, check })
      .onConflict((o) => o.doNothing())
      .execute();
  }
  for (const f of c.findings) {
    await tx
      .insertInto('findings')
      .values({ tenant_id: who.tenant_id, ...f, version_id: c.version_id })
      .execute();
  }
  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: who.actor,
    action: 'checks.recorded',
    entity: 'draft_version',
    entity_id: c.version_id,
    details: { checks: c.checks_run, findings: c.findings.length },
  });
}

/** The sponsor's decision on a review finding. Blocking findings can only be fixed (new version). */
export async function recordDisposition(
  tx: Tx,
  who: Actor,
  d: { finding_id: string; decision: 'keep' | 'fix'; reason?: string },
): Promise<void> {
  const finding = await tx.selectFrom('findings').select('severity').where('id', '=', d.finding_id).executeTakeFirst();
  if (!finding) throw new DocumentError(`No finding ${d.finding_id}.`);
  if (finding.severity === 'blocks')
    throw new DocumentError('A blocking finding can only be fixed, by making a new version.');
  await tx
    .insertInto('dispositions')
    .values({
      tenant_id: who.tenant_id,
      finding_id: d.finding_id,
      decision: d.decision,
      reason: d.reason ?? null,
      decided_by: who.actor,
    })
    .execute();
  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: who.actor,
    action: `finding.${d.decision}`,
    entity: 'finding',
    entity_id: d.finding_id,
    details: d.reason ? { reason: d.reason } : {},
  });
}

/** The policy key holding the checks each document class must run. */
export const CHECKS_POLICY = 'checks.required';

/** Gathers the gate facts for the document's current version from the database. */
export async function gateFacts(tx: Tx, documentId: string): Promise<GateFacts> {
  const doc = await tx
    .selectFrom('documents')
    .select(['class', 'lifecycle'])
    .where('id', '=', documentId)
    .executeTakeFirstOrThrow();
  const current = (doc.lifecycle as DocumentLifecycle).context.current_version;
  if (!current) throw new DocumentError('The document has no version yet.');
  const version = await tx
    .selectFrom('draft_versions')
    .selectAll()
    .where('id', '=', current.id)
    .executeTakeFirstOrThrow();
  const template = await tx
    .selectFrom('template_versions')
    .select(['id', 'status'])
    .where('id', '=', version.template_version_id)
    .executeTakeFirstOrThrow();
  const policy = await getPolicy(tx, CHECKS_POLICY);
  if (!policy)
    throw new DocumentError(`No ${CHECKS_POLICY} policy is set, so the gate cannot know which checks must run.`);
  const findings = await tx
    .selectFrom('findings')
    .select(['id', 'version_id', 'check', 'severity', 'at', 'message'])
    .where('version_id', '=', version.id)
    .execute();
  const decisions = findings.length
    ? await tx
        .selectFrom('dispositions')
        .selectAll()
        .where(
          'finding_id',
          'in',
          findings.map((f) => f.id),
        )
        .orderBy('seq')
        .execute()
    : [];
  // The latest decision on each finding counts.
  const latest = new Map(decisions.map((d) => [d.finding_id, d]));
  const dispositions: Disposition[] = [...latest.values()].map((d) =>
    d.decision === 'keep'
      ? {
          finding_id: d.finding_id,
          decision: 'keep',
          reason: d.reason ?? '',
          by: d.decided_by,
          at: d.decided_at.toISOString(),
        }
      : { finding_id: d.finding_id, decision: 'fix', by: d.decided_by, at: d.decided_at.toISOString() },
  );
  const references: ReferenceFacts[] = [];
  for (const [kind, ref] of Object.entries(
    version.referenced_hashes as Record<string, Reference & { content_hash: string }>,
  )) {
    const target = await tx
      .selectFrom('documents')
      .select(['state', 'lifecycle'])
      .where('id', '=', ref.document_id)
      .executeTakeFirstOrThrow();
    const versionRow = await tx
      .selectFrom('draft_versions')
      .select('content_hash')
      .where('id', '=', ref.version_id)
      .executeTakeFirstOrThrow();
    references.push({
      kind: kind as 'U3' | 'D13',
      document_id: ref.document_id,
      version_id: ref.version_id,
      state: target.state,
      recorded_hash: ref.content_hash,
      version_hash: versionRow.content_hash,
      latest_frozen_version_id: (target.lifecycle as DocumentLifecycle).context.ready_version_id ?? '',
    });
  }
  return {
    document_id: documentId,
    document_class: doc.class as DocumentClass,
    version: { id: version.id, document_id: version.document_id, content_hash: version.content_hash },
    latest_version_id: current.id,
    template: { version_id: template.id, status: template.status },
    checks_required: (policy.value as Record<string, CheckId[]>)[doc.class] ?? [],
    checks_run: (await tx.selectFrom('check_runs').select('check').where('version_id', '=', version.id).execute()).map(
      (r) => r.check as CheckId,
    ),
    findings: findings.map((f) => ({ ...f, check: f.check as CheckId })),
    dispositions,
    ai_zones: [],
    references,
  };
}

/** Passes the submission gate (build plan §4): moves to READY_FOR_SUBMISSION and freezes the package. */
export async function markReady(tx: Tx, who: Actor, documentId: string, at: string): Promise<SubmissionPackage> {
  const doc = await lockDocument(tx, documentId);
  const facts = await gateFacts(tx, documentId);
  const lifecycle = await transition(tx, who, doc, { type: 'MARK_READY', facts, actor: who.actor });
  const pkg = createSubmissionPackage(lifecycle, facts, who.actor, at);
  await tx
    .insertInto('submission_packages')
    .values({
      tenant_id: who.tenant_id,
      version_id: pkg.version_id,
      document_id: documentId,
      package: JSON.stringify(pkg),
      package_hash: pkg.package_hash,
    })
    .execute();
  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: who.actor,
    action: 'package.frozen',
    entity: 'submission_package',
    entity_id: pkg.version_id,
    version_hash: pkg.content_hash,
    details: { package_hash: pkg.package_hash },
  });
  return pkg;
}

export async function withdraw(tx: Tx, who: Actor, documentId: string, reason: string): Promise<void> {
  const doc = await lockDocument(tx, documentId);
  await transition(tx, who, doc, { type: 'WITHDRAW', actor: who.actor, reason });
}
