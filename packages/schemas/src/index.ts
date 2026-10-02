/**
 * The API contract (decision 0005): request and response shapes, shared by services/api and the web
 * app. The OpenAPI document is generated from these. Shapes and validation only; no logic.
 */
import { z } from 'zod';

const Hash = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .describe('SHA-256, lower-case hex');
const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'must be a lower-case id');

// ---------- errors ----------

export const ErrorResponse = z
  .object({
    error: z.enum([
      'unauthenticated',
      'forbidden',
      'not_found',
      'invalid_request',
      'invalid_record',
      'import_failed',
      'approval_refused',
      'conflict',
      'gate_refused',
      'internal',
    ]),
    message: z.string(),
    /** For invalid_record: "path: message" for each problem. */
    issues: z.array(z.string()).optional(),
    /** For import_failed: each place in the Word file and what is wrong there. */
    problems: z.array(z.object({ code: z.string(), at: z.string(), message: z.string() })).optional(),
    /** For gate_refused: every failed condition of the submission gate (build plan §4). */
    gate: z
      .object({
        passed: z.boolean(),
        failures: z.array(z.object({ condition: z.number().int(), message: z.string(), refs: z.array(z.string()) })),
      })
      .optional(),
  })
  .meta({ id: 'Error' });

// ---------- records ----------

export const RecordEntity = z.enum([
  'umbrella',
  'sponsor',
  'portfolio',
  'portfolio_terms',
  'offer',
  'asset',
  'subscription_account',
  'party',
  'subscription_request',
]);
export const RecordParams = z.object({ entity: RecordEntity, id: Id });
export const SavedRecord = z
  .object({ entity: RecordEntity, id: z.string(), version: z.number().int().positive() })
  .meta({ id: 'SavedRecord' });
export const RecordResponse = z
  .object({ entity: RecordEntity, id: z.string(), data: z.record(z.string(), z.unknown()) })
  .meta({ id: 'Record' });

// ---------- templates ----------

export const TemplateVersion = z
  .object({
    id: z.string(),
    template: z.string(),
    class: z.string(),
    version: z.number().int().positive(),
    jurisdictions: z.array(z.string()),
    content_hash: Hash,
    status: z.enum(['draft', 'approved', 'retired']),
    approval: z
      .object({
        lawyer_id: z.string(),
        approved_at: z.string(),
        jurisdictions: z.array(z.string()),
        supersedes: z.string().nullable(),
      })
      .optional(),
  })
  .meta({ id: 'TemplateVersion' });

export const ImportTemplateQuery = z.object({
  id: Id,
  template: z.string().min(1).describe('e.g. D12-A'),
  class: z.enum(['U3', 'D12', 'D13', 'D1-SP']),
  version: z.coerce.number().int().positive(),
  jurisdictions: z.string().describe('comma-separated, e.g. VG'),
});
export const ImportedTemplate = z
  .object({
    template: TemplateVersion,
    /** Import-rule problems (decision 0008). A template with any cannot be approved. */
    rule_problems: z.array(z.object({ rule: z.string(), at: z.string(), message: z.string() })),
  })
  .meta({ id: 'ImportedTemplate' });

// ---------- assembled content (packages/assembly) ----------

export const Piece = z
  .discriminatedUnion('t', [
    z.object({ t: z.literal('text'), v: z.string() }),
    z.object({ t: z.literal('value'), field: z.string(), v: z.string(), origin: z.string() }),
    z.object({ t: z.literal('blank'), field: z.string() }),
    z.object({ t: z.literal('missing'), field: z.string(), reason: z.string() }),
  ])
  .meta({
    id: 'Piece',
    description: 'Text with its provenance: template text, a value from records, a signing blank, or a missing value.',
  });

export const AssembledBlock = z
  .discriminatedUnion('t', [
    z.object({
      t: z.literal('heading'),
      id: z.string(),
      level: z.number().int(),
      number: z.string().optional(),
      text: z.array(Piece),
    }),
    z.object({ t: z.literal('clause'), id: z.string(), number: z.string().optional(), text: z.array(Piece) }),
    z.object({
      t: z.literal('para'),
      id: z.string(),
      style: z.enum(['title', 'subtitle', 'body', 'bullet', 'check', 'signature']),
      text: z.array(Piece),
    }),
    z.object({ t: z.literal('table'), id: z.string(), rows: z.array(z.array(z.array(Piece))) }),
    z.object({ t: z.literal('zone'), id: z.string(), zone: z.string(), text: z.array(Piece) }),
    z.object({ t: z.literal('locked'), id: z.string(), text: z.array(Piece) }),
  ])
  .meta({ id: 'AssembledBlock' });

export const AssemblyProblem = z
  .object({ kind: z.string(), field: z.string(), at: z.string(), reason: z.string() })
  .meta({ id: 'AssemblyProblem' });

export const AssembledDocument = z
  .object({
    format: z.string(),
    document_id: z.string(),
    template: z.string(),
    template_version_id: z.string(),
    body: z.array(AssembledBlock),
    problems: z.array(AssemblyProblem),
  })
  .meta({ id: 'AssembledDocument' });

// ---------- documents ----------

export const DocumentClass = z.enum(['U3', 'D12', 'D13', 'D1-SP']);
export const DocumentParams = z.object({ id: Id });
export const VersionParams = z.object({ id: Id, version: Id });

export const CreateDocument = z
  .object({
    id: Id,
    class: DocumentClass,
    scope: z.enum(['umbrella', 'portfolio']),
    umbrella_id: Id,
    portfolio_id: Id.nullable(),
  })
  .meta({ id: 'CreateDocument' });

export const DocumentState = z.enum(['DRAFTING', 'ASSEMBLED', 'READY_FOR_SUBMISSION', 'WITHDRAWN']);
export const VersionRef = z.object({ id: z.string(), number: z.number().int(), content_hash: Hash });

export const DocumentResponse = z
  .object({
    id: z.string(),
    class: DocumentClass,
    scope: z.enum(['umbrella', 'portfolio']),
    umbrella_id: z.string(),
    portfolio_id: z.string().nullable(),
    state: DocumentState,
    current_version: VersionRef.nullable(),
    ready_version_id: z.string().nullable(),
  })
  .meta({ id: 'Document' });

const DocumentPointer = z.object({ document_id: Id, version_id: Id });

export const AssembleRequest = z
  .object({
    template_version_id: z.string(),
    /** Values entered for this document: resolution dates, meeting details, interests, signatory. */
    inputs: z.record(z.string(), z.unknown()).default({}),
    /** For a subscription agreement: the investor and their subscription request. */
    party_id: Id.optional(),
    subscription_id: Id.optional(),
    /** Documents it is built on, by version (addendum §4.2). */
    references: z
      .object({
        D13: DocumentPointer.optional(),
        U3: DocumentPointer.optional(),
        /** D15 is not in this slice (field catalogue gap G4); its date is entered. */
        D15: z.object({ date: z.iso.date() }).optional(),
        /** The investor's earlier agreement, for D1SP-C. */
        earlier_agreement: z
          .object({ portfolio_legal_name: z.string(), executed_date: z.iso.date(), ref: z.string() })
          .optional(),
      })
      .default({}),
  })
  .meta({ id: 'AssembleRequest' });

export const AssembledVersion = z
  .object({
    version_id: z.string(),
    number: z.number().int().positive(),
    content_hash: Hash,
    /** Missing values and undecided conditions; each is also a blocking finding. */
    problems: z.array(AssemblyProblem),
    /** Evidence hash of the Word rendering. */
    rendering: Hash,
  })
  .meta({ id: 'AssembledVersion' });

export const VersionResponse = z
  .object({
    id: z.string(),
    document_id: z.string(),
    number: z.number().int(),
    content_hash: Hash,
    content: AssembledDocument,
  })
  .meta({ id: 'Version' });

export const Finding = z
  .object({
    id: z.string(),
    check: z.string(),
    severity: z.enum(['blocks', 'review']),
    at: z.string(),
    message: z.string(),
  })
  .meta({ id: 'Finding' });
export const FindingsResponse = z.object({ findings: z.array(Finding) }).meta({ id: 'Findings' });

export const DispositionRequest = z
  .discriminatedUnion('decision', [
    z.object({ decision: z.literal('keep'), reason: z.string().trim().min(1, 'keeping a finding needs a reason') }),
    z.object({ decision: z.literal('fix') }),
  ])
  .meta({ id: 'DispositionRequest' });
export const FindingParams = z.object({ id: z.string().min(1) });

export const WithdrawRequest = z.object({ reason: z.string().trim().min(1) }).meta({ id: 'WithdrawRequest' });

export const SubmissionPackage = z
  .object({
    document_id: z.string(),
    version_id: z.string(),
    content_hash: Hash,
    template_version_id: z.string(),
    findings: z.array(Finding.extend({ version_id: z.string() })),
    dispositions: z.array(z.record(z.string(), z.unknown())),
    references: z.record(z.string(), z.object({ version_id: z.string(), content_hash: Hash })),
    ai_zones: z.array(z.object({ zone: z.string(), statements: z.number().int(), kept_unsupported: z.number().int() })),
    passed_by: z.string(),
    passed_at: z.string(),
    package_hash: Hash,
  })
  .meta({ id: 'SubmissionPackage' });

// ---------- policy ----------

export const PolicyParams = z.object({ key: z.string().regex(/^[a-z][a-z0-9_.]*$/) });
export const PolicyChange = z
  .object({ value: z.unknown(), change_ref: z.string().trim().min(1) })
  .meta({ id: 'PolicyChange' });
export const PolicyVersion = z
  .object({ key: z.string(), version: z.number().int().positive() })
  .meta({ id: 'PolicyVersion' });
