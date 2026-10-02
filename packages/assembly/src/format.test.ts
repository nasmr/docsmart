// Decision 0011, rule by rule.
import { describe, expect, test } from 'vitest';
import {
  formatCalculatedRate,
  formatCount,
  formatDate,
  formatEnteredRate,
  formatEnum,
  formatMoney,
  formatMoneyRange,
  formatTime,
  formatValue,
} from './format.js';

const usd = (amount: string) => ({ amount, currency: 'USD' });

describe('dates and times', () => {
  test.each([
    ['2026-10-01', '1 October 2026'],
    ['2024-06-18', '18 June 2024'],
    ['2027-01-04', '4 January 2027'],
    ['2026-12-31', '31 December 2026'],
  ])('%s → %s', (iso, out) => expect(formatDate(iso)).toBe(out));

  test.each(['2026-13-01', '2026-00-10', '01/10/2026', '2026-10-1', '', 20261001])('refuses %j', (v) =>
    expect(() => formatDate(v)).toThrow(),
  );

  test.each([
    ['15:00+04:00', '15:00 (UTC+04:00)'],
    ['09:30-05:00', '09:30 (UTC-05:00)'],
    ['00:00Z', '00:00 (UTC+00:00)'],
  ])('%s → %s', (iso, out) => expect(formatTime(iso)).toBe(out));

  test.each(['15:00', '25:00+00:00', '3pm'])('refuses time %j without an offset or out of range', (v) =>
    expect(() => formatTime(v)).toThrow(),
  );
});

describe('money: ISO code, commas, never rounded', () => {
  test.each([
    ['3000000.00', 'USD 3,000,000.00'],
    ['3000000', 'USD 3,000,000.00'],
    ['12.5', 'USD 12.50'],
    ['0.0125', 'USD 0.0125'], // more places only when the record holds more
    ['12.500', 'USD 12.50'], // trailing zeros beyond the minor unit dropped
    ['999.99', 'USD 999.99'],
    ['1000', 'USD 1,000.00'],
    ['0.01', 'USD 0.01'],
    ['100000.00', 'USD 100,000.00'],
    ['9007199254740993.10', 'USD 9,007,199,254,740,993.10'], // beyond floating point, still exact
  ])('%s → %s', (amount, out) => expect(formatMoney(usd(amount))).toBe(out));

  test('currencies without a minor unit, and with three', () => {
    expect(formatMoney({ amount: '1500', currency: 'JPY' })).toBe('JPY 1,500');
    expect(formatMoney({ amount: '1.5', currency: 'KWD' })).toBe('KWD 1.500');
  });

  test.each([
    [{ amount: '1e5', currency: 'USD' }],
    [{ amount: '-1.00', currency: 'USD' }],
    [{ amount: '1.00', currency: 'usd' }],
    [{ amount: 12, currency: 'USD' }],
    [null],
  ])('refuses %j', (m) => expect(() => formatMoney(m)).toThrow());

  test('range', () =>
    expect(formatMoneyRange({ low: '11.80', high: '13.10', currency: 'USD' })).toBe('USD 11.80 to USD 13.10'));
});

describe('rates', () => {
  test.each([
    ['0.02', '2%'],
    ['0.015', '1.5%'],
    ['0.00125', '0.125%'],
    ['0.2', '20%'],
    ['0.08', '8%'],
    ['1', '100%'],
    ['0', '0%'],
  ])('entered %s → %s, exactly', (r, out) => expect(formatEnteredRate(r)).toBe(out));

  test.each([
    ['0.329787', '32.98%'],
    ['0.25', '25.00%'],
    ['-0.1', '-10.00%'],
    ['0.000049', '0.00%'],
    ['0.00005', '0.01%'], // half away from zero
    ['-0.00004', '0.00%'], // never "-0.00%"
  ])('calculated %s → %s, two places', (r, out) => expect(formatCalculatedRate(r)).toBe(out));
});

describe('counts, enums and the rest', () => {
  test.each([
    [400000, '400,000'],
    [7, '7'],
    [1000, '1,000'],
    [9007199254740991, '9,007,199,254,740,991'],
  ])('%i → %s', (n, out) => expect(formatCount(n)).toBe(out));

  test.each([[1.5], ['400000'], [Number.NaN]])('refuses count %j', (n) => expect(() => formatCount(n)).toThrow());

  test('enums use the catalogue label, or underscores as spaces', () => {
    expect(formatEnum('semi_annually', { semi_annually: 'semi-annually' })).toBe('semi-annually');
    expect(formatEnum('private_investment_fund')).toBe('private investment fund');
  });

  test('booleans are never printed', () => expect(() => formatValue('boolean', true)).toThrow(/never printed/));

  test('text is printed exactly, but never empty', () => {
    expect(formatValue('text', 'Meridian Horizon SPC Limited')).toBe('Meridian Horizon SPC Limited');
    expect(() => formatValue('text', '  ')).toThrow();
    expect(() => formatValue('address', undefined)).toThrow();
  });

  test('calculated rates use the calculated rule; entered rates the entered rule', () => {
    expect(formatValue('rate', '0.329787', { calculated: true })).toBe('32.98%');
    expect(formatValue('rate', '0.329787')).toBe('32.9787%');
  });
});
