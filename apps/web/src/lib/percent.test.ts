import { describe, expect, test } from 'vitest';
import { fractionToPercent, percentToFraction } from './percent.js';

describe('percentages ↔ fractions', () => {
  test.each([
    ['1.5', '0.015'],
    ['15', '0.15'],
    ['100', '1'],
    ['0', '0'],
    ['0.25', '0.0025'],
    ['2.00', '0.02'],
    ['32.98', '0.3298'],
    ['007', '0.07'],
    ['0.000001', '0.00000001'],
  ])('%s%% is %s', (percent, fraction) => {
    expect(percentToFraction(percent)).toBe(fraction);
  });

  test.each([
    ['0.015', '1.5'],
    ['0.15', '15'],
    ['1', '100'],
    ['1.0', '100'],
    ['0', '0'],
    ['0.0025', '0.25'],
    ['0.3298', '32.98'],
  ])('%s is %s%%', (fraction, percent) => {
    expect(fractionToPercent(fraction)).toBe(percent);
  });

  test('round trip is exact for long decimals', () => {
    const f = '0.123456789012345678901234567891';
    expect(percentToFraction(fractionToPercent(f) as string)).toBe(f);
  });

  test.each(['', 'abc', '-1', '1.', '.5', '1,5', '1e2', '5%'])('%j is not a percentage', (text) => {
    expect(percentToFraction(text)).toBeUndefined();
  });
});
