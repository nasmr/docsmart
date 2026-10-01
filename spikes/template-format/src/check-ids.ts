// Test 3: clause tree → Word → clause tree gives the identical hash (ids travel as bookmarks).
// Test 4: ids survive the edits counsel makes in Word; a lost bookmark is recovered by
// matching against the previous version.
// Run: node src/check-ids.ts
import { createRequire } from 'node:module';
import path from 'node:path';
import { duplicateOf, importDocx, importFile } from './import-docx.ts';
import { renderDocx, xmlBuilder, xmlParser } from './render.ts';
import { type Block, blockText, contentHash, idBlocks, type TemplateTree } from './tree.ts';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const root = path.resolve(import.meta.dirname, '../../..');
const gen = path.join(root, 'templates/generator');
const templates = [
  ...require(path.join(gen, 'resolutions.js')),
  ...require(path.join(gen, 'supplements.js')),
  ...require(path.join(gen, 'subscriptions.js')),
];

let failed = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

// ---------- test 3: round trip through Word ----------
const rendered: Record<string, Buffer> = {};
const trees: Record<string, TemplateTree> = {};
for (const t of templates) {
  const tree = await importFile(path.join(root, 'templates/first-pass', t.meta.file), t.meta.id);
  const docx = await renderDocx(tree, t.meta);
  const back = await importDocx(docx, t.meta.id);
  rendered[t.meta.id] = docx;
  trees[t.meta.id] = tree;
  check(contentHash(back) === contentHash(tree), `${t.meta.id}: tree → Word → tree gives the same hash`);
}

// Ids must travel as bookmarks, not be recomputed from content: give every block an id that
// cannot be derived from its text and check the same ids come back.
for (const t of templates) {
  const tree = structuredClone(trees[t.meta.id]) as TemplateTree;
  let n = 0;
  for (const b of idBlocks(tree.body)) b.id = `x${String(n++).padStart(4, '0')}`;
  const back = await importDocx(await renderDocx(tree, t.meta), t.meta.id);
  check(contentHash(back) === contentHash(tree), `${t.meta.id}: arbitrary ids survive the trip through Word`);
}

// ---------- test 4: counsel edits D12-A in Word ----------
type N = Record<string, unknown>;
const tagOf = (n: N) => Object.keys(n).find((k) => k !== ':@') ?? '';
const textOf = (p: N): string =>
  ((p['w:p'] as N[]) ?? [])
    .filter((r) => tagOf(r) === 'w:r')
    .flatMap((r) => r['w:r'] as N[])
    .map((x) => (tagOf(x) === 'w:t' ? (x['w:t'] as N[]).map((y) => String(y['#text'] ?? '')).join('') : tagOf(x) === 'w:tab' ? '\t' : ''))
    .join('');

async function editDocx(docx: Buffer, edit: (paras: N[], body: N[]) => void): Promise<Buffer> {
  const zip = await JSZip.loadAsync(docx);
  const doc = xmlParser.parse(await zip.file('word/document.xml').async('string'));
  const document = doc.find((n: N) => tagOf(n) === 'w:document');
  const bodyNode = (document['w:document'] as N[]).find((n) => tagOf(n) === 'w:body') as N;
  const body = bodyNode['w:body'] as N[];
  edit(
    body.filter((n) => tagOf(n) === 'w:p'),
    body,
  );
  zip.file('word/document.xml', xmlBuilder.build(doc));
  return zip.generateAsync({ type: 'nodebuffer' });
}
const para = (paras: N[], start: string) => {
  const p = paras.find((x) => textOf(x).startsWith(start));
  if (!p) throw new Error('no paragraph starting ' + JSON.stringify(start));
  return p;
};
const appendRun = (p: N, s: string) => (p['w:p'] as N[]).push({ 'w:r': [{ 'w:t': [{ '#text': s }], ':@': { 'xml:space': 'preserve' } }] });
const setText = (p: N, s: string) => {
  p['w:p'] = (p['w:p'] as N[]).filter((r) => tagOf(r) !== 'w:r');
  appendRun(p, s);
};
const stripBookmarks = (p: N) => {
  p['w:p'] = (p['w:p'] as N[]).filter((r) => !['w:bookmarkStart', 'w:bookmarkEnd'].includes(tagOf(r)));
};
const clone = (p: N): N => structuredClone(p);

// Adopt a previous version's id for a block whose bookmark was lost, when its text is close
// to a block of the same kind that has disappeared from the new version.
function reconcile(prev: TemplateTree, next: TemplateTree): number {
  const words = (s: string) => new Set(s.toLowerCase().match(/[\w{}.]+/g) ?? []);
  const sim = (a: string, b: string) => {
    const x = words(a);
    const y = words(b);
    const inter = [...x].filter((w) => y.has(w)).length;
    return inter / Math.max(1, new Set([...x, ...y]).size);
  };
  const prevById = new Map([...idBlocks(prev.body)].map((b) => [b.id, b] as const));
  // Pasted copies: of all blocks that carried the same bookmark, the one closest to the
  // previous version's text keeps the id; the others keep their new ids.
  const nextBlocks = [...idBlocks(next.body)];
  for (const dup of nextBlocks) {
    const claimed = duplicateOf.get(dup);
    const holder = nextBlocks.find((b) => b.id === claimed);
    const before = claimed ? prevById.get(claimed) : undefined;
    if (!claimed || !holder || !before) continue;
    if (sim(blockText(dup), blockText(before)) > sim(blockText(holder), blockText(before))) {
      const newId = dup.id;
      dup.id = holder.id;
      holder.id = newId;
    }
  }
  const nextIds = new Set(nextBlocks.map((b) => b.id));
  const orphans = [...prevById.values()].filter((b) => !nextIds.has(b.id));
  let adopted = 0;
  for (const b of idBlocks(next.body)) {
    if (prevById.has(b.id)) continue;
    let best: Block | undefined;
    let score = 0.6;
    for (const o of orphans) {
      const s = o.t === b.t ? sim(blockText(o), blockText(b)) : 0;
      if (s > score) {
        score = s;
        best = o;
      }
    }
    if (best && 'id' in best) {
      b.id = best.id;
      orphans.splice(orphans.indexOf(best), 1);
      adopted++;
    }
  }
  return adopted;
}

const base = trees['D12-A'] as TemplateTree;
const baseDocx = rendered['D12-A'] as Buffer;
const idOf = (tree: TemplateTree, start: string) => [...idBlocks(tree.body)].find((b) => b.t === 'clause' && `${b.number}\t${blockText(b)}`.startsWith(start))?.id;
const ids = (tree: TemplateTree) => [...idBlocks(tree.body)].map((b) => b.id);

{
  const docx = await editDocx(baseDocx, (ps) => appendRun(para(ps, '2.2\t'), ' Counsel added this sentence.'));
  const t = await importDocx(docx, 'D12-A');
  check(idOf(t, '2.2\t') === idOf(base, '2.2\t'), 'reworded clause keeps its id');
  check(JSON.stringify(ids(t)) === JSON.stringify(ids(base)), 'every other id unchanged after rewording');
}
{
  const docx = await editDocx(baseDocx, (ps, body) => {
    const p = para(ps, '2.2\t');
    const copy = clone(p);
    stripBookmarks(copy);
    setText(copy, '2.3\tA new clause typed by counsel.');
    body.splice(body.indexOf(p) + 1, 0, copy);
  });
  const t = await importDocx(docx, 'D12-A');
  const newIds = ids(t).filter((i) => !ids(base).includes(i));
  check(newIds.length === 1, 'inserted clause gets one new id');
  check(ids(base).every((i) => ids(t).includes(i)), 'no existing id lost after an insertion');
}
{
  const docx = await editDocx(baseDocx, (ps, body) => {
    const p = para(ps, '2.2\t');
    const copy = clone(p); // pasted copy, bookmark and all
    appendRun(copy, ' (pasted and changed)');
    body.splice(body.indexOf(p) + 1, 0, copy);
  });
  const t = await importDocx(docx, 'D12-A');
  const all = ids(t);
  check(new Set(all).size === all.length, 'pasted copy with a duplicate bookmark does not duplicate an id');
  check(idOf(t, '2.2\t') === idOf(base, '2.2\t'), 'original keeps its id; the copy gets a new one');
}
{
  const gone = idOf(base, '2.3\t');
  const docx = await editDocx(baseDocx, (ps, body) => {
    body.splice(body.indexOf(para(ps, '2.3\t')), 1);
  });
  const t = await importDocx(docx, 'D12-A');
  check(!ids(t).includes(gone as string) && ids(t).length === ids(base).length - 1, 'deleted clause disappears; nothing else changes');
}
{
  const docx = await editDocx(baseDocx, (ps, body) => {
    const a = para(ps, '4.2\t');
    const b = para(ps, '4.3\t');
    const ia = body.indexOf(a);
    const ib = body.indexOf(b);
    body[ia] = b;
    body[ib] = a;
  });
  const t = await importDocx(docx, 'D12-A');
  check(idOf(t, '4.2\t') === idOf(base, '4.2\t') && idOf(t, '4.3\t') === idOf(base, '4.3\t'), 'moved clauses keep their ids');
  check([...ids(t)].sort().join() === [...ids(base)].sort().join(), 'moving changes order only');
}
{
  const docx = await editDocx(baseDocx, (ps) => {
    const p = para(ps, '4.4\t');
    const text = textOf(p).replace(/^4\.4\t/, '4.9\t');
    setText(p, text);
  });
  const t = await importDocx(docx, 'D12-A');
  check(idOf(t, '4.9\t') === idOf(base, '4.4\t'), 'renumbered clause keeps its id');
}
{
  const docx = await editDocx(baseDocx, (ps) => {
    const p = para(ps, '4.1\t');
    const text = textOf(p).replace('be approved', 'is approved');
    stripBookmarks(p); // counsel retyped the paragraph
    setText(p, text);
  });
  const t = await importDocx(docx, 'D12-A');
  check(idOf(t, '4.1\t') !== idOf(base, '4.1\t'), 'without its bookmark, a reworded clause first gets a new id');
  const adopted = reconcile(base, t);
  check(adopted === 1 && idOf(t, '4.1\t') === idOf(base, '4.1\t'), 'matching against the previous version recovers it');
}
{
  const docx = await editDocx(baseDocx, (ps) => {
    const p = para(ps, '4.1\t');
    stripBookmarks(p);
    setText(p, '4.1\tThe directors will decide the supplement separately at a later meeting.');
  });
  const t = await importDocx(docx, 'D12-A');
  reconcile(base, t);
  check(idOf(t, '4.1\t') !== idOf(base, '4.1\t'), 'a clause rewritten beyond recognition is treated as new (delete + insert)');
}

// A pasted copy placed before the original takes the id on import; reconcile gives it back.
{
  const docx = await editDocx(baseDocx, (ps, body) => {
    const p = para(ps, '2.2\t');
    const copy = clone(p);
    setText(copy, '2.2\tA different clause pasted above the original.');
    body.splice(body.indexOf(p), 0, copy);
  });
  const t = await importDocx(docx, 'D12-A');
  const original = () => [...idBlocks(t.body)].find((b) => b.t === 'clause' && blockText(b).startsWith('The assets and liabilities'));
  console.log(`info copy pasted above the original: without the previous version, the original ${original()?.id === idOf(base, '2.2\t') ? 'keeps' : 'loses'} its id`);
  reconcile(base, t);
  check(original()?.id === idOf(base, '2.2\t'), 'copy pasted above the original: matching against the previous version gives the id back to the original');
}

console.log(failed ? `${failed} check(s) failed` : 'all id checks pass');
process.exitCode = failed ? 1 : 0;
