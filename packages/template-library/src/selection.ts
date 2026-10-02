/**
 * Template selection (build plan B3): jurisdiction × entity type × document class × scope, plus the
 * facts that pick a variant, gives exactly one approved template version. The rules are policy
 * (SVC-POLICY); their conditions use the same closed form as templates.
 */
import type { TemplateVersionRecord } from './approval.js';
import { evaluateFlat } from './conditions.js';

export interface SelectionRule {
  class: string;
  jurisdiction: string;
  entity_type: string;
  scope: 'umbrella' | 'portfolio';
  /** All must hold. Empty for a rule with only one variant. */
  when: string[];
  /** The template the rule picks, e.g. "D12-B". */
  template: string;
}

export interface SelectionRequest {
  class: string;
  jurisdiction: string;
  entity_type: string;
  scope: 'umbrella' | 'portfolio';
  /** Values the rules' conditions test, by field path. */
  facts: Readonly<Record<string, unknown>>;
}

export type Selection =
  | { ok: true; rule: SelectionRule; version: TemplateVersionRecord }
  | { ok: false; reason: string };

export function selectTemplate(
  request: SelectionRequest,
  rules: readonly SelectionRule[],
  versions: readonly TemplateVersionRecord[],
): Selection {
  const candidates = rules.filter(
    (r) =>
      r.class === request.class &&
      r.jurisdiction === request.jurisdiction &&
      r.entity_type === request.entity_type &&
      r.scope === request.scope,
  );
  let matching: SelectionRule[];
  try {
    matching = candidates.filter((r) => r.when.every((c) => evaluateFlat(c, request.facts)));
  } catch (e) {
    return { ok: false, reason: `A selection rule could not be evaluated: ${(e as Error).message}.` };
  }
  const what = `${request.class} (${request.scope}, ${request.entity_type}, ${request.jurisdiction})`;
  if (!matching.length) return { ok: false, reason: `No selection rule matches ${what}.` };
  if (matching.length > 1) {
    return {
      ok: false,
      reason: `More than one selection rule matches ${what}: ${matching.map((r) => r.template).join(', ')}.`,
    };
  }
  const rule = matching[0] as SelectionRule;

  // Approved versions of that template for the jurisdiction, less any an approved later version supersedes.
  const approved = versions.filter(
    (v) => v.template === rule.template && v.status === 'approved' && v.jurisdictions.includes(request.jurisdiction),
  );
  const superseded = new Set(approved.map((v) => v.approval?.supersedes).filter((x): x is string => !!x));
  const current = approved.filter((v) => !superseded.has(v.id));
  if (!current.length)
    return { ok: false, reason: `No approved version of ${rule.template} for ${request.jurisdiction}.` };
  if (current.length > 1) {
    return {
      ok: false,
      reason: `More than one current approved version of ${rule.template}: ${current.map((v) => v.id).join(', ')}.`,
    };
  }
  return { ok: true, rule, version: current[0] as TemplateVersionRecord };
}
