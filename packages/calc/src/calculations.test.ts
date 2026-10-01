// Expected values were checked independently with Python's decimal module, not worked out by hand.
import { Decimal as DecimalJs } from 'decimal.js';
import { afterEach, describe, expect, test } from 'vitest';
import { markup, sharesToIssue, totalConsideration } from './calculations.js';
import { CalcError } from './errors.js';

const usd = (amount: string) => ({ amount, currency: 'USD' });

describe('totalConsideration', () => {
  test.each([
    [400000, '12.50', '5000000.00'],
    [250000, '12.00', '3000000.00'],
    [80000, '25.00', '2000000.00'],
    [3, '0.10', '0.30'], // 3 * 0.1 is 0.30000000000000004 in floating point
    [123456789, '98765.4321', '12193263111263.5269'],
    [9007199254740991, '0.01', '90071992547409.91'], // largest safe integer quantity
    [1, '12.5', '12.5'], // keeps the price's decimal places
    [7, '3', '21'],
  ])('%i × %s = %s', (quantity, price, expected) => {
    const r = totalConsideration({ quantity, price_per_share: usd(price) });
    expect(r.value).toEqual({ amount: expected, currency: 'USD' });
  });

  test('keeps the currency of the price', () => {
    expect(
      totalConsideration({ quantity: 2, price_per_share: { amount: '1.00', currency: 'GBP' } }).value.currency,
    ).toBe('GBP');
  });

  test('rejects a zero price', () => {
    expect(() => totalConsideration({ quantity: 1, price_per_share: usd('0.00') })).toThrow(CalcError);
  });
});

describe('markup', () => {
  test.each([
    ['12.50', '9.40', '0.329787'], // Atlas: 0.329787234… rounds down
    ['12.50', '10.00', '0.250000'],
    ['4.00', '3.00', '0.333333'],
    ['9.00', '10.00', '-0.100000'], // below cost
    ['10.00', '10.00', '0.000000'],
    ['2000001', '2000000', '0.000001'], // exactly half: rounds away from zero
    ['1999999', '2000000', '-0.000001'], // exactly half below zero: away from zero
    ['0.00', '10.00', '-1.000000'],
  ])('price %s on cost %s = %s', (price, cost, expected) => {
    expect(markup({ price_per_share: usd(price), cost_per_share: usd(cost) }).value).toBe(expected);
  });

  test('never returns negative zero', () => {
    // -0.0000001 rounds to zero at six places.
    expect(markup({ price_per_share: usd('9.999999'), cost_per_share: usd('10.000000') }).value).toBe('0.000000');
  });

  test('records the rounding it applied', () => {
    expect(markup({ price_per_share: usd('12.50'), cost_per_share: usd('9.40') }).evidence.rounding).toEqual({
      decimal_places: 6,
      mode: 'half_away_from_zero',
    });
  });

  test('rejects a zero cost', () => {
    const run = () => markup({ price_per_share: usd('12.50'), cost_per_share: usd('0') });
    expect(run).toThrow(expect.objectContaining({ code: 'division_by_zero', input: 'cost_per_share.amount' }));
  });

  test('rejects mixed currencies', () => {
    const run = () => markup({ price_per_share: usd('12.50'), cost_per_share: { amount: '9.40', currency: 'EUR' } });
    expect(run).toThrow(expect.objectContaining({ code: 'currency_mismatch', input: 'cost_per_share' }));
  });
});

describe('sharesToIssue', () => {
  test.each([
    ['100000.00', '100.00', 1000],
    ['125000.00', '100.00', 1250],
    ['500000.00', '50.00', 10000],
    ['100000.00', '30.00', 3333], // 3333.33…: fractions are not issued
    ['99.99', '100.00', 0],
    ['0.00', '100.00', 0],
    ['0.3', '0.1', 3], // floor(0.3 / 0.1) is 2 in floating point
  ])('%s at %s = %i shares', (amount, price, expected) => {
    expect(sharesToIssue({ allocated_amount: usd(amount), subscription_price: usd(price) }).value).toBe(expected);
  });

  test('records that it rounded down', () => {
    const r = sharesToIssue({ allocated_amount: usd('100000.00'), subscription_price: usd('30.00') });
    expect(r.evidence.rounding).toEqual({ decimal_places: 0, mode: 'down' });
  });

  test('rejects a zero price', () => {
    const run = () => sharesToIssue({ allocated_amount: usd('100.00'), subscription_price: usd('0.00') });
    expect(run).toThrow(expect.objectContaining({ code: 'division_by_zero', input: 'subscription_price.amount' }));
  });

  test('rejects an allocation in a different currency from the price', () => {
    const run = () =>
      sharesToIssue({ allocated_amount: { amount: '100.00', currency: 'GBP' }, subscription_price: usd('1.00') });
    expect(run).toThrow(expect.objectContaining({ code: 'currency_mismatch', input: 'allocated_amount' }));
  });
});

describe('evidence', () => {
  test('names the calculation, its version, the inputs and the output', () => {
    const inputs = { quantity: 400000, price_per_share: usd('12.50') };
    expect(totalConsideration(inputs).evidence).toEqual({
      computed_by: '@docsmart/calc',
      function: 'total_consideration',
      version: 1,
      inputs: { quantity: 400000, price_per_share: { amount: '12.50', currency: 'USD' } },
      output: { amount: '5000000.00', currency: 'USD' },
    });
  });

  test('is a copy: changing the inputs or the value afterwards does not change it', () => {
    const inputs = { quantity: 2, price_per_share: usd('1.00') };
    const r = totalConsideration(inputs);
    inputs.price_per_share.amount = '999.00';
    r.value.amount = 'tampered';
    expect(r.evidence.inputs.price_per_share.amount).toBe('1.00');
    expect(r.evidence.output.amount).toBe('2.00');
  });

  test('is deterministic and serialisable', () => {
    const run = () => markup({ price_per_share: usd('12.50'), cost_per_share: usd('9.40') });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    expect(JSON.parse(JSON.stringify(run().evidence))).toEqual(run().evidence);
  });
});

describe('isolation from global decimal.js settings', () => {
  const saved = { precision: DecimalJs.precision, rounding: DecimalJs.rounding };
  afterEach(() => {
    DecimalJs.set(saved);
  });

  test('a caller lowering global precision or changing rounding does not change results', () => {
    DecimalJs.set({ precision: 3, rounding: DecimalJs.ROUND_UP });
    expect(totalConsideration({ quantity: 123456789, price_per_share: usd('98765.4321') }).value.amount).toBe(
      '12193263111263.5269',
    );
    expect(markup({ price_per_share: usd('12.50'), cost_per_share: usd('9.40') }).value).toBe('0.329787');
    expect(sharesToIssue({ allocated_amount: usd('100000.00'), subscription_price: usd('30.00') }).value).toBe(3333);
  });
});
