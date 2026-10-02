/**
 * Template versions and their approval (spec DF-01 to DF-03, DF-P2; build plan B3). Only an approved
 * version can be selected. Approval names the lawyer, who must be verified and admitted in every
 * jurisdiction the template is for.
 */
import { contentHash, type TemplateTree } from './format.js';
import { type Catalogue, checkImportRules } from './rules.js';

export type TemplateStatus = 'draft' | 'approved' | 'retired';

export interface TemplateVersionRecord {
  id: string;
  /** The template, e.g. "D12-A". */
  template: string;
  /** Document class, e.g. "D12". */
  class: string;
  version: number;
  jurisdictions: string[];
  content_hash: string;
  status: TemplateStatus;
  approval?: { lawyer_id: string; approved_at: string; jurisdictions: string[]; supersedes: string | null };
  retirement?: { by: string; at: string; reason: string };
}

export interface Approver {
  lawyer_id: string;
  /** Credential verification done (spec §7.2). */
  verified: boolean;
  /** Jurisdictions the lawyer is admitted in. */
  admissions: string[];
}

export class ApprovalRefused extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(reasons.join(' '));
    this.name = 'ApprovalRefused';
    this.reasons = reasons;
  }
}

/**
 * Approves a draft version. Refuses if its content differs from the record's hash, if it breaks an
 * import rule, or if the approver is not a verified lawyer admitted in all of its jurisdictions.
 * Records which approved version it supersedes; it does not retire that one (retiring is a
 * separate decision, DF-03).
 */
export function approve(
  record: TemplateVersionRecord,
  tree: TemplateTree,
  catalogue: Catalogue,
  approver: Approver,
  at: string,
  existing: readonly TemplateVersionRecord[],
): TemplateVersionRecord {
  const reasons: string[] = [];
  if (record.status !== 'draft') reasons.push(`Version ${record.id} is ${record.status}, not draft.`);
  if (tree.template !== record.template) reasons.push(`The content is for ${tree.template}, not ${record.template}.`);
  if (contentHash(tree) !== record.content_hash) reasons.push('The content does not match the version’s hash.');
  const problems = checkImportRules(tree, catalogue);
  if (problems.length) reasons.push(`The template breaks ${problems.length} import rule(s).`);
  if (!approver.verified) reasons.push(`Lawyer ${approver.lawyer_id} is not verified.`);
  const missing = record.jurisdictions.filter((j) => !approver.admissions.includes(j));
  if (missing.length) reasons.push(`Lawyer ${approver.lawyer_id} is not admitted in ${missing.join(', ')}.`);
  if (!record.jurisdictions.length) reasons.push('The version names no jurisdiction.');
  if (reasons.length) throw new ApprovalRefused(reasons);

  const previous = existing
    .filter((v) => v.template === record.template && v.status === 'approved' && v.id !== record.id)
    .sort((a, b) => b.version - a.version)[0];
  if (previous && previous.version >= record.version) {
    throw new ApprovalRefused([`Version ${record.version} is not later than approved version ${previous.version}.`]);
  }
  return {
    ...record,
    status: 'approved',
    approval: {
      lawyer_id: approver.lawyer_id,
      approved_at: at,
      jurisdictions: [...record.jurisdictions],
      supersedes: previous?.id ?? null,
    },
  };
}

/** Retires an approved version. Documents already assembled on it are flagged, not blocked (DF-03). */
export function retire(record: TemplateVersionRecord, by: string, at: string, reason: string): TemplateVersionRecord {
  if (record.status !== 'approved')
    throw new ApprovalRefused([`Version ${record.id} is ${record.status}, not approved.`]);
  if (!reason.trim()) throw new ApprovalRefused(['Retiring a version needs a reason.']);
  return { ...record, status: 'retired', retirement: { by, at, reason } };
}
