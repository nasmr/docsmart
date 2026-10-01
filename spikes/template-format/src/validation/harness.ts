// Shared harness for the TemplateMark validation scripts.
// Every case parses with @accordproject/markdown-template (or takes a hand-built DOM),
// then generates through @accordproject/template-engine with data, and compares the
// output text with the expected text.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
export const { TemplateMarkTransformer } = require('@accordproject/markdown-template');
export const { TemplateMarkInterpreter } = require('@accordproject/template-engine');
export const { ModelManager } = require('@accordproject/concerto-core');
export const { CiceroMarkTransformer } = require('@accordproject/markdown-cicero');

export const SPIKE = path.resolve(import.meta.dirname, '../..');
export const OUT = path.join(SPIKE, 'validation/out');
// Working directory outside the repository: marker files (c11), footprint installs (c12) and the
// deprecated Word converter (c13). Set SPIKE_SCRATCH to choose it.
export const SCRATCH = process.env.SPIKE_SCRATCH ?? path.join(os.tmpdir(), 'docsmart-template-spike');

export type Kind = 'contract' | 'clause';

export function modelManager(cto: string) {
  const mm = new ModelManager({ strict: true });
  mm.addCTOModel(cto, 'model.cto');
  return mm;
}

export const firstLine = (e: unknown): string => {
  if (Array.isArray(e)) return 'compile errors: ' + JSON.stringify(e).slice(0, 300);
  const m = e instanceof Error ? e.message : typeof e === 'object' ? JSON.stringify(e) : String(e);
  return (m.split('\n')[0] ?? '').slice(0, 300);
};

export function parse(cto: string, content: string, kind: Kind = 'contract'): { ok: boolean; dom?: any; err?: string | undefined } {
  try {
    const dom = new TemplateMarkTransformer().fromMarkdownTemplate({ content }, modelManager(cto), kind, {});
    return { ok: true, dom };
  } catch (e) {
    return { ok: false, err: firstLine(e) };
  }
}

// Node $class short names present in a DOM.
export function nodeTypes(dom: unknown): string[] {
  const s = new Set<string>();
  JSON.stringify(dom, (k, v) => {
    if (k === '$class' && typeof v === 'string') s.add(v.split('.').pop() ?? v);
    return v;
  });
  return [...s];
}

export async function generate(cto: string, dom: any, data: any, options: Record<string, unknown> = {}): Promise<{ ok: boolean; out?: any; md?: string | undefined; text?: string | undefined; err?: string | undefined }> {
  try {
    const mm = modelManager(cto);
    const eng = new TemplateMarkInterpreter(mm, {});
    const res = await eng.generate(structuredClone(dom), data, options);
    const out = JSON.parse(JSON.stringify(res));
    let md: string | undefined;
    try {
      md = new CiceroMarkTransformer().toMarkdown(out);
    } catch (e) {
      md = 'toMarkdown failed: ' + firstLine(e);
    }
    return { ok: true, out, md, text: plainText(out) };
  } catch (e) {
    return { ok: false, err: firstLine(e) };
  }
}

// Our own plain-text reading of AgreementMark: what a reader would see, ignoring layout.
// Conditionals and optionals contribute their selected `nodes`; variables and formulas their value.
export function plainText(node: any): string {
  const blocks: string[] = [];
  const BLOCK = /\.(Paragraph|Heading|Item|CodeBlock|BlockQuote|HtmlBlock|ThematicBreak|TableRow)$/;
  function inline(n: any): string {
    if (!n || typeof n !== 'object') return '';
    const c = String(n.$class ?? '');
    if (/\.Text$/.test(c)) return n.text ?? '';
    if (/\.(Softbreak|Linebreak)$/.test(c)) return ' ';
    if (/\.(Variable|EnumVariable|FormattedVariable|Formula)$/.test(c)) return String(n.value ?? '');
    if (/\.HtmlInline$/.test(c)) return '';
    if (/\.(TableCell|HeaderCell)$/.test(c)) return (n.nodes ?? []).map(inline).join(' ') + ' | ';
    return (n.nodes ?? []).map(inline).join('');
  }
  const isBlock = (c: string) => BLOCK.test(c) || /\.(List|Table|TableHead|TableBody)$/.test(c);
  const INLINE = /\.(Text|Softbreak|Linebreak|Variable|EnumVariable|FormattedVariable|Formula|Emph|Strong|Code|HtmlInline|Link)$/;
  const hasBlockDesc = (n: any): boolean => (n?.nodes ?? []).some((k: any) => isBlock(String(k?.$class ?? '')) || hasBlockDesc(k));
  function walk(n: any) {
    if (!n || typeof n !== 'object') return;
    const c = String(n.$class ?? '');
    const kids: any[] = n.nodes ?? [];
    if (/\.HtmlBlock$/.test(c)) return;
    // A block is one paragraph of text when it has inline children of its own (the engine
    // wraps an inline #with body in a Paragraph), or when nothing below it is a block.
    const directInline = kids.some((k) => INLINE.test(String(k?.$class ?? '')));
    if (BLOCK.test(c) && (directInline || !hasBlockDesc(n) || /\.TableRow$/.test(c))) {
      const t = inline(n).replace(/\s+/g, ' ').trim();
      if (t) blocks.push(t);
      return;
    }
    kids.forEach(walk);
  }
  walk(node);
  return blocks.join('\n');
}

export const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export interface CaseResult {
  id: string;
  name: string;
  kind?: Kind | undefined;
  parse: 'ok' | 'ERROR' | 'n/a';
  parseErr?: string | undefined;
  generate: 'ok' | 'ERROR' | 'skipped';
  genErr?: string | undefined;
  expected?: string | undefined;
  actual?: string | undefined;
  md?: string | undefined; // the engine's own markdown rendering (CiceroMarkTransformer.toMarkdown)
  match?: boolean | undefined;
  note?: string | undefined;
  types?: string[] | undefined;
}

export interface Case {
  id: string;
  name: string;
  cto: string;
  md?: string | undefined;
  dom?: any | undefined; // a hand-built TemplateMark DOM instead of markdown
  kind?: Kind | undefined;
  data: any;
  expected?: string | undefined; // compared after whitespace normalisation, as plain text
  options?: Record<string, unknown> | undefined;
  note?: string | undefined;
}

export async function runCase(c: Case): Promise<CaseResult> {
  const r: CaseResult = { id: c.id, name: c.name, kind: c.kind ?? 'contract', parse: 'n/a', generate: 'skipped', note: c.note };
  let dom = c.dom;
  if (c.md !== undefined) {
    const p = parse(c.cto, c.md, c.kind);
    r.parse = p.ok ? 'ok' : 'ERROR';
    r.parseErr = p.err;
    dom = p.dom;
  }
  if (!dom) return r;
  r.types = nodeTypes(dom).filter((x) => /Definition/.test(x));
  const g = await generate(c.cto, dom, c.data, c.options);
  r.generate = g.ok ? 'ok' : 'ERROR';
  r.genErr = g.err;
  if (g.ok) {
    r.actual = g.text;
    r.md = g.md;
    if (c.expected !== undefined) {
      r.expected = c.expected;
      r.match = norm(g.text ?? '') === norm(c.expected);
    }
  }
  return r;
}

export function print(results: CaseResult[]) {
  for (const r of results) {
    const verdict = r.parse === 'ERROR' ? 'PARSE-ERR' : r.generate === 'ERROR' ? 'GEN-ERR' : r.match === undefined ? 'GEN-OK' : r.match ? 'MATCH' : 'MISMATCH';
    console.log(`${verdict.padEnd(9)} | ${r.id.padEnd(6)} | ${r.kind?.padEnd(8)} | ${r.name}`);
    if (r.parseErr) console.log(`            parse: ${r.parseErr}`);
    if (r.genErr) console.log(`            generate: ${r.genErr}`);
    if (r.match === false) {
      console.log(`            expected: ${JSON.stringify(norm(r.expected ?? ''))}`);
      console.log(`            actual:   ${JSON.stringify(norm(r.actual ?? ''))}`);
      console.log(`            markdown: ${JSON.stringify(r.md ?? '').slice(0, 400)}`);
    } else if (r.generate === 'ok' && r.match === undefined) {
      console.log(`            output:   ${JSON.stringify(norm(r.actual ?? '')).slice(0, 300)}`);
    }
    if (r.note) console.log(`            note: ${r.note}`);
  }
}

export function save(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(data, null, 2));
}

export async function runAll(name: string, cases: Case[], both = false): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of cases) {
    results.push(await runCase(c));
    if (both && c.md !== undefined && !c.kind) results.push(await runCase({ ...c, kind: 'clause' }));
  }
  print(results);
  save(name, results);
  return results;
}

// Static "no code nodes" check (C11). In the TemplateMark model the only code-bearing type is
// Code (FormulaDefinition.code, ClauseDefinition.condition, ConditionalDefinition.condition,
// ConditionalBlockDefinition.condition). Also rejects $class values outside the CommonMark /
// TemplateMark / metamodel namespaces, and names that are not plain identifiers (names reach jsonpath).
export function codeNodes(dom: unknown): string[] {
  const found: string[] = [];
  const NAME = /^[a-zA-Z_][a-zA-Z0-9_]+$/;
  (function walk(n: any, p: string) {
    if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${p}/${i}`));
    if (!n || typeof n !== 'object') return;
    const c = String(n.$class ?? '');
    if (/\.Code$/.test(c) || /\.FormulaDefinition$/.test(c)) found.push(`${p}: ${c.split('.').pop()}`);
    if (c && !/^org\.accordproject\.(commonmark@0\.5\.0|templatemark@0\.5\.0|concerto\.metamodel@1\.0\.0)\./.test(c)) found.push(`${p}: unexpected $class ${c}`);
    if (/Definition$/.test(c) && typeof n.name === 'string' && !NAME.test(n.name) && n.name !== 'top' && n.name !== 'this') found.push(`${p}: bad name ${JSON.stringify(n.name)}`);
    for (const [k, v] of Object.entries(n)) if (k !== '$class') walk(v, `${p}/${k}`);
  })(dom, '');
  return found;
}
