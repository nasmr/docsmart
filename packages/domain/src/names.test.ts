import { describe, expect, test } from 'vitest';
import {
  DESIGNATION_WORDING_STATUS,
  designation,
  InvalidNameError,
  portfolioNameProblems,
  umbrellaNameProblems,
} from './names.js';

describe('umbrella legal name (decision 0003)', () => {
  test.each([
    'Meridian Horizon SPC Limited',
    'Meridian Horizon Segregated Portfolio Company Limited',
    'SPC Holdings Ltd',
  ])('accepts %j', (name) => expect(umbrellaNameProblems(name)).toEqual([]));

  test.each([
    ['Meridian Horizon Limited', 'must include'],
    ['MeridianSPC Limited', 'must include'], // not a separate word
    ['Meridian Horizon Spc Limited', 'must include'], // wrong case
    [' Meridian Horizon SPC Limited', 'leading or trailing'],
    ['Meridian  Horizon SPC Limited', 'repeated spaces'],
    ['Meridian\tHorizon SPC Limited', 'repeated spaces, tabs'],
    ['', 'is empty'],
  ])('rejects %j', (name, problem) => {
    expect(umbrellaNameProblems(name).join(' ')).toContain(problem);
  });
});

describe('portfolio legal name (decision 0003)', () => {
  test.each(['Lumen Segregated Portfolio', 'Atlas II Segregated Portfolio', 'Segregated Portfolio 7'])(
    'accepts %j',
    (name) => expect(portfolioNameProblems(name)).toEqual([]),
  );

  test.each([['Lumen SP'], ['Lumen Segregated'], ['Lumen SegregatedPortfolio'], ['Lumen Segregated Portfolio ']])(
    'rejects %j',
    (name) => expect(portfolioNameProblems(name)).not.toEqual([]),
  );
});

describe('designation (DF-62)', () => {
  test('is generated from the two legal names', () => {
    expect(designation('Meridian Horizon SPC Limited', 'Atlas Segregated Portfolio')).toBe(
      'Meridian Horizon SPC Limited for and on behalf of Atlas Segregated Portfolio',
    );
  });

  test('refuses names that break the rules rather than producing wording', () => {
    expect(() => designation('Meridian Horizon Limited', 'Atlas Segregated Portfolio')).toThrow(InvalidNameError);
    expect(() => designation('Meridian Horizon SPC Limited', 'Atlas SP')).toThrow(/portfolio legal name “Atlas SP”/);
  });

  test('the wording is still a placeholder until counsel confirms it', () => {
    // Change this test only when decision 0003 is accepted on counsel's confirmation.
    expect(DESIGNATION_WORDING_STATUS).toBe('placeholder_pending_counsel');
  });
});
