/**
 * The submission gate (build plan §4): the conditions one version must meet before the document
 * can move to READY_FOR_SUBMISSION. Pure: the API gathers the facts and enforces the result.
 */
import type {
  CheckId,
  Disposition,
  DocumentClass,
  DocumentState,
  Finding,
  TemplateVersionStatus,
} from './documents.js';

export interface GateFacts {
  document_id: string;
  document_class: DocumentClass;
  version: { id: string; document_id: string; content_hash: string };
  /** The document's latest version (condition 9). */
  latest_version_id: string;
  template: { version_id: string; status: TemplateVersionStatus };
  /** Checks policy requires for this class, and the checks that actually ran on this version. */
  checks_required: CheckId[];
  checks_run: CheckId[];
  findings: Finding[];
  dispositions: Disposition[];
  ai_zones: AiZoneFacts[];
  /** Documents this one is built on (for D1-SP: U3 and D13). */
  references: ReferenceFacts[];
}

export interface AiZoneFacts {
  zone: string;
  guardrail: 'passed' | 'blocked' | 'not_run';
  statements: Array<{
    id: string;
    source_check: 'supported' | 'unsupported' | 'contradicted' | 'not_run';
    /** The review finding raised for an unsupported statement. */
    finding_id?: string;
  }>;
}

export interface ReferenceFacts {
  kind: 'U3' | 'D13';
  document_id: string;
  version_id: string;
  state: DocumentState;
  /** The hash recorded in this version when it was assembled. */
  recorded_hash: string;
  /** The referenced version's own content hash. */
  version_hash: string;
  /** The referenced document's latest frozen version. */
  latest_frozen_version_id: string;
}

/**
 * States a referenced U3 or D13 must be in. The addendum (§4.2) requires CLEARED, which this slice
 * cannot reach, so READY_FOR_SUBMISSION stands in until field-catalogue gap G11 is decided.
 */
export const REFERENCE_STATES_ACCEPTED: readonly DocumentState[] = ['READY_FOR_SUBMISSION'];

/** Which documents each class is built on (addendum §4.2). */
export const REQUIRED_REFERENCES: Record<DocumentClass, ReadonlyArray<'U3' | 'D13'>> = {
  U3: [],
  D12: [],
  D13: [],
  'D1-SP': ['U3', 'D13'],
};

/** Findings from these checks fail the gate whatever their severity or disposition: they are invariants. */
const INVARIANT_CHECKS: Partial<Record<CheckId, 2 | 3 | 4>> = {
  required_slot: 2, // build plan §4 condition 2
  contracting_party: 3, // INV-9
  cross_portfolio: 4, // INV-10
};

export type GateCondition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface GateFailure {
  /** Build plan §4 condition number; 0 for facts that do not belong to this document. */
  condition: GateCondition;
  message: string;
  /** Finding, zone, statement or document ids the failure is about. */
  refs: string[];
}

export interface GateResult {
  passed: boolean;
  failures: GateFailure[];
}

export function evaluateGate(f: GateFacts): GateResult {
  const failures: GateFailure[] = [];
  const fail = (condition: GateCondition, message: string, refs: string[] = []) =>
    failures.push({ condition, message, refs });

  if (f.version.document_id !== f.document_id) {
    fail(0, 'The version belongs to a different document.', [f.version.id]);
  }

  // 1. Assembled from an approved template version that is not retired.
  if (f.template.status !== 'approved') {
    fail(1, `The template version it was assembled from is ${f.template.status}, not approved.`, [
      f.template.version_id,
    ]);
  }

  // Only findings on this version count.
  const foreign = f.findings.filter((x) => x.version_id !== f.version.id);
  if (foreign.length)
    fail(
      0,
      'Findings from another version were supplied.',
      foreign.map((x) => x.id),
    );
  const findings = f.findings.filter((x) => x.version_id === f.version.id);

  // 2, 3, 4. Required slots, contracting-party wording, other portfolios: any finding fails.
  for (const condition of [2, 3, 4] as const) {
    const hits = findings.filter((x) => INVARIANT_CHECKS[x.check] === condition);
    if (hits.length)
      fail(
        condition,
        conditionMessage(condition, hits.length),
        hits.map((x) => x.id),
      );
  }

  // 5. No blocking finding open, and every required check actually ran: a check that did not run
  //    cannot have found anything, so it must never pass silently (build plan B6).
  const notRun = f.checks_required.filter((c) => !f.checks_run.includes(c));
  if (notRun.length) fail(5, `Required checks did not run on this version: ${notRun.join(', ')}.`, notRun);
  const blocking = findings.filter((x) => x.severity === 'blocks' && INVARIANT_CHECKS[x.check] === undefined);
  if (blocking.length) {
    fail(
      5,
      `${blocking.length} blocking finding(s) are open. Blocking findings can only be fixed.`,
      blocking.map((x) => x.id),
    );
  }

  // 6. Every review finding has the sponsor's decision to keep it, with a reason.
  const kept = new Set(
    f.dispositions.filter((d) => d.decision === 'keep' && d.reason.trim() !== '').map((d) => d.finding_id),
  );
  const undecided = findings.filter(
    (x) => x.severity === 'review' && INVARIANT_CHECKS[x.check] === undefined && !kept.has(x.id),
  );
  if (undecided.length) {
    fail(
      6,
      `${undecided.length} review finding(s) need a decision to keep, with a reason.`,
      undecided.map((x) => x.id),
    );
  }

  // 7. AI-drafted sections passed the guardrail check; every statement is supported or kept with a reason.
  for (const z of f.ai_zones) {
    if (z.guardrail !== 'passed')
      fail(7, `AI zone ${z.zone}: the guardrail check ${z.guardrail === 'blocked' ? 'blocked it' : 'did not run'}.`, [
        z.zone,
      ]);
    for (const s of z.statements) {
      if (s.source_check === 'supported') continue;
      if (s.source_check === 'not_run')
        fail(7, `AI zone ${z.zone}: statement ${s.id} has not been source-checked.`, [s.id]);
      else if (!s.finding_id || !kept.has(s.finding_id)) {
        fail(7, `AI zone ${z.zone}: statement ${s.id} is ${s.source_check} and has not been kept with a reason.`, [
          s.id,
        ]);
      }
    }
  }

  // 8. Documents it is built on are in the required state, current, and recorded by hash.
  for (const kind of REQUIRED_REFERENCES[f.document_class]) {
    const refs = f.references.filter((r) => r.kind === kind);
    const ref = refs[0];
    if (!ref) {
      fail(8, `No ${kind} version is referenced.`);
      continue;
    }
    if (refs.length > 1)
      fail(
        8,
        `More than one ${kind} version is referenced.`,
        refs.map((r) => r.version_id),
      );
    if (!REFERENCE_STATES_ACCEPTED.includes(ref.state)) {
      fail(8, `The referenced ${kind} is ${ref.state}, not ${REFERENCE_STATES_ACCEPTED.join(' or ')}.`, [
        ref.document_id,
      ]);
    }
    if (ref.version_id !== ref.latest_frozen_version_id) {
      fail(8, `The referenced ${kind} version is not its latest frozen version.`, [ref.version_id]);
    }
    if (ref.recorded_hash !== ref.version_hash) {
      fail(8, `The recorded ${kind} hash does not match that version's content.`, [ref.version_id]);
    }
  }

  // 9. It is the latest version of the document.
  if (f.version.id !== f.latest_version_id) fail(9, 'A later version of this document exists.', [f.version.id]);

  return { passed: failures.length === 0, failures };
}

function conditionMessage(condition: 2 | 3 | 4, n: number): string {
  if (condition === 2) return `${n} required slot(s) are missing or invalid.`;
  if (condition === 3) return 'The contracting-party wording does not match the registry (INV-9).';
  return `${n} reference(s) to another portfolio (INV-10).`;
}
