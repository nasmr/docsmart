// Symmetric check of the clause tree (criterion 4 and criterion 1 applied the same way).
// - cond and where are free strings: src/tree.ts types them as string, and src/import-docx.ts
//   accepts anything after IF / WHERE (lines 145, 160, 233: /^IF\s+(.+)$/).
// - Is a slot that names an unbound loop alias reported? (The C1 question, asked of the tree.)
// - Would a small grammar for conditions accept every condition the templates use?
// Run: node src/validation/sym-tree-check.ts
import { createRequire } from 'node:module';
import path from 'node:path';
import { importFile } from '../import-docx.ts';
import type { Block, Inline } from '../tree.ts';
import { save } from './harness.ts';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../../../..');
const gen = path.join(root, 'templates/generator');
const templates = [...require(path.join(gen, 'resolutions.js')), ...require(path.join(gen, 'supplements.js')), ...require(path.join(gen, 'subscriptions.js'))];
const catalogue = require(path.join(root, 'templates/fields/catalogue.json'));

// A proposed grammar: a field path, optionally "= value", optionally prefixed by "any".
const COND = /^(any\s+)?[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+(\s*=\s*[a-z_][a-z0-9_]*)?$/;
const conds = new Map<string, number>();
const unbound: string[] = [];
// Loop aliases used anywhere in the templates (director, signatory, person): a slot whose head is
// one of these is only meaningful inside a FOR EACH that binds it.
const LOOP_ALIASES = new Set<string>();
const out: Record<string, unknown> = {};

function inl(xs: Inline[], aliases: string[], id: string) {
  for (const x of xs) {
    if (x.t === 'slot') check(x.name, aliases, id);
    else if (x.t === 'if') { conds.set(x.cond, (conds.get(x.cond) ?? 0) + 1); inl(x.then, aliases, id); if (x.else) inl(x.else, aliases, id); }
    else if (x.t === 'each') { if (x.where) conds.set(x.where, (conds.get(x.where) ?? 0) + 1); inl(x.body, [...aliases, x.alias], id); }
  }
}
function check(name: string, aliases: string[], id: string) {
  const head = name.split('.')[0] ?? '';
  if (LOOP_ALIASES.has(head) && !aliases.includes(head)) unbound.push(`${id}: {{${name}}} (bound aliases: ${aliases.join(', ') || 'none'})`);
}
function blk(bs: Block[], aliases: string[], id: string) {
  for (const b of bs) {
    if (b.t === 'if') { conds.set(b.cond, (conds.get(b.cond) ?? 0) + 1); blk(b.then, aliases, id); if (b.else) blk(b.else, aliases, id); }
    else if (b.t === 'each') { if (b.where) conds.set(b.where, (conds.get(b.where) ?? 0) + 1); blk(b.body, [...aliases, b.alias], id); }
    else if (b.t === 'table') for (const r of b.rows) { const a = r.t === 'each_row' ? [...aliases, r.alias] : aliases; if (r.t === 'each_row' && r.where) conds.set(r.where, 1); r.cells.forEach((c) => inl(c, a, id)); }
    else if (b.t === 'zone') inl(b.instructions, aliases, id);
    else inl(b.text, aliases, id);
  }
}
const trees: [string, Block[]][] = [];
for (const t of templates) trees.push([t.meta.id, (await importFile(path.join(root, 'templates/first-pass', t.meta.file), t.meta.id)).body]);
const collect = (bs: Block[]): void => bs.forEach((b) => { if (b.t === 'each') { LOOP_ALIASES.add(b.alias); collect(b.body); } else if (b.t === 'if') { collect(b.then); if (b.else) collect(b.else); } else if (b.t === 'table') b.rows.forEach((r) => r.t === 'each_row' && LOOP_ALIASES.add(r.alias)); });
trees.forEach(([, b]) => collect(b));
for (const [id, body] of trees) blk(body, [], id);

const rejected = [...conds.keys()].filter((c) => !COND.test(c));
out.distinctConditions = conds.size;
out.grammarRejects = rejected;
out.unboundAliasSlots = unbound;
console.log(`distinct conditions and WHERE filters in the imported trees: ${conds.size}`);
console.log(`proposed grammar /${COND.source}/ rejects: ${rejected.length ? rejected.join('; ') : 'none'}`);
console.log(`loop aliases: ${[...LOOP_ALIASES].join(', ')}`);
console.log(`slots naming an alias that no enclosing FOR EACH binds (accepted silently by the importer): ${unbound.length}`);
for (const u of unbound) console.log('   ' + u);
out.catalogueFieldCount = Array.isArray(catalogue) ? catalogue.length : Object.keys(catalogue.fields ?? catalogue).length;
save('sym-tree-check', out);
