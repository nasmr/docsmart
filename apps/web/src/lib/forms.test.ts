import { readFileSync } from 'node:fs';
import { Asset, Offer, Portfolio, PortfolioTerms, Sponsor, SubscriptionAccount, Umbrella } from '@docsmart/domain';
import { describe, expect, test } from 'vitest';
import type { z } from 'zod';
import {
  accountForm,
  addItem,
  assetForm,
  type Field,
  type FormSpec,
  fieldPaths,
  offerForm,
  portfolioForm,
  prepareForSave,
  sponsorForm,
  termsForm,
  umbrellaForm,
} from './forms.js';
import { type Data, setPath } from './paths.js';

const fx = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../../../fixtures/meridian-horizon/${path}`, import.meta.url), 'utf8'));
const portfolios = ['lumen', 'atlas', 'atlas-ii'].map((p) => fx(`portfolios/${p}.json`));

/** Every leaf path in a record, with list items numbered ("directors.0.name"). */
function leaves(v: unknown, prefix = ''): string[] {
  if (Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null))
    return v.flatMap((x, i) => leaves(x, `${prefix}${i}.`));
  if (typeof v === 'object' && v !== null && !Array.isArray(v))
    return Object.entries(v).flatMap(([k, x]) => leaves(x, `${prefix}${k}.`));
  return [prefix.slice(0, -1)];
}

const cases: Array<[string, FormSpec, z.ZodType, Data]> = [
  ['umbrella', umbrellaForm, Umbrella, fx('umbrella.json')],
  ['sponsor', sponsorForm, Sponsor, fx('sponsor.json')],
  ...portfolios.flatMap(
    (p): Array<[string, FormSpec, z.ZodType, Data]> => [
      [`${p.portfolio.id} portfolio`, portfolioForm, Portfolio, p.portfolio],
      [`${p.portfolio.id} terms`, termsForm, PortfolioTerms, p.terms],
      [`${p.portfolio.id} offer`, offerForm, Offer, p.offer],
      [`${p.portfolio.id} asset`, assetForm, Asset, p.asset],
      [`${p.portfolio.id} account`, accountForm, SubscriptionAccount, p.subscription_account],
    ],
  ),
];

describe('the forms cover the records', () => {
  test.each(cases)('%s: every value in the fixture has a field', (_, spec, __, record) => {
    const shown = fieldPaths(spec, record);
    // portfolio_id is set from the screen, not typed.
    const missing = leaves(record).filter(
      (leaf) => leaf !== 'portfolio_id' && !shown.some((p) => leaf === p || leaf.startsWith(`${p}.`)),
    );
    expect(missing).toEqual([]);
  });

  test.each(cases)('%s: saving an unchanged fixture sends it as it is', (_, spec, schema, record) => {
    const sent = prepareForSave(spec, record);
    expect(sent).toEqual(record);
    expect(schema.safeParse(sent).success).toBe(true);
  });
});

describe('preparing a record to save', () => {
  const lumen = portfolios[0].terms as Data;

  test('a hidden field is removed: no hurdle, no hurdle rate', () => {
    const withHurdle = { ...lumen, has_hurdle: true, hurdle_rate: '0.08' };
    expect(prepareForSave(termsForm, withHurdle).hurdle_rate).toBe('0.08');
    expect('hurdle_rate' in prepareForSave(termsForm, { ...withHurdle, has_hurdle: false })).toBe(false);
  });

  test('a blank optional money is removed even with its currency filled in', () => {
    const data = { ...lumen, costs_deducted_on_lapse: true, lapse_cost_cap: { amount: '', currency: 'USD' } };
    expect('lapse_cost_cap' in prepareForSave(termsForm, data)).toBe(false);
  });

  test('a blank required field is kept, so the API names it', () => {
    expect(prepareForSave(termsForm, { ...lumen, fee_basis: '' }).fee_basis).toBe('');
  });

  test('an optional group is dropped when nothing in it was entered, and kept when anything was', () => {
    const asset = portfolios[0].asset as Data;
    const blank = setPath(asset, 'valuation', { valuer_name: '', range_per_share: { low: '', currency: '' } });
    expect('valuation' in prepareForSave(assetForm, blank)).toBe(false);
    const partial = setPath(blank, 'valuation.valuer_name', 'Kroll');
    expect(prepareForSave(assetForm, partial).valuation).toMatchObject({ valuer_name: 'Kroll' });
  });

  test('sponsor-supplied fields go when the asset is not supplied by the sponsor', () => {
    const atlas = portfolios[1].asset as Data;
    expect(atlas.acquisition_source).toBe('gp_sourced');
    const sent = prepareForSave(assetForm, { ...atlas, acquisition_source: 'issuer_primary' });
    for (const key of ['gp_cost_basis_per_share', 'gp_acquisition_date', 'gp_cost_evidence', 'seller_affiliate_id'])
      expect(key in sent).toBe(false);
  });

  test('blank optional fields inside list items are removed', () => {
    const umbrella = fx('umbrella.json') as Data;
    const data = addItem(umbrella, umbrellaForm.sections[2]?.fields[0] as Extract<Field, { kind: 'list' }>);
    const directors = prepareForSave(umbrellaForm, setPath(data, 'directors.3.note', '')).directors as Data[];
    expect(directors[3]).toEqual({ id: 'dir_04', name: '', independent: false });
  });

  test('a new blank record, filled in, is what the API accepts', () => {
    let terms = termsForm.blank({ portfolio_id: 'pf_cedar', currency: 'USD' });
    for (const [path, value] of Object.entries({
      'min_subscription.amount': '25000.00',
      'subscription_price.amount': '1.00',
      mgmt_fee_rate: '0.015',
      fee_basis: 'subscribed capital',
      perf_fee_rate: '0.15',
      'org_expense_cap.amount': '50000.00',
      term_years: 5,
    }))
      terms = setPath(terms, path, value);
    expect(PortfolioTerms.safeParse(prepareForSave(termsForm, terms)).success).toBe(true);
  });
});
