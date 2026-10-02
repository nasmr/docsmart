import { describe, expect, test } from 'vitest';
import { issuesAt, parseIssues, unplaced } from './issues.js';

describe('validation issues', () => {
  const issues = parseIssues([
    'legal_name: must include “Segregated Portfolio” as words',
    'min_subscription.amount: must be a plain decimal number',
    'directors.0.name: is required',
    '(record): Unrecognized key: "extra"',
    'no separator here',
  ]);

  test('parsed by path', () => {
    expect(issues[0]).toEqual({ path: 'legal_name', message: 'must include “Segregated Portfolio” as words' });
    expect(issues[3]).toEqual({ path: '', message: 'Unrecognized key: "extra"' });
    expect(issues[4]).toEqual({ path: '', message: 'no separator here' });
  });

  test('a field claims its own and its parts', () => {
    expect(issuesAt(issues, 'legal_name')).toEqual(['must include “Segregated Portfolio” as words']);
    expect(issuesAt(issues, 'min_subscription')).toEqual(['amount: must be a plain decimal number']);
    expect(issuesAt(issues, 'directors.0.name')).toEqual(['is required']);
    expect(issuesAt(issues, 'legal')).toEqual([]);
  });

  test('what no field claims goes to the top', () => {
    expect(unplaced(issues, ['legal_name', 'min_subscription', 'directors.0.name']).map((i) => i.message)).toEqual([
      'Unrecognized key: "extra"',
      'no separator here',
    ]);
  });
});
