import { describe, expect, test } from 'vitest';
import { AssemblyRefused, type AssemblyResult, assemble, renumber } from './assemble.js';
import { type AssembledBlock, piecesText } from './assembled.js';
import { ATLAS_INVESTORS, catalogue, FIXTURE_DOCUMENTS, input, template, U3_HASH } from './test/fixtures.js';

const text = (r: AssemblyResult) => r.document.body.map((b) => blockText(b)).join('\n');
function blockText(b: AssembledBlock): string {
  if (b.t === 'table') return b.rows.map((row) => row.map(piecesText).join(' | ')).join('\n');
  const n = 'number' in b && b.number ? `${b.number} ` : '';
  return n + piecesText(b.text);
}
const numbered = (r: AssemblyResult) =>
  r.document.body.filter((b) => (b.t === 'heading' || b.t === 'clause') && b.number).map((b) => blockText(b));

describe('the M1 demo: Lumen’s creation resolution', () => {
  test('assembles with nothing missing, and the same inputs give the same hash', async () => {
    const [a, b] = [assemble(await input('doc_lumen_d12')), assemble(await input('doc_lumen_d12'))];
    expect(a.document.problems).toEqual([]);
    expect(a.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.content_hash).toBe(b.content_hash);
  });

  test('fills values in the house format (decision 0011), with the total from the calculation service', async () => {
    const r = assemble(await input('doc_lumen_d12'));
    const t = text(r);
    expect(t).toContain('Passed in writing on 20 October 2026');
    expect(t).toContain(
      'Portfolio Shares be offered at USD 100.00 per share, with a minimum subscription of USD 100,000.00',
    );
    expect(t).toContain('acquire up to 250,000 Series B Preferred Stock of Lumenfold Optics, Inc.');
    expect(t).toContain('for a total consideration not exceeding USD 3,000,000.00');
    expect(r.calculations).toEqual([
      expect.objectContaining({ function: 'total_consideration', computed_by: '@docsmart/calc' }),
    ]);
  });

  test('takes the regulated-fund branch and renumbers the alternative as 3.1', async () => {
    const r = assemble(await input('doc_lumen_d12'));
    expect(numbered(r).filter((n) => n.startsWith('3'))).toEqual([
      '3 Regulatory approval or notification',
      expect.stringMatching(
        /^3\.1 Any director, or the Company’s registered agent, be authorised to apply to the Financial Services Commission/,
      ),
    ]);
    expect(text(r)).not.toContain('notify the Financial Services Commission in writing');
  });

  test('an unregulated fund takes the second alternative, renumbered from 3.2 to 3.1', async () => {
    const i = await input('doc_lumen_d12');
    const r = assemble({
      ...i,
      records: { ...i.records, umbrella: { ...i.records.umbrella, is_regulated_fund: false } },
    });
    expect(numbered(r).filter((n) => n.startsWith('3'))).toEqual([
      '3 Regulatory approval or notification',
      expect.stringMatching(
        /^3\.1 The Company’s registered agent be instructed to notify the Financial Services Commission in writing/,
      ),
    ]);
  });

  test('generates the contracting-party wording from the records', async () => {
    const r = assemble(await input('doc_lumen_d12'));
    const locked = r.document.body.find((b) => b.t === 'locked');
    expect(locked && piecesText(locked.text)).toBe(
      'Meridian Horizon SPC Limited for and on behalf of Lumen Segregated Portfolio',
    );
  });

  test('removes counsel notes, and leaves signing dates blank', async () => {
    const r = assemble(await input('doc_lumen_d12'));
    expect(text(r)).not.toMatch(/COUNSEL NOTE|Which article permits/);
    const dates = r.document.body.filter((b) => b.t === 'para' && piecesText(b.text).startsWith('Date:'));
    expect(dates).toHaveLength(3); // one per director
    expect(
      dates.every((b) => b.t === 'para' && b.text.some((p) => p.t === 'blank' && p.field === 'director.signed_date')),
    ).toBe(true);
  });

  test('every value it used is recorded, for re-derivation (DF-51)', async () => {
    const r = assemble(await input('doc_lumen_d12'));
    expect(r.values).toContainEqual({ field: 'portfolio.legal_name', value: 'Lumen Segregated Portfolio' });
    expect(r.values).toContainEqual({ field: 'director.name', item: 'dir_02', value: 'Henrik Solberg' });
  });
});

describe('every fixture document', () => {
  // No double spaces, no space before punctuation, and no paragraph left empty by a condition.
  const clean = (r: AssemblyResult) => {
    expect(text(r)).not.toMatch(/ {2}| [.,;:)]|\( /);
    const empty = r.document.body.filter((b) => b.t !== 'table' && b.t !== 'zone' && piecesText(b.text).trim() === '');
    expect(empty.map((b) => b.id)).toEqual([]);
  };

  test.each(FIXTURE_DOCUMENTS)('%s assembles with nothing missing, and reads cleanly', async (id) => {
    const r = assemble(await input(id));
    expect(r.document.problems).toEqual([]);
    clean(r);
  });

  test('all 41 Atlas subscription agreements assemble with nothing missing, and read cleanly', async () => {
    for (const party of ATLAS_INVESTORS) {
      const r = assemble(await input('batch_atlas_d1sp', { party }));
      expect(r.document.problems, party).toEqual([]);
      clean(r);
    }
  });
});

describe('conditions, loops and values', () => {
  test('D12-B: the interested director’s declaration, the markup, and the later effective date', async () => {
    const t = text(assemble(await input('doc_atlas_d12')));
    expect(t).toContain(
      'Henrik Solberg has declared to the other directors that they are interested in the acquisition as a director and shareholder of the general partner of the Seller.',
    );
    expect(t).not.toMatch(/Amara Okafor has declared|Priya Raman has declared/);
    expect(t).toContain('a markup of 32.98% on the Seller’s cost');
    expect(t).toContain('or on 4 January 2027 if later');
    expect(t).toContain('the consent required by clause 14.3 of the offering memorandum');
  });

  test('D12-C: attendees, the interested director who abstains, and the chair', async () => {
    const t = text(assemble(await input('doc_atlas2_d12')));
    expect(t).toContain('10 February 2027 at 15:00 (UTC+04:00)');
    expect(t).toContain('Present | Amara Okafor, Henrik Solberg and Priya Raman');
    expect(t).toContain(
      'Priya Raman declared that they are interested in the matters to be considered as a holder of common stock of Tessellate Bio, Inc. in a personal capacity, and did not vote on the resolutions in section 5.',
    );
    expect(t).not.toContain('Each director present confirmed');
  });

  test('D13-A: entered rates printed exactly, and the lapse-cost condition', async () => {
    const t = text(assemble(await input('doc_lumen_d13')));
    expect(t).toContain('2% a year on the aggregate subscribed capital of the Portfolio');
    expect(t).toContain(
      '20% of profits after investors have received back their subscribed capital and a return of 8% a year',
    );
    expect(t).toContain('less their share of costs incurred, up to USD 25,000.00');
    expect(t).toContain('SUPPLEMENT NO. 1');
  });

  test('D13-B: the conflicts section with the valuation range and the retained shares', async () => {
    const t = text(assemble(await input('doc_atlas_d13')));
    expect(t).toContain('valued the Company Shares at USD 11.80 to USD 13.10 per share as at 30 November 2026');
    expect(t).toContain('will continue to hold 150,000 Company Shares directly');
    expect(t).toContain('conflict disclosure statement dated 18 December 2026');
    expect(t).not.toContain('a return of'); // Atlas has no hurdle
  });

  test('D13: AI zones are present and empty until drafted (DF-52)', async () => {
    const zones = assemble(await input('doc_atlas2_d13')).document.body.filter((b) => b.t === 'zone');
    expect(zones.map((z) => z.t === 'zone' && z.zone)).toEqual(['issuer_description', 'project_risk_factors']);
    expect(zones.every((z) => z.t === 'zone' && z.text.length === 0)).toBe(true);
  });

  test('D1SP-A: shares from the calculation service, payment details and the conflict acknowledgement', async () => {
    const r = assemble(await input('batch_atlas_d1sp', { party: 'pty_001' }));
    const t = text(r);
    expect(t).toContain('Allocated Amount: USD 100,000.00 for 1,000 Portfolio Shares');
    expect(t).toContain(
      'Account name | Meridian Horizon SPC Limited – Atlas Segregated Portfolio Subscription Account',
    );
    expect(t).toContain('a markup of 32.98% on the affiliate’s cost of USD 9.40 per share');
    expect(t).toContain('Investor status (clause 4) | professional investor');
    expect(r.calculations.map((c) => (c as { function: string }).function).sort()).toEqual([
      'markup',
      'shares_to_issue',
    ]);
  });

  test('D1SP-A returns the hashes of the supplement and terms it was built on (addendum §4.2)', async () => {
    const supplement = assemble(await input('doc_atlas_d13'));
    const r = assemble(await input('batch_atlas_d1sp', { party: 'pty_001' }));
    expect(r.referenced_hashes).toEqual({ U3: U3_HASH, D13: supplement.content_hash });
  });

  test('conditional wording reads correctly either way, with no stray spaces', async () => {
    const withHurdle = text(assemble(await input('doc_lumen_d13')));
    const noHurdle = text(assemble(await input('doc_atlas_d13')));
    expect(withHurdle).toContain('subscribed capital and a return of 8% a year');
    expect(noHurdle).toContain(
      '15% of the amount by which cumulative distributions exceed investors’ subscribed capital. The calculation',
    );
    for (const t of [
      withHurdle,
      noHurdle,
      text(assemble(await input('doc_lumen_d12'))),
      text(assemble(await input('batch_atlas_d1sp', { party: 'pty_031' }))),
    ]) {
      expect(t).not.toMatch(/ {2}| [.,;:]/);
    }
  });

  test('D1SP-B: a trustee entity, its signatories and its controllers', async () => {
    const t = text(assemble(await input('batch_atlas_d1sp', { party: 'pty_040' })));
    expect(t).toContain('as trustee of Valcourt Family Trust');
    expect(t).not.toContain('Counsel to supply'); // a counsel note, removed
    expect(t).toMatch(/Settlor and beneficiary of the trust/);
  });

  test('D1SP-C: the earlier agreement and the individual signature block', async () => {
    const t = text(assemble(await input('batch_atlas_d1sp', { party: 'pty_002' })));
    expect(t).toContain(
      'The Investor already holds shares in Lumen Segregated Portfolio under a subscription agreement dated 1 December 2026 (reference LUM-SA-001)',
    );
    expect(t).toContain('Bruno Hollingsworth');
  });

  test('a paragraph whose only content is a condition that does not hold is left out', async () => {
    const t = text(assemble(await input('doc_atlas2_d12'))); // market_secondary: no valuation bullet
    expect(t).not.toContain('The independent valuation by');
  });
});

describe('what assembly cannot fill is reported, never guessed', () => {
  test('a missing value is marked and reported, and the hash is still deterministic', async () => {
    const i = await input('doc_lumen_d12');
    const portfolio = structuredClone(i.records.portfolio);
    if (!portfolio) throw new Error('fixture');
    delete (portfolio.portfolio as { share_class_name?: string }).share_class_name;
    const r = assemble({ ...i, records: { ...i.records, portfolio } });
    expect(r.document.problems).toContainEqual(
      expect.objectContaining({ kind: 'missing_value', field: 'portfolio.share_class_name' }),
    );
    expect(text(r)).toContain('[missing: portfolio.share_class_name]');
    expect(assemble({ ...i, records: { ...i.records, portfolio } }).content_hash).toBe(r.content_hash);
  });

  test('a condition with no value drops both branches and is reported, not read as false', async () => {
    const i = await input('doc_lumen_d13');
    const portfolio = structuredClone(i.records.portfolio);
    if (!portfolio) throw new Error('fixture');
    delete (portfolio.terms as { has_hurdle?: boolean }).has_hurdle;
    const r = assemble({ ...i, records: { ...i.records, portfolio } });
    expect(r.document.problems).toContainEqual(
      expect.objectContaining({ kind: 'condition_undecided', field: 'portfolio.has_hurdle' }),
    );
    expect(text(r)).not.toContain('a return of 8% a year');
  });

  test('no declarations of interest entered is reported, not read as “nobody is interested”', async () => {
    const i = await input('doc_atlas_d12');
    const r = assemble({
      ...i,
      document: { ...i.document, inputs: { ...i.document.inputs, director_interests: undefined } },
    });
    expect(r.document.problems).toContainEqual(
      expect.objectContaining({ kind: 'condition_undecided', field: 'director.is_interested' }),
    );
  });

  test('a calculation that cannot run is reported', async () => {
    const i = await input('doc_lumen_d12');
    const portfolio = structuredClone(i.records.portfolio);
    if (!portfolio) throw new Error('fixture');
    portfolio.asset.price_per_share = { amount: '0.00', currency: 'USD' };
    const r = assemble({ ...i, records: { ...i.records, portfolio } });
    expect(r.document.problems).toContainEqual(
      expect.objectContaining({
        field: 'asset.total_consideration',
        reason: expect.stringMatching(/could not be calculated/),
      }),
    );
  });

  test('a template that breaks the import rules is refused', async () => {
    const i = await input('doc_lumen_d12');
    const bad = {
      ...i.template,
      body: [
        { t: 'para' as const, id: 'p', style: 'body' as const, text: [{ t: 'slot' as const, name: 'nope.field' }] },
      ],
    };
    expect(() => assemble({ ...i, template: bad })).toThrow(AssemblyRefused);
  });
});

describe('no other portfolio’s content (INV-10)', () => {
  test('Atlas’s supplement mentions neither Lumen nor Atlas II', async () => {
    const t = text(assemble(await input('doc_atlas_d13')));
    expect(t).not.toMatch(/Lumen|Atlas II|Tessellate|Kestrel Coinvest/);
  });

  test('the short-form agreement does name the earlier portfolio, as catalogue gap G3 records', async () => {
    expect(text(assemble(await input('batch_atlas_d1sp', { party: 'pty_002' })))).toContain(
      'Lumen Segregated Portfolio',
    );
  });
});

describe('renumbering', () => {
  const b = (number: string): AssembledBlock => ({ t: 'clause', id: number, number, text: [] });
  const h = (number: string): AssembledBlock => ({ t: 'heading', id: `h${number}`, level: 1, number, text: [] });

  test('numbers in order after conditions are decided', () => {
    expect(
      renumber([h('1'), b('1.1'), b('1.3'), h('3'), b('3.2'), b('3.5')]).map((x) => ('number' in x ? x.number : '')),
    ).toEqual(['1', '1.1', '1.2', '2', '2.1', '2.2']);
  });

  test('keeps trailing full stops and leaves other styles alone', () => {
    expect(renumber([b('1.'), b('(a)'), b('2.')]).map((x) => ('number' in x ? x.number : ''))).toEqual([
      '1.',
      '(a)',
      '2.',
    ]);
  });
});

test('the catalogue covers every field the templates use', async () => {
  for (const id of ['D12-A', 'D12-B', 'D12-C', 'D13-A', 'D13-B', 'D13-C', 'D1SP-A', 'D1SP-B', 'D1SP-C']) {
    expect((await template(id)).template).toBe(id);
  }
  expect(Object.keys(catalogue.fields).length).toBeGreaterThan(100);
});
