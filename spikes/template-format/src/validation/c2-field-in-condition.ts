// C2: a field inside a condition. Reproduce, then try every alternative.
// The typing rule is in node_modules/@accordproject/markdown-template/lib/TypeVisitor.js:247-268:
// an #if body is typed against the Boolean property itself (whenTrue) or against nothing
// (whenFalse), so no variable can be typed inside either branch.
// Run: node src/validation/c2-field-in-condition.ts
import { type Case, generate, norm, parse, runAll, save } from './harness.ts';

const NS = 'org.docsmart.v@1.0.0';
const CTO = `
namespace ${NS}
concept Hurdle { o String rate }
concept Terms {
  o Boolean has_hurdle
  o String hurdle_rate
  o String fee_basis
  o Hurdle hurdle optional
  o String hurdle_rate_opt optional
}
@template
concept D { o Terms terms  o Boolean has_hurdle  o String hurdle_rate  o String perf_fee_rate  o Hurdle hurdle optional  o String hurdle_rate_opt optional }
`;
function data(withHurdle: boolean) {
  const h = withHurdle ? { hurdle: { $class: `${NS}.Hurdle`, rate: '8%' }, hurdle_rate_opt: '8%' } : {};
  return {
    $class: `${NS}.D`,
    terms: { $class: `${NS}.Terms`, has_hurdle: withHurdle, hurdle_rate: '8%', fee_basis: 'subscribed capital', ...h },
    has_hurdle: withHurdle,
    hurdle_rate: '8%',
    perf_fee_rate: '15%',
    ...h,
  };
}
const T = data(true);
const F = data(false);
const yes = '15% of profits plus a return of 8% a year.';
const no = '15% of profits.';

const cases: Case[] = [
  // Reproduce the README's two forms.
  { id: 'C2.1', name: 'inline, field inside #if, inside #with', cto: CTO, data: T, md: '{{#with terms}}fee{{#if has_hurdle}} plus {{hurdle_rate}}{{/if}}.{{/with}}', expected: 'fee plus 8%.' },
  { id: 'C2.2', name: '"block" form (lines inside #with)', cto: CTO, data: T, md: '{{#with terms}}\n{{#if has_hurdle}}\nplus a return of {{hurdle_rate}} a year\n{{/if}}\n{{/with}}', expected: 'plus a return of 8% a year' },
  { id: 'C2.3', name: 'top-level field inside #if (no #with)', cto: CTO, data: T, md: '{{perf_fee_rate}} of profits{{#if has_hurdle}} plus a return of {{hurdle_rate}} a year{{/if}}.', expected: yes },
  // Alternatives.
  { id: 'C2.4', name: 'field in the else branch', cto: CTO, data: F, md: '{{perf_fee_rate}} of profits{{#if has_hurdle}} plus a hurdle{{else}} on {{hurdle_rate}}{{/if}}.', expected: '15% of profits on 8%.' },
  { id: 'C2.5', name: '#with inside #if', cto: CTO, data: T, md: '{{perf_fee_rate}} of profits{{#if has_hurdle}} plus a return of {{#with terms}}{{hurdle_rate}}{{/with}} a year{{/if}}.', expected: yes },
  { id: 'C2.6', name: '#if inside #clause', cto: CTO, data: T, md: '{{#clause terms}}\nFee{{#if has_hurdle}} plus {{hurdle_rate}}{{/if}}.\n{{/clause}}', expected: 'Fee plus 8%.' },
  { id: 'C2.7a', name: '#optional over an optional concept, present', cto: CTO, data: T, md: '{{perf_fee_rate}} of profits{{#optional hurdle}} plus a return of {{rate}} a year{{/optional}}.', expected: yes },
  { id: 'C2.7b', name: '#optional over an optional concept, absent', cto: CTO, data: F, md: '{{perf_fee_rate}} of profits{{#optional hurdle}} plus a return of {{rate}} a year{{/optional}}.', expected: no },
  { id: 'C2.7c', name: '#optional with else, absent', cto: CTO, data: F, md: '{{perf_fee_rate}} of profits{{#optional hurdle}} plus a return of {{rate}} a year{{else}} (no hurdle){{/optional}}.', expected: '15% of profits (no hurdle).' },
  { id: 'C2.7d', name: '#optional inside #with (nested concept), present', cto: CTO, data: T, md: '{{#with terms}}on {{fee_basis}}{{#optional hurdle}} plus {{rate}}{{/optional}}{{/with}}.', expected: 'on subscribed capital plus 8%.' },
  { id: 'C2.8a', name: '#optional over an optional scalar, {{this}}, present', cto: CTO, data: T, md: '{{perf_fee_rate}} of profits{{#optional hurdle_rate_opt}} plus a return of {{this}} a year{{/optional}}.', expected: yes },
  { id: 'C2.8b', name: '#optional over an optional scalar, {{this}}, absent', cto: CTO, data: F, md: '{{perf_fee_rate}} of profits{{#optional hurdle_rate_opt}} plus a return of {{this}} a year{{/optional}}.', expected: no },
  { id: 'C2.9a', name: '#clause over an optional concept (block), present', cto: CTO, data: T, md: '{{perf_fee_rate}} of profits.\n\n{{#clause hurdle}}\nInvestors first receive a return of {{rate}} a year.\n{{/clause}}', expected: '15% of profits.\nInvestors first receive a return of 8% a year.' },
  { id: 'C2.9b', name: '#clause over an optional concept (block), absent', cto: CTO, data: F, md: '{{perf_fee_rate}} of profits.\n\n{{#clause hurdle}}\nInvestors first receive a return of {{rate}} a year.\n{{/clause}}', expected: '15% of profits.' },
  { id: 'C2.10', name: 'formula inside #if (code)', cto: CTO, data: T, md: '{{perf_fee_rate}} of profits{{#if has_hurdle}} plus a return of {{% return hurdle_rate %}} a year{{/if}}.', expected: yes },
  { id: 'C2.10b', name: 'control: the same formula outside any block', cto: CTO, data: T, md: '{{perf_fee_rate}} of profits plus a return of {{% return hurdle_rate %}} a year.', expected: yes },
  { id: 'C2.10c', name: 'formula inside #optional', cto: CTO, data: T, md: '{{perf_fee_rate}} of profits{{#optional hurdle}} plus a return of {{% return hurdle_rate %}} a year{{/optional}}.', expected: yes },
  { id: 'C2.10d', name: 'formula inside #clause (block)', cto: CTO, data: T, md: '{{#clause terms}}\nA return of {{% return hurdle_rate %}} a year.\n{{/clause}}', expected: 'A return of 8% a year.' },
];

const results = await runAll('c2-field-in-condition', cases, true);

// C2.11: hand-built DOM. Is the limit in the parser's typer or in the engine? Parse a template
// with the variable outside the #if (so it is typed), then move it into whenTrue and generate.
const md = '{{perf_fee_rate}} of profits{{#if has_hurdle}} plus a return of {{/if}}{{hurdle_rate}} a year.';
const p = parse(CTO, md);
const para = p.dom.nodes[0].nodes[0];
const ifIdx = para.nodes.findIndex((n: any) => /ConditionalDefinition$/.test(n.$class));
const cond = para.nodes[ifIdx];
const moved = para.nodes.splice(ifIdx + 1, 2); // the variable and " a year."
cond.whenTrue.push(...moved);
const hb: Record<string, unknown> = {};
for (const [label, d, exp] of [['true', T, yes], ['false', F, '15% of profits']] as const) {
  const g = await generate(CTO, p.dom, d);
  hb[label] = { ok: g.ok, err: g.err, text: g.text, match: g.ok && norm(g.text ?? '') === norm(exp) };
  console.log(`C2.11 hand-built DOM, variable inside whenTrue, has_hurdle=${label}: ${g.ok ? (norm(g.text ?? '') === norm(exp) ? 'MATCH' : 'MISMATCH ' + JSON.stringify(g.text)) : 'GEN-ERR ' + g.err}`);
}
save('c2-hand-built-dom', { dom: p.dom, results: hb });
