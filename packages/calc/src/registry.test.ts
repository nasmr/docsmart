// Keeps the calculations in step with templates/fields/catalogue.json, and runs them on the
// Meridian Horizon fixtures.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { sharesToIssue } from './calculations.js';
import { calculatedFields, notYetCalculated } from './registry.js';

const repo = new URL('../../../', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, repo), 'utf8'));

interface CatalogueField {
  type: string;
  origin: string;
}
const catalogue: { fields: Record<string, CatalogueField> } = json('templates/fields/catalogue.json');

describe('catalogue', () => {
  const calculatedInCatalogue = Object.entries(catalogue.fields)
    .filter(([, f]) => f.origin === 'calculated')
    .map(([name]) => name)
    .sort();

  test('every calculated field has a calculation or a stated reason why not', () => {
    expect([...Object.keys(calculatedFields), ...Object.keys(notYetCalculated)].sort()).toEqual(calculatedInCatalogue);
  });

  test('every calculation produces a field the catalogue marks as calculated', () => {
    for (const field of Object.keys(calculatedFields)) expect(catalogue.fields[field]?.origin).toBe('calculated');
  });

  test('every input is a catalogue field of the type the calculation expects', () => {
    const expected: Record<string, string> = {
      quantity: 'share_count',
      price_per_share: 'money',
      cost_per_share: 'money',
      allocated_amount: 'money',
      subscription_price: 'money',
    };
    for (const { inputs } of Object.values(calculatedFields)) {
      for (const [param, field] of Object.entries(inputs)) {
        expect(catalogue.fields[field]?.type, `${field} feeding ${param}`).toBe(expected[param]);
      }
    }
  });

  test('every output has the type the catalogue gives the field', () => {
    expect(catalogue.fields['asset.total_consideration']?.type).toBe('money');
    expect(catalogue.fields['asset.markup_pct']?.type).toBe('rate');
    expect(catalogue.fields['subscription.shares']?.type).toBe('share_count');
  });
});

describe('Meridian Horizon fixtures', () => {
  const F = 'fixtures/meridian-horizon/';
  const atlas = json(`${F}portfolios/atlas.json`);
  const lumen = json(`${F}portfolios/lumen.json`);
  const atlas2 = json(`${F}portfolios/atlas-ii.json`);

  test('total consideration for each portfolio', () => {
    const total = (p: typeof atlas) =>
      calculatedFields['asset.total_consideration'].calculate({
        quantity: p.asset.quantity,
        price_per_share: p.asset.price_per_share,
      }).value;
    expect(total(lumen)).toEqual({ amount: '3000000.00', currency: 'USD' });
    expect(total(atlas)).toEqual({ amount: '5000000.00', currency: 'USD' });
    expect(total(atlas2)).toEqual({ amount: '2000000.00', currency: 'USD' });
  });

  test('markup on the sponsor-sourced asset (Atlas)', () => {
    const r = calculatedFields['asset.markup_pct'].calculate({
      price_per_share: atlas.asset.price_per_share,
      cost_per_share: atlas.asset.gp_cost_basis_per_share,
    });
    expect(r.value).toBe('0.329787');
  });

  test.each([
    ['atlas', atlas, 47000],
    ['lumen', lumen, 20000],
  ])('shares for every %s subscription', (name, portfolio, totalShares) => {
    const subs: Array<{ allocation: { allocated: { amount: string; currency: string } } }> = json(
      `${F}subscriptions/${name}.json`,
    );
    let sum = 0;
    for (const s of subs) {
      const r = sharesToIssue({
        allocated_amount: s.allocation.allocated,
        subscription_price: portfolio.terms.subscription_price,
      });
      expect(Number.isInteger(r.value)).toBe(true);
      sum += r.value;
    }
    expect(sum).toBe(totalShares);
  });
});
