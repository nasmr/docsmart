// The nine first-pass templates: what each imports to, and which import rules each breaks as drafted.
import { describe, expect, test } from 'vitest';
import { contentHash, idBlocks } from './format.js';
import { checkImportRules } from './rules.js';
import { catalogue, FIRST_PASS, firstPassFile, generatorUsage, keys, treeUsage } from './test/first-pass.js';
import { importWord } from './word/import.js';
import { ImportFailure } from './word/problems.js';

const IMPORTS = FIRST_PASS.filter((id) => id !== 'D1SP-B');

describe('import', () => {
  test.each(IMPORTS)(
    '%s keeps every field, condition, loop, zone and locked wording, with the same nesting',
    async (id) => {
      const { tree } = await importWord(firstPassFile(id), id);
      expect(keys(treeUsage(tree.body))).toEqual(keys(generatorUsage[id] ?? []));
    },
  );

  test.each(IMPORTS)('%s gives the same tree and ids every time', async (id) => {
    const [a, b] = [await importWord(firstPassFile(id), id), await importWord(firstPassFile(id), id)];
    expect(contentHash(a.tree)).toBe(contentHash(b.tree));
    expect(a.ids.derived.length).toBe([...idBlocks(a.tree.body)].length); // no bookmarks in the first-pass files
  });

  test('D1SP-B fails: its trustee clause uses [[…]] for text counsel is to write', async () => {
    const r = importWord(firstPassFile('D1SP-B'), 'D1SP-B');
    await expect(r).rejects.toBeInstanceOf(ImportFailure);
    await expect(r).rejects.toMatchObject({
      problems: [
        {
          code: 'unknown_marker',
          at: expect.stringMatching(/^paragraph \d+ \(“6\.3 The Investor enters into this agreement as tru/),
        },
      ],
    });
  });
});

describe('import rules on the templates as drafted', () => {
  const rulesFor = async (id: string) => checkImportRules((await importWord(firstPassFile(id), id)).tree, catalogue);

  test.each(['D12-A', 'D12-B', 'D1SP-A', 'D1SP-C'])('%s breaks none', async (id) => {
    expect(await rulesFor(id)).toEqual([]);
  });

  test('D12-C: an ambiguous “any director”, and director fields outside a loop', async () => {
    const problems = await rulesFor('D12-C');
    expect(problems.map((p) => `${p.rule}: ${p.message}`)).toEqual([
      'condition_form: “any director” could mean umbrella.directors or meeting.attendees; use FOR EACH … WHERE instead',
      'unbound_variable: Field director.name uses “director” outside a loop that binds it',
      'unbound_variable: Field director.interest_description uses “director” outside a loop that binds it',
      'unbound_variable: Condition director.abstains uses “director” outside a loop that binds it',
    ]);
  });

  test.each(['D13-A', 'D13-B', 'D13-C'])('%s: “Issuer:” is inside the locked wording', async (id) => {
    const problems = await rulesFor(id);
    expect(problems.map((p) => p.rule)).toEqual(['locked_wording']);
  });
});
