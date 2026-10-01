/**
 * Documents, versions, findings and dispositions (spec §5.1, build plan B2).
 */

export type DocumentClass = 'U3' | 'D12' | 'D13' | 'D1-SP';
export type DocumentScope = 'umbrella' | 'portfolio';

/** Document lifecycle states in this slice (build plan §2.3, decision 0001). */
export type DocumentState = 'DRAFTING' | 'ASSEMBLED' | 'READY_FOR_SUBMISSION' | 'WITHDRAWN';

export interface DocumentInstance {
  id: string;
  class: DocumentClass;
  scope: DocumentScope;
  /** Required when scope is portfolio (INV-9); null for umbrella documents. */
  portfolio_id: string | null;
  umbrella_id: string;
}

/** Spec §5.1: only approved versions are selectable. */
export type TemplateVersionStatus = 'draft' | 'approved' | 'retired';

/**
 * An immutable version of a document (INV-3). The database enforces immutability (decision 0005);
 * createDraftVersion also freezes the object so code cannot change it by accident.
 */
export interface DraftVersion {
  readonly id: string;
  readonly document_id: string;
  readonly number: number;
  readonly content_hash: string;
  readonly parent_version_id: string | null;
  readonly template_version_id: string;
  readonly slot_snapshot: Readonly<Record<string, unknown>>;
  /** Hashes of the documents this one was built on (for D1-SP: U3 and D13). */
  readonly referenced_document_hashes: Readonly<Record<string, string>>;
  readonly created_by: string;
  readonly created_at: string;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

const HASH = /^[0-9a-f]{64}$/;

export function createDraftVersion(v: DraftVersion): DraftVersion {
  if (!Number.isInteger(v.number) || v.number < 1) throw new Error('version number must be a positive integer');
  if (!HASH.test(v.content_hash)) throw new Error('content_hash must be a lower-case SHA-256 hex digest');
  if ((v.number === 1) !== (v.parent_version_id === null)) {
    throw new Error('version 1 has no parent; every later version has one');
  }
  return deepFreeze(structuredClone(v));
}

/**
 * The deterministic checks in build plan B6 (ids as in evals/checks/checks.json), plus
 * source_check: AI drafting's check that each statement is supported by a source (B8), whose
 * unsupported statements become review findings.
 */
export type CheckId =
  | 'required_slot'
  | 'cross_reference'
  | 'defined_terms'
  | 'contracting_party'
  | 'cross_portfolio'
  | 'retired_template'
  | 'reference_state'
  | 'jurisdiction_flag'
  | 'source_check';

export type Severity = 'blocks' | 'review';

export interface Finding {
  id: string;
  version_id: string;
  check: CheckId;
  /** As set by policy (SVC-POLICY) when the check ran. */
  severity: Severity;
  /** Clause or block id. */
  at: string;
  message: string;
}

/**
 * The sponsor's decision on a review finding. Blocking findings get none: they can only be fixed,
 * which means a new version.
 */
export type Disposition =
  | { finding_id: string; decision: 'keep'; reason: string; by: string; at: string }
  | { finding_id: string; decision: 'fix'; by: string; at: string };
