// The nine first-pass templates: each imports with everything the generator put in, and passes the
// import rules (the drafting problems found earlier are fixed in the generator).
import { describe, expect, test } from 'vitest';
import { contentHash, idBlocks } from './format.js';
import { checkImportRules } from './rules.js';
import { catalogue, FIRST_PASS, firstPassFile, generatorUsage, keys, treeUsage } from './test/first-pass.js';
import { importWord } from './word/import.js';

describe('import', () => {
  test.each(FIRST_PASS)(
    '%s keeps every field, condition, loop, zone and locked wording, with the same nesting',
    async (id) => {
      const { tree } = await importWord(firstPassFile(id), id);
      expect(keys(treeUsage(tree.body))).toEqual(keys(generatorUsage[id] ?? []));
    },
  );

  test.each(FIRST_PASS)('%s gives the same tree and ids every time', async (id) => {
    const [a, b] = [await importWord(firstPassFile(id), id), await importWord(firstPassFile(id), id)];
    expect(contentHash(a.tree)).toBe(contentHash(b.tree));
    expect(a.ids.derived.length).toBe([...idBlocks(a.tree.body)].length); // no bookmarks in the first-pass files
  });

  test('numbers come from Word automatic numbering, including both alternatives of a condition', async () => {
    const { tree } = await importWord(firstPassFile('D12-A'), 'D12-A');
    const numbers = [...idBlocks(tree.body)]
      .filter((b) => b.t === 'heading' || b.t === 'clause')
      .map((b) => ('number' in b ? b.number : undefined));
    // Section 3 offers two alternative clauses; Word numbers both, and assembly renumbers.
    expect(numbers).toEqual([
      '1',
      '1.1',
      '1.2',
      '1.3',
      '2',
      '2.1',
      '2.2',
      '2.3',
      '3',
      '3.1',
      '3.2',
      '4',
      '4.1',
      '4.2',
      '4.3',
      '4.4',
      '5',
      '5.1',
      '5.2',
      '6',
      '6.1',
      '7',
      '7.1',
      '7.2',
    ]);
  });

  test('headings come from Word heading styles', async () => {
    const { tree } = await importWord(firstPassFile('D13-A'), 'D13-A');
    const headings = [...idBlocks(tree.body)].filter((b) => b.t === 'heading');
    expect(headings.length).toBeGreaterThan(10);
    expect(headings.every((h) => h.t === 'heading' && h.level === 1)).toBe(true);
  });
});

describe('import rules', () => {
  test.each(FIRST_PASS)('%s breaks none', async (id) => {
    expect(checkImportRules((await importWord(firstPassFile(id), id)).tree, catalogue)).toEqual([]);
  });
});
