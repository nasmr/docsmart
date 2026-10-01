// Test 1: importing each first-pass Word file gives a tree whose fields, conditions, lists,
// zones, locked wording and placeholders match what the generator put in, each with the
// same nesting (compared as multisets, since the generator records in construction order).
// Test 2: importing the same file twice gives the same content hash.
// Run: node src/check-import.ts
import { createRequire } from 'node:module';
import path from 'node:path';
import { importFile } from './import-docx.ts';
import { type Block, contentHash, type Inline, inlineText, type TemplateTree } from './tree.ts';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../../..');
const gen = path.join(root, 'templates/generator');
const { scan, usage } = require(path.join(gen, 'lib.js'));
const templates = [
  ...require(path.join(gen, 'resolutions.js')),
  ...require(path.join(gen, 'supplements.js')),
  ...require(path.join(gen, 'subscriptions.js')),
];

type Rec = [kind: string, name: string, context: string];

// Mirrors lib.js: a condition is recorded outside its own block; a list is recorded outside
// its loop, and a WHERE inside the loop but before the WHERE applies.
const each = (alias: string, list: string, where?: string) => `EACH ${alias} IN ${list}` + (where ? ` WHERE ${where}` : '');

function fromInline(xs: Inline[], ctx: string[], out: Rec[]) {
  const rec = (k: string, n: string, c = ctx) => out.push([k, n, c.join(' > ')]);
  for (const x of xs) {
    if (x.t === 'slot') rec('field', x.name);
    else if (x.t === 'raw') rec('placeholder', x.v.slice(2, -2).trim());
    else if (x.t === 'if') {
      rec('condition', x.cond);
      fromInline(x.then, [...ctx, x.cond], out);
      if (x.else) fromInline(x.else, [...ctx, 'NOT ' + x.cond], out);
    } else if (x.t === 'each') {
      rec('list', x.list);
      if (x.where) rec('condition', x.where, [...ctx, each(x.alias, x.list)]);
      fromInline(x.body, [...ctx, each(x.alias, x.list, x.where)], out);
    }
  }
}

export function records(blocks: Block[], ctx: string[] = [], out: Rec[] = []): Rec[] {
  const rec = (k: string, n: string, c = ctx) => out.push([k, n, c.join(' > ')]);
  for (const b of blocks) {
    switch (b.t) {
      case 'if':
        rec('condition', b.cond);
        records(b.then, [...ctx, b.cond], out);
        if (b.else) records(b.else, [...ctx, 'NOT ' + b.cond], out);
        break;
      case 'each':
        rec('list', b.list);
        if (b.where) rec('condition', b.where, [...ctx, each(b.alias, b.list)]);
        records(b.body, [...ctx, each(b.alias, b.list, b.where)], out);
        break;
      case 'zone':
        rec('zone', b.zone);
        fromInline(b.instructions, ctx, out);
        break;
      case 'locked':
        rec('locked', inlineText(b.text));
        fromInline(b.text, ctx, out);
        break;
      case 'table':
        for (const r of b.rows) {
          if (r.t === 'each_row') {
            rec('list', r.list);
            if (r.where) rec('condition', r.where, [...ctx, each(r.alias, r.list)]);
            for (const c of r.cells) fromInline(c, [...ctx, each(r.alias, r.list, r.where)], out);
          } else for (const c of r.cells) fromInline(c, ctx, out);
        }
        break;
      default:
        fromInline(b.text, ctx, out);
    }
  }
  return out;
}

const count = (bs: Block[], t: string): number =>
  bs.reduce((n, b) => {
    if (b.t === 'if') return n + count(b.then, t) + (b.else ? count(b.else, t) : 0);
    if (b.t === 'each') return n + count(b.body, t);
    return n + (b.t === t ? 1 : 0);
  }, 0);

let failed = 0;
const trees: Record<string, TemplateTree> = {};
for (const t of templates) {
  const id: string = t.meta.id;
  usage.length = 0;
  scan(t.meta, t.body);
  const expected: Rec[] = usage.map((u: { kind: string; name: string; context: string[] }) => [u.kind, u.name, u.context.join(' > ')]);
  const file = path.join(root, 'templates/first-pass', t.meta.file);
  const tree = await importFile(file, id);
  const again = await importFile(file, id);
  trees[id] = tree;
  // Compared as multisets: the generator records in construction order, not document order.
  const key = (r: Rec) => r.join(' | ');
  const got = records(tree.body);
  const a = got.map(key).sort();
  const e = expected.map(key).sort();
  const missing = e.filter((x) => !a.includes(x));
  const extra = a.filter((x) => !e.includes(x));
  const firstDiff = JSON.stringify(a) === JSON.stringify(e) ? -1 : 0;
  const same = contentHash(tree) === contentHash(again);
  const ok = firstDiff === -1 && same;
  if (!ok) failed++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(7)} records ${String(got.length).padStart(3)}/${String(expected.length).padEnd(3)}` +
      ` headings ${count(tree.body, 'heading')} clauses ${count(tree.body, 'clause')} tables ${count(tree.body, 'table')}` +
      ` notes ${count(tree.body, 'note')} hash-stable ${same} ${contentHash(tree).slice(0, 12)}`,
  );
  if (firstDiff !== -1) console.log('     missing:', missing.slice(0, 4), '\n     extra:', extra.slice(0, 4));
}
console.log(failed ? `${failed} template(s) failed` : 'all templates round-trip');
process.exitCode = failed ? 1 : 0;
export { trees };
