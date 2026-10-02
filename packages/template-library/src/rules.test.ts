import { describe, expect, test } from 'vitest';
import { evaluateFlat, parseCondition } from './conditions.js';
import { type Block, contentHash, FORMAT, type Inline, type TemplateTree, TemplateTreeSchema } from './format.js';
import { type Catalogue, checkImportRules, DESIGNATION } from './rules.js';

const catalogue: Catalogue = {
  fields: {
    'portfolio.legal_name': { type: 'text' },
    'umbrella.legal_name': { type: 'text' },
    'portfolio.has_hurdle': { type: 'boolean' },
    'portfolio.hurdle_rate': { type: 'rate' },
    'asset.acquisition_source': { type: 'enum', values: ['issuer_primary', 'gp_sourced'] },
    'director.name': { type: 'text' },
    'director.is_interested': { type: 'boolean' },
    'person.name': { type: 'text' },
  },
  lists: { 'umbrella.directors': { item: 'director' }, 'investor.controllers': { item: 'person' } },
  zones: { issuer_description: {} },
};
const tree = (body: Block[]): TemplateTree => ({ format: FORMAT, template: 'T', body });
const para = (text: Inline[], id = 'p1'): Block => ({ t: 'para', id, style: 'body', text });
const slot = (name: string): Inline => ({ t: 'slot', name });
const rules = (body: Block[]) => checkImportRules(tree(body), catalogue).map((p) => p.rule);

describe('conditions: the closed form', () => {
  test.each([
    ['portfolio.has_hurdle', { any: false, path: 'portfolio.has_hurdle' }],
    ['asset.acquisition_source = gp_sourced', { any: false, path: 'asset.acquisition_source', value: 'gp_sourced' }],
    ['any director.is_interested', { any: true, path: 'director.is_interested' }],
  ])('accepts %j', (text, parsed) => expect(parseCondition(text)).toEqual(parsed));

  test.each([
    'has_hurdle', // not dotted
    'portfolio.has_hurdle and asset.x', // no "and"
    'portfolio.term_years > 5', // no comparisons
    'asset.acquisition_source == gp_sourced',
    'asset.acquisition_source = "gp_sourced"', // no quotes
    'asset.acquisition_source=gp_sourced', // spacing is fixed
    'NOT portfolio.has_hurdle', // ELSE gives the negative
    'fn(portfolio.has_hurdle)',
    'portfolio.Has_Hurdle',
    '',
  ])('refuses %j', (text) => expect(parseCondition(text)).toHaveProperty('error'));

  test('flat evaluation for selection rules', () => {
    expect(evaluateFlat('portfolio.has_hurdle', { 'portfolio.has_hurdle': true })).toBe(true);
    expect(
      evaluateFlat('asset.acquisition_source = gp_sourced', { 'asset.acquisition_source': 'issuer_primary' }),
    ).toBe(false);
    expect(() => evaluateFlat('portfolio.has_hurdle', {})).toThrow(/No fact/);
    expect(() => evaluateFlat('portfolio.has_hurdle', { 'portfolio.has_hurdle': 'yes' })).toThrow(/true or false/);
    expect(() => evaluateFlat('any director.is_interested', {})).toThrow(/tests a list/);
  });
});

describe('import rules (decision 0008)', () => {
  test('a clean template breaks none', () => {
    expect(
      rules([
        { t: 'locked', id: 'l1', kind: 'contracting_party', text: [...DESIGNATION] },
        { t: 'if', cond: 'portfolio.has_hurdle', then: [para([slot('portfolio.hurdle_rate')])] },
        {
          t: 'each',
          alias: 'director',
          list: 'umbrella.directors',
          where: 'director.is_interested',
          body: [para([slot('director.name')], 'p2')],
        },
        { t: 'zone', id: 'z1', zone: 'issuer_description', instructions: [] },
      ]),
    ).toEqual([]);
  });

  test('condition_form', () => {
    expect(rules([{ t: 'if', cond: 'portfolio.has_hurdle or x.y', then: [para([])] }])).toEqual(['condition_form']);
  });

  test('unknown_field: in a slot and in a condition', () => {
    expect(rules([para([slot('portfolio.name')])])).toEqual(['unknown_field']);
    expect(rules([{ t: 'if', cond: 'portfolio.has_hurdel', then: [para([])] }])).toEqual(['unknown_field']);
  });

  test('condition_type: a test that does not fit the field', () => {
    expect(rules([{ t: 'if', cond: 'portfolio.hurdle_rate', then: [para([])] }])).toEqual(['condition_type']);
    expect(rules([{ t: 'if', cond: 'asset.acquisition_source', then: [para([])] }])).toEqual(['condition_type']);
    expect(rules([{ t: 'if', cond: 'asset.acquisition_source = gp_supplied', then: [para([])] }])).toEqual([
      'condition_type',
    ]);
    expect(rules([{ t: 'if', cond: 'portfolio.has_hurdle = yes', then: [para([])] }])).toEqual(['condition_type']);
  });

  test('unknown_list and loop_alias', () => {
    expect(rules([{ t: 'each', alias: 'director', list: 'umbrella.officers', body: [] }])).toEqual(['unknown_list']);
    expect(rules([{ t: 'each', alias: 'd', list: 'umbrella.directors', body: [] }])).toEqual(['loop_alias']);
  });

  test('unbound_variable: a loop variable outside its loop, in text, conditions and tables', () => {
    expect(rules([para([slot('director.name')])])).toEqual(['unbound_variable']);
    expect(rules([{ t: 'if', cond: 'director.is_interested', then: [para([])] }])).toEqual(['unbound_variable']);
    expect(
      rules([{ t: 'each', alias: 'director', list: 'umbrella.directors', body: [para([slot('person.name')])] }]),
    ).toEqual(['unbound_variable']);
    expect(rules([{ t: 'table', id: 't1', rows: [{ t: 'row', cells: [[slot('person.name')]] }] }])).toEqual([
      'unbound_variable',
    ]);
    expect(
      rules([
        {
          t: 'table',
          id: 't1',
          rows: [{ t: 'each_row', alias: 'person', list: 'investor.controllers', cells: [[slot('person.name')]] }],
        },
      ]),
    ).toEqual([]);
  });

  test('an inline loop binds its variable for its body only', () => {
    const body: Inline[] = [
      { t: 'each', alias: 'director', list: 'umbrella.directors', body: [slot('director.name')] },
      slot('director.name'),
    ];
    expect(rules([para(body)])).toEqual(['unbound_variable']);
  });

  test('“any” over a list binds the test only, not the text under it', () => {
    expect(rules([{ t: 'if', cond: 'any director.is_interested', then: [para([])] }])).toEqual([]);
    expect(rules([{ t: 'if', cond: 'any director.is_interested', then: [para([slot('director.name')])] }])).toEqual([
      'unbound_variable',
    ]);
    expect(rules([{ t: 'if', cond: 'any portfolio.has_hurdle', then: [para([])] }])).toEqual(['condition_form']);
  });

  test('unknown_zone', () => {
    expect(rules([{ t: 'zone', id: 'z1', zone: 'market_outlook', instructions: [] }])).toEqual(['unknown_zone']);
  });

  test.each([
    [[{ t: 'text', v: 'Issuer: ' }, ...DESIGNATION]],
    [[slot('umbrella.legal_name'), { t: 'text', v: ' for the account of ' }, slot('portfolio.legal_name')]],
    [[{ t: 'text', v: 'Meridian Horizon SPC Limited for and on behalf of ' }, slot('portfolio.legal_name')]],
    [[]],
  ] as Inline[][][])('locked_wording: anything but the exact designation (%#)', (text) => {
    expect(rules([{ t: 'locked', id: 'l1', kind: 'contracting_party', text }])).toEqual(['locked_wording']);
  });

  test('problems name the nearest block', () => {
    const problems = checkImportRules(tree([{ t: 'if', cond: 'x.y', then: [para([], 'c_4_1')] }]), catalogue);
    expect(problems).toEqual([
      { rule: 'unknown_field', at: 'c_4_1', message: 'Condition x.y is not in the field catalogue' },
    ]);
  });
});

describe('format', () => {
  const t = tree([para([{ t: 'text', v: 'A' }], 'a'), para([{ t: 'text', v: 'B' }], 'b')]);

  test('the hash depends on content and ids, not on key order', () => {
    const reordered = JSON.parse(`{"body":${JSON.stringify(t.body)},"template":"T","format":"${FORMAT}"}`);
    expect(contentHash(reordered)).toBe(contentHash(t));
    expect(contentHash(tree([para([{ t: 'text', v: 'A ' }], 'a'), t.body[1] as Block]))).not.toBe(contentHash(t));
  });

  test('the schema refuses duplicate ids and unknown shapes', () => {
    expect(TemplateTreeSchema.safeParse(t).success).toBe(true);
    expect(TemplateTreeSchema.safeParse(tree([para([], 'a'), para([], 'a')])).success).toBe(false);
    expect(TemplateTreeSchema.safeParse({ ...t, body: [{ t: 'raw', v: '[[x]]' }] }).success).toBe(false);
    expect(TemplateTreeSchema.safeParse(tree([{ t: 'para', id: 'bad id!', style: 'body', text: [] }])).success).toBe(
      false,
    );
  });
});
