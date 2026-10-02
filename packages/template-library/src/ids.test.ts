// Clause ids under counsel's edits: the previous version is rendered with bookmarks, counsel edits
// it in Word, and the re-import is matched against the previous version.
import { describe, expect, test } from 'vitest';
import { blockText, idBlocks, type TemplateTree } from './format.js';
import { MATCH_THRESHOLD, reconcile, similarity } from './ids.js';
import { marked, p, word } from './test/word.js';
import { importWord } from './word/import.js';

const CLAUSES = {
  c1: '2.1\tA segregated portfolio of the Company be created and named Lumen Segregated Portfolio.',
  c2: '2.2\tThe assets and liabilities of the Portfolio be held and recorded separately from those of the Company.',
  c3: '2.3\tA class of shares linked to the Portfolio be designated as Class L Participating Shares.',
  c4: '4.1\tThe supplement to the offering memorandum relating to the Portfolio be approved.',
  c5: '4.2\tPortfolio Shares be offered at the subscription price with a minimum subscription per investor.',
};
type Key = keyof typeof CLAUSES;

/** The previous version, as the renderer would write it: every clause bookmarked with its id. */
async function previous(): Promise<TemplateTree> {
  return (await importWord(await word(Object.entries(CLAUSES).map(([id, text]) => marked(`dsc_${id}`, text))), 'D12-A'))
    .tree;
}
async function edited(children: Parameters<typeof word>[0]) {
  return reconcile(await previous(), await importWord(await word(children), 'D12-A'));
}
const ids = (t: TemplateTree) => [...idBlocks(t.body)].map((b) => b.id);
const keep = (k: Key, text = CLAUSES[k]) => marked(`dsc_${k}`, text);
const idOf = (t: TemplateTree, start: string) => [...idBlocks(t.body)].find((b) => blockText(b).startsWith(start))?.id;

describe('counsel edits in Word', () => {
  test('nothing changed: every id kept', async () => {
    const r = await edited([keep('c1'), keep('c2'), keep('c3'), keep('c4'), keep('c5')]);
    expect(ids(r.tree)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    expect(r.report).toEqual({ kept: ['c1', 'c2', 'c3', 'c4', 'c5'], recovered: [], added: [], removed: [] });
  });

  test('rewording keeps the id', async () => {
    const r = await edited([
      keep('c1'),
      keep('c2', `${CLAUSES.c2} Counsel added this.`),
      keep('c3'),
      keep('c4'),
      keep('c5'),
    ]);
    expect(ids(r.tree)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  test('an inserted clause is added; nothing is lost', async () => {
    const r = await edited([
      keep('c1'),
      keep('c2'),
      p('2.3\tA new clause typed by counsel about something else entirely.'),
      keep('c3'),
      keep('c4'),
      keep('c5'),
    ]);
    expect(r.report.added).toHaveLength(1);
    expect(r.report.removed).toEqual([]);
  });

  test('a deleted clause is removed; nothing else changes', async () => {
    const r = await edited([keep('c1'), keep('c2'), keep('c4'), keep('c5')]);
    expect(ids(r.tree)).toEqual(['c1', 'c2', 'c4', 'c5']);
    expect(r.report.removed).toEqual(['c3']);
  });

  test('moving and renumbering keep the ids', async () => {
    const r = await edited([
      keep('c1'),
      keep('c2'),
      keep('c3'),
      keep('c5', CLAUSES.c5.replace('4.2', '4.1')),
      keep('c4', CLAUSES.c4.replace('4.1', '4.2')),
    ]);
    expect(ids(r.tree)).toEqual(['c1', 'c2', 'c3', 'c5', 'c4']);
  });

  test('a pasted copy below the original: the original keeps the id', async () => {
    const r = await edited([
      keep('c1'),
      keep('c2'),
      keep('c2', '2.3\tPasted and changed: a different clause.'),
      keep('c3'),
      keep('c4'),
      keep('c5'),
    ]);
    expect(idOf(r.tree, 'The assets and liabilities')).toBe('c2');
    expect(new Set(ids(r.tree)).size).toBe(6);
  });

  test('a pasted copy above the original: matching gives the id back to the original', async () => {
    const r = await edited([
      keep('c1'),
      keep('c2', '2.2\tPasted above and changed: a different clause.'),
      keep('c2'),
      keep('c3'),
      keep('c4'),
      keep('c5'),
    ]);
    expect(idOf(r.tree, 'The assets and liabilities')).toBe('c2');
    expect(idOf(r.tree, 'Pasted above')).not.toBe('c2');
  });

  test('a lost bookmark on a lightly reworded clause is recovered', async () => {
    const r = await edited([
      keep('c1'),
      keep('c2'),
      keep('c3'),
      p(CLAUSES.c4.replace('be approved', 'is approved')),
      keep('c5'),
    ]);
    expect(ids(r.tree)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    expect(r.report.recovered).toEqual([{ id: 'c4', text: expect.stringContaining('is approved') }]);
  });

  test('a clause rewritten beyond recognition is a deletion and an addition', async () => {
    const r = await edited([
      keep('c1'),
      keep('c2'),
      keep('c3'),
      p('4.1\tThe directors will decide this at a later meeting.'),
      keep('c5'),
    ]);
    expect(r.report.removed).toEqual(['c4']);
    expect(r.report.added).toHaveLength(1);
  });

  test('two lost bookmarks each recover their own id', async () => {
    const r = await edited([keep('c1'), p(CLAUSES.c2), p(CLAUSES.c3), keep('c4'), keep('c5')]);
    expect(ids(r.tree)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  test('reconcile does not change the import it was given', async () => {
    const imported = await importWord(await word([keep('c1'), p(CLAUSES.c2)]), 'D12-A');
    const before = structuredClone(imported);
    reconcile(await previous(), imported);
    expect(imported).toEqual(before);
  });
});

test('similarity is word overlap', () => {
  expect(similarity('a b c', 'a b c')).toBe(1);
  expect(similarity('a b', 'c d')).toBe(0);
  expect(similarity('a b c d', 'a b c e')).toBeCloseTo(3 / 5);
  expect(MATCH_THRESHOLD).toBe(0.6);
});
