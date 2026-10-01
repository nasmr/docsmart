import { describe, expect, test } from 'vitest';
import { markup, sharesToIssue, totalConsideration } from './calculations.js';

const usd = (amount: unknown) => ({ amount, currency: 'USD' }) as { amount: string; currency: string };

describe('amounts must be plain decimal strings', () => {
  test.each([
    ['1e5', 'exponent'],
    ['.5', 'no leading digit'],
    ['12.', 'trailing point'],
    ['+12.00', 'plus sign'],
    [' 12.00', 'whitespace'],
    ['12,000.00', 'thousands separator'],
    ['100k', 'suffix'],
    ['0x10', 'hexadecimal'],
    ['NaN', 'not a number'],
    ['Infinity', 'infinity'],
    ['', 'empty'],
  ])('rejects %j (%s)', (amount) => {
    expect(() => totalConsideration({ quantity: 1, price_per_share: usd(amount) })).toThrow(
      expect.objectContaining({ code: 'invalid_input', input: 'price_per_share.amount' }),
    );
  });

  test.each([[12.5], [null], [undefined]])('rejects a non-string amount %j', (amount) => {
    expect(() => totalConsideration({ quantity: 1, price_per_share: usd(amount) })).toThrow(
      expect.objectContaining({ code: 'invalid_input', input: 'price_per_share.amount' }),
    );
  });

  test('rejects a negative amount', () => {
    expect(() => sharesToIssue({ allocated_amount: usd('-1.00'), subscription_price: usd('1.00') })).toThrow(
      expect.objectContaining({ code: 'out_of_range', input: 'allocated_amount.amount' }),
    );
  });
});

describe('money must have an ISO currency', () => {
  test.each([['usd'], ['US'], ['USDT'], [''], [undefined]])('rejects currency %j', (currency) => {
    const price = { amount: '1.00', currency } as { amount: string; currency: string };
    expect(() => totalConsideration({ quantity: 1, price_per_share: price })).toThrow(
      expect.objectContaining({ code: 'invalid_input', input: 'price_per_share.currency' }),
    );
  });

  test.each([[null], ['12.00'], [12]])('rejects money given as %j', (money) => {
    expect(() =>
      markup({
        price_per_share: money as unknown as { amount: string; currency: string },
        cost_per_share: usd('1.00'),
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_input', input: 'price_per_share' }));
  });
});

describe('share counts must be positive whole numbers', () => {
  test.each([
    [1.5, 'invalid_input'],
    [Number.NaN, 'invalid_input'],
    [Number.POSITIVE_INFINITY, 'invalid_input'],
    [9007199254740992, 'invalid_input'], // beyond the safe integer range
    ['400000', 'invalid_input'],
    [0, 'out_of_range'],
    [-5, 'out_of_range'],
  ])('rejects %j', (quantity, code) => {
    expect(() => totalConsideration({ quantity: quantity as number, price_per_share: usd('1.00') })).toThrow(
      expect.objectContaining({ code, input: 'quantity' }),
    );
  });
});

test('error messages name the input', () => {
  expect(() => markup({ price_per_share: usd('12.50'), cost_per_share: usd('1e3') })).toThrow(
    /^cost_per_share\.amount: “1e3” is not a plain decimal number$/,
  );
});
