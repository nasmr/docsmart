/**
 * An assembled document: the template with its conditions and loops decided, its fields filled and
 * its counsel notes removed. This is the canonical content of a DraftVersion (INV-3); its hash is the
 * version's content hash, and the Word rendering is made from it (decision 0006).
 */
import { createHash } from 'node:crypto';
import canonicalizeModule from 'canonicalize';

const canonicalize = canonicalizeModule as unknown as (v: unknown) => string;

export const ASSEMBLED_FORMAT = 'docsmart.assembled/1';

/** Every piece of text says where it came from (build plan B7: provenance styles). */
export type Piece =
  /** Approved template text. */
  | { t: 'text'; v: string }
  /** A value from records, a document input or the calculation service, already formatted (decision 0011). */
  | { t: 'value'; field: string; v: string; origin: string }
  /** Filled at signing; blank until then (field catalogue gap G6). */
  | { t: 'blank'; field: string }
  /** A value assembly could not fill. Reported as a problem; never printed as if it were text. */
  | { t: 'missing'; field: string; reason: string };

export type AssembledBlock =
  | { t: 'heading'; id: string; level: number; number?: string; text: Piece[] }
  | { t: 'clause'; id: string; number?: string; text: Piece[] }
  | { t: 'para'; id: string; style: 'title' | 'subtitle' | 'body' | 'bullet' | 'check' | 'signature'; text: Piece[] }
  | { t: 'table'; id: string; rows: Piece[][][] }
  /** An AI-drafted section. Empty until drafted (build plan B8); with the AI off it stays empty (DF-52). */
  | { t: 'zone'; id: string; zone: string; text: Piece[] }
  /** The contracting-party wording, generated from the records (DF-62). */
  | { t: 'locked'; id: string; text: Piece[] };

export interface AssemblyProblem {
  kind: 'missing_value' | 'condition_undecided' | 'list_unavailable' | 'locked_wording';
  field: string;
  /** The nearest block. */
  at: string;
  reason: string;
}

export interface AssembledDocument {
  format: typeof ASSEMBLED_FORMAT;
  document_id: string;
  template: string;
  template_version_id: string;
  body: AssembledBlock[];
  problems: AssemblyProblem[];
}

/** SHA-256 over the RFC 8785 form (decision 0005). */
export function assembledHash(doc: AssembledDocument): string {
  return createHash('sha256').update(canonicalize(doc)).digest('hex');
}

/** Plain text of pieces, for display and checks. Blanks print as a line; missing values as a marker. */
export function piecesText(pieces: readonly Piece[]): string {
  return pieces
    .map((p) => (p.t === 'text' || p.t === 'value' ? p.v : p.t === 'blank' ? '____________' : `[missing: ${p.field}]`))
    .join('');
}
