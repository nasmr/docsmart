// C11: how formulas and condition= code are compiled and run, proved with a harmless side
// effect: each formula writes a marker file into the session scratch directory, nothing else.
//
// Mechanism (installed source):
// - parse only stores the code string: markdown-template/lib/templaterules.js:52-68 (formula),
//   69-88 (#if condition=), 189-205 (#clause condition=).
// - generate compiles TS -> JS with the TypeScript compiler via @typescript/twoslash:
//   template-engine/lib/TemplateMarkToJavaScriptCompiler.js:26-30 (CODE_NODES), :49-96;
//   TypeScriptToJavaScriptCompiler.js:119 (require('typescript')), :164 (twoslasher).
// - then runs it: TemplateMarkInterpreter.js:153-181 (evaluateUserCode) -> :60-98
//   (evaluateJavaScript) -> JavaScriptEvaluator.js:59-70 evalDangerously = new Function(...) in
//   the host process (the default), or JavaScriptEvaluator.js:181-238 + worker.js:27-44,
//   a forked Node child process that again uses new Function. Neither is a sandbox.
// - options.disableJavaScriptEvaluation makes evaluateJavaScript throw (TemplateMarkInterpreter.js:61-63).
// Run: node src/validation/c11-code-execution.ts
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { codeNodes, generate, parse, save, SCRATCH } from './harness.ts';

const require = createRequire(import.meta.url);
const DIR = path.join(SCRATCH, 'c11-markers');
mkdirSync(DIR, { recursive: true });
for (const f of ['parse', 'inproc', 'child', 'disabled', 'cond-if', 'cond-clause', 'cond-false']) rmSync(path.join(DIR, f + '.txt'), { force: true });

const NS = 'org.docsmart.v@1.0.0';
const CTO = `namespace ${NS}\nconcept Asset2 { o String issuer_name }\n@template\nconcept D { o String name  o Boolean flag  o Asset2 asset }`;
const data = { $class: `${NS}.D`, name: 'Atlas', flag: false, asset: { $class: `${NS}.Asset2`, issuer_name: 'Kestrel' } };
// The only side effect: write a small marker file into the scratch directory.
const write = (f: string) => `(globalThis as any).process.getBuiltinModule('fs').writeFileSync('${path.join(DIR, f + '.txt')}', 'formula ran in pid ' + (globalThis as any).process.pid)`;
const marker = (f: string) => existsSync(path.join(DIR, f + '.txt'));
const out: Record<string, unknown> = { hostPid: process.pid };

// 1. Does parsing alone execute code?
{
  const p = parse(CTO, `Name {{name}}. {{% ${write('parse')}; return 'x' %}}`);
  out.parseOnly = { parse: p.ok ? 'ok' : p.err, markerWritten: marker('parse') };
  console.log(`1. parse only: ${p.ok ? 'ok' : p.err}; marker written: ${marker('parse')}`);
}
// 2. Default generation (evalDangerously, in process)
{
  const p = parse(CTO, `Name {{name}}. {{% ${write('inproc')}; return 'x' %}}`);
  const g = await generate(CTO, p.dom, data);
  const pid = marker('inproc') ? require('node:fs').readFileSync(path.join(DIR, 'inproc.txt'), 'utf8') : '';
  out.inProcess = { generate: g.ok ? 'ok' : g.err, markerWritten: marker('inproc'), marker: pid };
  console.log(`2. generate, default options: ${g.ok ? 'ok' : g.err}; marker written: ${marker('inproc')} (${pid}; host pid ${process.pid})`);
}
// 3. childProcessJavaScriptEvaluation: true (the README's "recommended for untrusted template content")
{
  const p = parse(CTO, `Name {{name}}. {{% ${write('child')}; return 'x' %}}`);
  const g = await generate(CTO, p.dom, data, { childProcessJavaScriptEvaluation: true, timeout: 20000 });
  const pid = marker('child') ? require('node:fs').readFileSync(path.join(DIR, 'child.txt'), 'utf8') : '';
  out.childProcess = { generate: g.ok ? 'ok' : g.err, markerWritten: marker('child'), marker: pid };
  console.log(`3. generate, childProcessJavaScriptEvaluation: ${g.ok ? 'ok' : g.err}; marker written: ${marker('child')} (${pid})`);
}
// 4. disableJavaScriptEvaluation: true
{
  const p = parse(CTO, `Name {{name}}. {{% ${write('disabled')}; return 'x' %}}`);
  const g = await generate(CTO, p.dom, data, { disableJavaScriptEvaluation: true });
  out.disabled = { generate: g.ok ? 'ok' : g.err, markerWritten: marker('disabled') };
  console.log(`4. generate, disableJavaScriptEvaluation: ${g.ok ? 'ok' : g.err}; marker written: ${marker('disabled')}`);
  const p2 = parse(CTO, 'Name {{name}}.{{#if flag}} Flag.{{/if}}{{#with asset}} {{issuer_name}}.{{/with}}');
  const g2 = await generate(CTO, p2.dom, data, { disableJavaScriptEvaluation: true });
  out.disabledDataOnly = { generate: g2.ok ? 'ok' : g2.err, text: g2.text };
  console.log(`   a data-only template with evaluation disabled: ${g2.ok ? 'ok ' + JSON.stringify(g2.text) : g2.err}`);
}
// 5. condition= code runs too (not only formulas), including in a branch whose result is false
{
  const p = parse(CTO, `A{{#if flag condition="${write('cond-if').replace(/"/g, "'")}; return true"}} B{{/if}}.`);
  const g = await generate(CTO, p.dom, data);
  out.conditionIf = { parse: p.ok ? 'ok' : p.err, generate: g.ok ? 'ok' : g.err, markerWritten: marker('cond-if') };
  console.log(`5a. #if condition= : parse ${p.ok ? 'ok' : p.err}; generate ${g.ok ? 'ok' : g.err}; marker written: ${marker('cond-if')}`);
  const p2 = parse(CTO, `{{#clause asset condition="${write('cond-clause')}; return true"}}\nText {{issuer_name}}.\n{{/clause}}`);
  const g2 = await generate(CTO, p2.dom, data);
  out.conditionClause = { parse: p2.ok ? 'ok' : p2.err, generate: g2.ok ? 'ok' : g2.err, markerWritten: marker('cond-clause') };
  console.log(`5b. #clause condition= : parse ${p2.ok ? 'ok' : p2.err}; generate ${g2.ok ? 'ok' : g2.err}; marker written: ${marker('cond-clause')}`);
  // A formula inside a clause whose condition is false is still evaluated (evaluateUserCode walks every node).
  const p3 = parse(CTO, `{{#clause asset condition="return false"}}\nText {{% ${write('cond-false')}; return 'x' %}}.\n{{/clause}}`);
  const g3 = await generate(CTO, p3.dom, data);
  out.formulaInFalseClause = { generate: g3.ok ? 'ok' : g3.err, markerWritten: marker('cond-false'), text: g3.text };
  console.log(`5c. formula inside a #clause whose condition is false: generate ${g3.ok ? 'ok' : g3.err}; marker written: ${marker('cond-false')}`);
}

// 6. Static "no code nodes" check. In the TemplateMark model (markdown-common TemplateMarkModel)
// the only code-bearing type is Code, used by FormulaDefinition.code, ClauseDefinition.condition,
// ConditionalDefinition.condition and ConditionalBlockDefinition.condition. The serialiser
// rejects properties not in the model (see c7 C7.6), so a $class-based scan is complete for
// code in the DOM. Names also reach jsonpath (see 7), so the check must also enforce the
// identifier syntax on every name.
const { TemplateMarkModel } = require('@accordproject/markdown-common');
const codeFields = [...String(TemplateMarkModel.MODEL).matchAll(/concept (\w+)[^{]*\{([^}]*)\}/g)].flatMap((m) => [...(m[2] ?? '').matchAll(/o Code(\[\])? (\w+)/g)].map((f) => `${m[1]}.${f[2]}`));
out.codeFieldsInModel = codeFields;
console.log('6. Code-typed fields in the TemplateMark model:', codeFields.join(', '));
for (const [label, md] of [
  ['data-only', 'Name {{name}}.{{#if flag}} Flag.{{/if}}'],
  ['formula', 'Name {{% return name %}}.'],
  ['#if condition=', 'A{{#if flag condition="return true"}} B{{/if}}.'],
  ['#clause condition=', '{{#clause asset condition="return true"}}\nText.\n{{/clause}}'],
] as const) {
  const p = parse(CTO, md);
  const f = codeNodes(p.dom);
  console.log(`   static check, ${label}: ${f.length ? 'REJECT ' + f.join('; ') : 'pass'}`);
  (out.staticCheck ??= {} as any)[label] = f;
}

// 7. Names flow into jsonpath, which evaluates script expressions with static-eval
// (node_modules/jsonpath/lib/handlers.js:3, :388-392). getJsonPath only rejects '.' in names
// (TemplateMarkInterpreter.js:117-120). A hand-built DOM with a crafted name:
{
  const p = parse(CTO, 'Name {{name}}.');
  const dom = structuredClone(p.dom);
  dom.nodes[0].nodes[0].nodes[1].name = "name'][(@['length']>0 ? 'x' : 'y')]['z";
  const g = await generate(CTO, dom, data);
  out.jsonpathName = { generate: g.ok ? 'ok' : g.err, staticCheck: codeNodes(dom) };
  console.log(`7. crafted variable name reaching jsonpath: generate ${g.ok ? 'ok ' + JSON.stringify(g.text) : g.err}; static check: ${codeNodes(dom).join('; ')}`);
}
save('c11-code-execution', out);
