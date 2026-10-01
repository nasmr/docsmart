// Randomised checks against an independent implementation that uses BigInt scaled integers
// instead of decimal.js. Seeded, so every run checks the same cases.
import { describe, expect, test } from 'vitest';
import { markup, sharesToIssue, totalConsideration } from './calculations.js';

const RUNS = 2000;

// mulberry32: small, fast, deterministic.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

/** A decimal string with `scale` places, as an integer count of 10^-scale units plus the string. */
function decimal(r: () => number, maxUnits: number, scale: number) {
  const units = BigInt(int(r, 1, maxUnits));
  return { units, scale, text: unitsToString(units, scale) };
}
function unitsToString(units: bigint, scale: number): string {
  const neg = units < 0n;
  const s = (neg ? -units : units).toString().padStart(scale + 1, '0');
  const body = scale ? `${s.slice(0, -scale)}.${s.slice(-scale)}` : s;
  return neg ? `-${body}` : body;
}
const usd = (amount: string) => ({ amount, currency: 'USD' });
const pow10 = (n: number) => 10n ** BigInt(n);

describe('against a BigInt oracle', () => {
  test('total consideration is exactly quantity × price', () => {
    const r = rng(1);
    for (let i = 0; i < RUNS; i++) {
      const quantity = int(r, 1, 10_000_000);
      const price = decimal(r, 100_000_000, int(r, 0, 6));
      const expected = unitsToString(BigInt(quantity) * price.units, price.scale);
      expect(totalConsideration({ quantity, price_per_share: usd(price.text) }).value.amount).toBe(expected);
    }
  });

  test('shares are the largest whole number that the amount pays for', () => {
    const r = rng(2);
    for (let i = 0; i < RUNS; i++) {
      const scale = int(r, 0, 4);
      const amount = decimal(r, 1_000_000_000, scale);
      const price = decimal(r, 10_000_000, int(r, 0, 4));
      // Bring both to a common scale, then integer-divide.
      const s = Math.max(amount.scale, price.scale);
      const a = amount.units * pow10(s - amount.scale);
      const p = price.units * pow10(s - price.scale);
      const expected = a / p; // BigInt division truncates, which is floor for positives
      const shares = sharesToIssue({ allocated_amount: usd(amount.text), subscription_price: usd(price.text) }).value;
      expect(BigInt(shares)).toBe(expected);
      // and the invariant directly: shares × price ≤ amount < (shares + 1) × price
      expect(BigInt(shares) * p <= a && a < (BigInt(shares) + 1n) * p).toBe(true);
    }
  });

  test('markup is (price − cost) ÷ cost rounded half away from zero to six places', () => {
    const r = rng(3);
    for (let i = 0; i < RUNS; i++) {
      const scale = int(r, 0, 4);
      const cost = decimal(r, 10_000_000, scale);
      const price = decimal(r, 20_000_000, scale);
      // (price - cost) / cost, scaled by 10^6, rounded half away from zero.
      const num = (price.units - cost.units) * pow10(6);
      const den = cost.units;
      const q = num / den;
      const rem = num % den;
      const twice = 2n * (rem < 0n ? -rem : rem);
      const rounded = twice >= den ? q + (num < 0n ? -1n : 1n) : q;
      const expected = rounded === 0n ? '0.000000' : unitsToString(rounded, 6);
      expect(markup({ price_per_share: usd(price.text), cost_per_share: usd(cost.text) }).value).toBe(expected);
    }
  });
});
