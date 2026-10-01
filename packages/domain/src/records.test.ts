import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { z } from 'zod';
import {
  Asset,
  Offer,
  Party,
  PortfolioRecords,
  PortfolioTerms,
  Sponsor,
  SubscriptionRequest,
  Umbrella,
} from './records.js';

const fixture = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../../fixtures/meridian-horizon/${path}`, import.meta.url), 'utf8'));

/** The issues for a value, as "path: message" strings. */
function issues(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('the Meridian Horizon fixtures are valid records', () => {
  test('umbrella and sponsor', () => {
    expect(issues(Umbrella, fixture('umbrella.json'))).toEqual([]);
    expect(issues(Sponsor, fixture('sponsor.json'))).toEqual([]);
  });

  test.each(['lumen', 'atlas', 'atlas-ii'])('portfolio %s', (name) => {
    expect(issues(PortfolioRecords, fixture(`portfolios/${name}.json`))).toEqual([]);
  });

  test('all 44 parties', () => {
    const parties: unknown[] = fixture('parties.json');
    expect(parties).toHaveLength(44);
    for (const p of parties) expect(issues(Party, p)).toEqual([]);
  });

  test.each(['atlas', 'lumen'])('every %s subscription', (name) => {
    for (const s of fixture(`subscriptions/${name}.json`)) expect(issues(SubscriptionRequest, s)).toEqual([]);
  });
});

describe('record rules', () => {
  const lumen = () => fixture('portfolios/lumen.json');
  const atlas = () => fixture('portfolios/atlas.json');

  test('names follow decision 0003', () => {
    expect(issues(Umbrella, { ...fixture('umbrella.json'), legal_name: 'Meridian Horizon Limited' })).toEqual([
      'legal_name: must include “Segregated Portfolio Company” or “SPC” as words',
    ]);
    const r = lumen();
    r.portfolio.legal_name = 'Lumen SP';
    expect(issues(PortfolioRecords, r)).toEqual(['portfolio.legal_name: must include “Segregated Portfolio” as words']);
  });

  test('a sponsor-supplied asset needs its cost, date, evidence and affiliate (addendum §5.1)', () => {
    const a = atlas().asset;
    for (const k of ['gp_cost_basis_per_share', 'gp_acquisition_date', 'gp_cost_evidence', 'seller_affiliate_id']) {
      const copy = { ...a };
      delete copy[k];
      expect(issues(Asset, copy)).toEqual([
        `${k}: is required when the asset is supplied by the sponsor (addendum §5.1)`,
      ]);
    }
  });

  test('a cost basis on an asset not supplied by the sponsor is refused', () => {
    const a = { ...lumen().asset, gp_cost_basis_per_share: { amount: '1.00', currency: 'USD' } };
    expect(issues(Asset, a)).toEqual(['gp_cost_basis_per_share: is only for assets supplied by the sponsor']);
  });

  test('the cost basis is in the price currency', () => {
    const a = atlas().asset;
    a.gp_cost_basis_per_share.currency = 'EUR';
    expect(issues(Asset, a)).toEqual(['gp_cost_basis_per_share.currency: differs from the price currency']);
  });

  test.each([
    ['has_hurdle', 'hurdle_rate', 'when the performance fee has a hurdle'],
    ['costs_deducted_on_lapse', 'lapse_cost_cap', 'when costs are deducted on lapse'],
  ])('%s needs %s', (flag, field, why) => {
    const t = { ...lumen().terms, [flag]: true };
    delete t[field];
    expect(issues(PortfolioTerms, t)).toEqual([`${field}: is required ${why}`]);
  });

  test('flags that are false do not need their values', () => {
    expect(issues(PortfolioTerms, atlas().terms)).toEqual([]); // no hurdle, no lapse costs
  });

  test('a placement fee needs its agent and description', () => {
    const a = fixture('portfolios/atlas-ii.json').asset;
    a.placement = { has_fee: true };
    expect(issues(Asset, a)).toEqual([
      'placement.agent_name: is required when a placement fee is paid',
      'placement.fee_description: is required when a placement fee is paid',
    ]);
  });

  test('a trustee investor needs the trust name', () => {
    const p = fixture('parties.json').find((x: { is_trustee?: boolean }) => x.is_trustee);
    delete p.trust_name;
    expect(issues(Party, p)).toEqual(['trust_name: is required when the investor is a trustee']);
  });

  test('offer dates are in order', () => {
    const o = { ...lumen().offer, close_date: '2026-10-01', funding_deadline: '2026-09-01' };
    expect(issues(Offer, o)).toEqual([
      'close_date: is before the open date',
      'funding_deadline: is before the close date',
    ]);
  });

  test('an authorised signatory must be a director', () => {
    const u = fixture('umbrella.json');
    u.authorised_signatories[0].director_id = 'dir_99';
    expect(issues(Umbrella, u)).toEqual(['authorised_signatories.0.director_id: is not a director']);
  });

  test('a portfolio’s records all belong to it', () => {
    const r = lumen();
    r.asset.portfolio_id = 'pf_atlas';
    expect(issues(PortfolioRecords, r)).toEqual(['asset.portfolio_id: is not pf_lumen']);
  });

  test.each([
    ['1e5', 'must be a plain decimal number'],
    ['-1.00', 'must not be negative'],
  ])('money amount %j is refused', (amount, message) => {
    const t = lumen().terms;
    t.min_subscription.amount = amount;
    expect(issues(PortfolioTerms, t)).toEqual([`min_subscription.amount: ${message}`]);
  });

  test.each(['1.5', '-0.1', '2', '0.2.1'])('rate %j is refused', (rate) => {
    expect(issues(PortfolioTerms, { ...lumen().terms, mgmt_fee_rate: rate })).toEqual([
      'mgmt_fee_rate: must be a decimal fraction between 0 and 1',
    ]);
  });

  test('a misspelt field is refused rather than ignored', () => {
    expect(issues(PortfolioTerms, { ...lumen().terms, hurdel_rate: '0.08' })[0]).toMatch(/hurdel_rate/);
  });

  test('a calculated value cannot be stored as a record', () => {
    expect(
      issues(Asset, { ...lumen().asset, total_consideration: { amount: '3000000.00', currency: 'USD' } })[0],
    ).toMatch(/total_consideration/);
  });
});
