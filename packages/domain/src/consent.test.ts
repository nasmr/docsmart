import { describe, expect, test } from 'vitest';
import { ADMINISTER_HOLDING, type ConsentGrant, joiningGrant, mayRead } from './consent.js';

const request = (over: Partial<Parameters<typeof mayRead>[1]> = {}) => ({
  party_id: 'pty_002',
  portfolio_id: 'pf_lumen',
  purpose: ADMINISTER_HOLDING,
  at: '2026-12-01T00:00:00Z',
  ...over,
});

describe('INV-14: consent is scoped to a portfolio', () => {
  const lumen = joiningGrant('pty_002', 'pf_lumen', '2026-11-02T00:00:00Z');

  test('joining a portfolio grants consent for that portfolio', () => {
    expect(lumen).toEqual({
      party_id: 'pty_002',
      portfolio_id: 'pf_lumen',
      purpose: ADMINISTER_HOLDING,
      granted_at: '2026-11-02T00:00:00Z',
      expires_at: null,
    });
    expect(mayRead([lumen], request())).toBe(true);
  });

  test('and not for any other portfolio under the same umbrella', () => {
    expect(mayRead([lumen], request({ portfolio_id: 'pf_atlas' }))).toBe(false);
  });

  test('a grant for one investor does not cover another', () => {
    expect(mayRead([lumen], request({ party_id: 'pty_009' }))).toBe(false);
  });

  test('a grant is for its purpose only', () => {
    expect(mayRead([lumen], request({ purpose: 'marketing' }))).toBe(false);
  });

  test('a grant does not apply before it was given or after it expires', () => {
    const g: ConsentGrant = { ...lumen, expires_at: '2027-01-01T00:00:00Z' };
    expect(mayRead([g], request({ at: '2026-11-01T00:00:00Z' }))).toBe(false);
    expect(mayRead([g], request({ at: '2026-12-31T23:59:59Z' }))).toBe(true);
    expect(mayRead([g], request({ at: '2027-01-01T00:00:00Z' }))).toBe(false);
  });

  test('an existing investor subscribing to a second portfolio needs a grant for it (D1SP-C)', () => {
    const atlas = joiningGrant('pty_002', 'pf_atlas', '2027-01-15T00:00:00Z');
    expect(mayRead([lumen], request({ portfolio_id: 'pf_atlas', at: '2027-01-20T00:00:00Z' }))).toBe(false);
    expect(mayRead([lumen, atlas], request({ portfolio_id: 'pf_atlas', at: '2027-01-20T00:00:00Z' }))).toBe(true);
  });

  test('no grants means no access', () => {
    expect(mayRead([], request())).toBe(false);
  });

  test('an unreadable time is an error, not a quiet refusal', () => {
    expect(() => mayRead([lumen], request({ at: 'yesterday' }))).toThrow(/Invalid time/);
  });
});
