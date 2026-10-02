import { describe, expect, test } from 'vitest';
import { contentHash, idBlocks, TemplateTreeSchema } from '../format.js';
import {
  bullet,
  DeletedTextRun,
  ExternalHyperlink,
  heading,
  InsertedTextRun,
  marked,
  numbered,
  Paragraph,
  p,
  Table,
  TableCell,
  TableRow,
  TextRun,
  table,
  word,
} from '../test/word.js';
import { importWord } from './import.js';
import { ImportFailure } from './problems.js';

const imp = async (children: Parameters<typeof word>[0]) => (await importWord(await word(children), 'T')).tree.body;

async function failure(children: Parameters<typeof word>[0]): Promise<ImportFailure> {
  try {
    await importWord(await word(children), 'T');
  } catch (e) {
    if (e instanceof ImportFailure) return e;
    throw e;
  }
  throw new Error('import did not fail');
}

describe('Word features firms use', () => {
  test('heading styles give headings with their level', async () => {
    const body = await imp([heading('Background'), heading('Details', 2), p('Text.')]);
    expect(body).toMatchObject([
      { t: 'heading', level: 1, text: [{ t: 'text', v: 'Background' }] },
      { t: 'heading', level: 2, text: [{ t: 'text', v: 'Details' }] },
      { t: 'para', style: 'body' },
    ]);
  });

  test('automatic numbering gives the numbers Word shows, restarting deeper levels', async () => {
    const body = await imp([
      numbered('First.', 0),
      numbered('One one.', 1),
      numbered('One two.', 1),
      numbered('Sub a.', 2),
      numbered('Sub b.', 2),
      numbered('Roman.', 3),
      numbered('Second.', 0),
      numbered('Two one.', 1),
    ]);
    expect(body.map((b) => (b.t === 'clause' ? b.number : b.t))).toEqual([
      '1.',
      '1.1',
      '1.2',
      '(a)',
      '(b)',
      '(i)',
      '2.',
      '2.1',
    ]);
  });

  test('a new list instance restarts the numbering', async () => {
    const body = await imp([numbered('A.', 0), numbered('B.', 0), numbered('C.', 0, 2)]);
    expect(body.map((b) => (b.t === 'clause' ? b.number : ''))).toEqual(['1.', '2.', '1.']);
  });

  test('bullets are paragraphs, not clauses', async () => {
    expect(await imp([bullet('A point.')])).toMatchObject([{ t: 'para', style: 'bullet' }]);
  });

  test('text inside hyperlinks is kept', async () => {
    const link = new Paragraph({
      children: [
        new TextRun('See '),
        new ExternalHyperlink({ link: 'https://example.com', children: [new TextRun('the guide')] }),
        new TextRun('.'),
      ],
    });
    expect(await imp([link])).toMatchObject([{ t: 'para', text: [{ t: 'text', v: 'See the guide.' }] }]);
  });

  test('typed numbers, as in the first-pass templates, give clauses too', async () => {
    expect(await imp([p('2.1\tA segregated portfolio be created.')])).toMatchObject([
      { t: 'clause', number: '2.1', text: [{ t: 'text', v: 'A segregated portfolio be created.' }] },
    ]);
  });
});

describe('template markup', () => {
  test('fields, inline conditions and inline loops', async () => {
    const body = await imp([
      p(
        'Price {{asset.price_per_share}}[[IF portfolio.has_hurdle]] plus {{portfolio.hurdle_rate}}[[ELSE]] only[[END IF]].',
      ),
    ]);
    expect(body[0]).toMatchObject({
      t: 'para',
      text: [
        { t: 'text', v: 'Price ' },
        { t: 'slot', name: 'asset.price_per_share' },
        {
          t: 'if',
          cond: 'portfolio.has_hurdle',
          then: [
            { t: 'text', v: ' plus ' },
            { t: 'slot', name: 'portfolio.hurdle_rate' },
          ],
          else: [{ t: 'text', v: ' only' }],
        },
        { t: 'text', v: '.' },
      ],
    });
  });

  test('conditions and loops around paragraphs', async () => {
    const body = await imp([
      p('[[IF umbrella.is_regulated_fund]]'),
      p('Apply for approval.'),
      p('[[ELSE]]'),
      p('Notify within 14 days.'),
      p('[[END IF]]'),
      p('[[FOR EACH director IN umbrella.directors WHERE director.is_interested]]'),
      p('{{director.name}} declared an interest.'),
      p('[[END FOR EACH]]'),
    ]);
    expect(body).toMatchObject([
      { t: 'if', cond: 'umbrella.is_regulated_fund', then: [{ t: 'para' }], else: [{ t: 'para' }] },
      {
        t: 'each',
        alias: 'director',
        list: 'umbrella.directors',
        where: 'director.is_interested',
        body: [{ t: 'para' }],
      },
    ]);
  });

  test('a loop opened in the first cell and closed in the last repeats the row', async () => {
    const body = await imp([
      table([
        ['Name', 'Role'],
        ['[[FOR EACH person IN investor.controllers]] {{person.name}}', '{{person.role}} [[END FOR EACH]]'],
      ]),
    ]);
    expect(body[0]).toMatchObject({
      t: 'table',
      rows: [
        { t: 'row' },
        {
          t: 'each_row',
          alias: 'person',
          list: 'investor.controllers',
          cells: [[{ t: 'slot', name: 'person.name' }], [{ t: 'slot', name: 'person.role' }]],
        },
      ],
    });
  });
});

describe('refusals', () => {
  test('tracked changes are refused, naming each place (decision 0010)', async () => {
    const f = await failure([
      p('Clean.'),
      new Paragraph({
        children: [
          new TextRun('Price '),
          new InsertedTextRun({ text: 'USD 12.00', id: 1, author: 'Counsel', date: '2026-10-01T00:00:00Z' }),
        ],
      }),
      new Paragraph({
        children: [new DeletedTextRun({ text: 'Old text.', id: 2, author: 'Counsel', date: '2026-10-01T00:00:00Z' })],
      }),
    ]);
    expect(f.problems.map((x) => x.code)).toEqual(['tracked_change', 'tracked_change']);
    expect(f.problems[0]?.at).toBe('paragraph 2 (“Price”)');
    expect(f.problems[0]?.message).toMatch(/Accept or reject them in Word/);
  });

  test('a stray [[…]] placeholder is refused', async () => {
    const f = await failure([p('6.3\tAs trustee. [[Counsel wording on trustee limitation]]')]);
    expect(f.problems).toEqual([
      expect.objectContaining({ code: 'unknown_marker', at: expect.stringMatching(/^paragraph 1/) }),
    ]);
  });

  test.each([
    [[p('[[IF a.b]]'), p('Text.')], /never closed/],
    [[p('[[END IF]]')], /nothing to close/],
    [[p('Text [[IF a.b]] more.')], /not closed with \[\[END IF\]\] in the same paragraph/],
    [[p('[[FOR EACH director IN umbrella.directors]]'), p('x')], /never closed/],
  ])('unbalanced markup is refused (%#)', async (children, message) => {
    const f = await failure(children);
    expect(f.problems.map((x) => x.code)).toContain('unbalanced_block');
    expect(f.message).toMatch(message);
  });

  test('a table inside a table is refused', async () => {
    const inner = table([['inner']]);
    const outer = new Table({ rows: [new TableRow({ children: [new TableCell({ children: [inner, p('')] })] })] });
    expect((await failure([outer])).problems.map((x) => x.code)).toEqual(['nested_table']);
  });

  test('every problem is reported, not just the first', async () => {
    const f = await failure([p('[[Write this]]'), p('[[END FOR EACH]]')]);
    expect(f.problems.map((x) => x.code)).toEqual(['unknown_marker', 'unbalanced_block']);
  });

  test('a file that is not Word is refused', async () => {
    await expect(importWord(new TextEncoder().encode('not a zip'), 'T')).rejects.toMatchObject({
      problems: [{ code: 'not_word' }],
    });
  });
});

describe('ids', () => {
  test('come from docsmart bookmarks; other bookmarks are ignored', async () => {
    const r = await importWord(
      await word([marked('dsc_c_2_1', 'Kept id.'), marked('_Toc123', 'Word’s own bookmark.')]),
      'T',
    );
    const ids = [...idBlocks(r.tree.body)].map((b) => b.id);
    expect(ids[0]).toBe('c_2_1');
    expect(ids[1]).toMatch(/^b[0-9a-f]{12}$/);
    expect(r.ids).toEqual({ from_bookmark: ['c_2_1'], derived: [ids[1]], duplicates: [] });
  });

  test('a second block with the same bookmark (a pasted copy) gets a new id', async () => {
    const r = await importWord(await word([marked('dsc_x', 'Original.'), marked('dsc_x', 'Pasted copy.')]), 'T');
    const [a, b] = [...idBlocks(r.tree.body)].map((x) => x.id);
    expect(a).toBe('x');
    expect(r.ids.duplicates).toEqual([{ id: b, bookmark: 'x' }]);
  });

  test('without bookmarks, the same file always gives the same ids and hash', async () => {
    const file = await word([heading('Heading'), p('Same text.'), p('Same text.')]);
    const [a, b] = [await importWord(file, 'T'), await importWord(file, 'T')];
    expect(contentHash(a.tree)).toBe(contentHash(b.tree));
    const ids = [...idBlocks(a.tree.body)].map((x) => x.id);
    expect(new Set(ids).size).toBe(3); // repeated text still gets distinct ids
  });

  test('every imported tree is structurally valid', async () => {
    const r = await importWord(await word([heading('H'), numbered('One.', 0), bullet('B'), table([['a', 'b']])]), 'T');
    expect(TemplateTreeSchema.safeParse(r.tree).success).toBe(true);
  });
});
