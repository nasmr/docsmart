/**
 * The submission package (build plan B9): one version frozen with its findings, decisions and
 * references when it passes the gate. Counsel receives this, and nothing in it changes afterwards.
 */
import { createHash } from 'node:crypto';
import canonicalizeModule from 'canonicalize';
import { type Disposition, deepFreeze, type Finding } from './documents.js';
import { evaluateGate, type GateFacts } from './gate.js';
import type { DocumentLifecycle } from './lifecycle.js';

const canonicalize = canonicalizeModule as unknown as (v: unknown) => string;

export interface SubmissionPackage {
  readonly document_id: string;
  readonly version_id: string;
  readonly content_hash: string;
  readonly template_version_id: string;
  readonly findings: readonly Finding[];
  readonly dispositions: readonly Disposition[];
  /** Documents this one was built on, by kind (for D1-SP: U3 and D13). */
  readonly references: Readonly<Record<string, { version_id: string; content_hash: string }>>;
  readonly ai_zones: readonly { zone: string; statements: number; kept_unsupported: number }[];
  readonly passed_by: string;
  readonly passed_at: string;
  /** SHA-256 over the RFC 8785 form of everything above. */
  readonly package_hash: string;
}

/**
 * Builds the package for a document that has just moved to READY_FOR_SUBMISSION. Refuses unless the
 * lifecycle is READY_FOR_SUBMISSION on this very version and the gate passes on these facts.
 */
export function createSubmissionPackage(
  lifecycle: DocumentLifecycle,
  facts: GateFacts,
  passedBy: string,
  passedAt: string,
): SubmissionPackage {
  if (lifecycle.state !== 'READY_FOR_SUBMISSION')
    throw new Error(`The document is ${lifecycle.state}, not READY_FOR_SUBMISSION.`);
  if (lifecycle.context.ready_version_id !== facts.version.id)
    throw new Error('The facts are not for the version that was marked ready.');
  const gate = evaluateGate({ ...facts, document_id: lifecycle.context.document_id });
  if (!gate.passed)
    throw new Error(`The submission gate does not pass: ${gate.failures.map((f) => f.message).join(' ')}`);

  const findings = facts.findings.filter((f) => f.version_id === facts.version.id);
  const ids = new Set(findings.map((f) => f.id));
  const body = {
    document_id: lifecycle.context.document_id,
    version_id: facts.version.id,
    content_hash: facts.version.content_hash,
    template_version_id: facts.template.version_id,
    findings,
    dispositions: facts.dispositions.filter((d) => ids.has(d.finding_id)),
    references: Object.fromEntries(
      facts.references.map((r) => [r.kind, { version_id: r.version_id, content_hash: r.version_hash }]),
    ),
    ai_zones: facts.ai_zones.map((z) => ({
      zone: z.zone,
      statements: z.statements.length,
      kept_unsupported: z.statements.filter((s) => s.source_check !== 'supported').length,
    })),
    passed_by: passedBy,
    passed_at: passedAt,
  };
  const package_hash = createHash('sha256').update(canonicalize(body)).digest('hex');
  return deepFreeze(structuredClone({ ...body, package_hash }));
}

/** Recomputes the package hash; false means the package was changed after it was made. */
export function verifySubmissionPackage(p: SubmissionPackage): boolean {
  const { package_hash, ...body } = p;
  return createHash('sha256').update(canonicalize(body)).digest('hex') === package_hash;
}
