import { describe, expect, test } from 'vitest';
import type { Finding } from './documents.js';
import { evaluateGate, type GateFacts } from './gate.js';
import { HASH_A, HASH_B, passingFacts, passingSubscriptionFacts } from './test-facts.js';

const finding = (over: Partial<Finding>): Finding => ({
  id: 'f1',
  version_id: 'ver_1',
  check: 'defined_terms',
  severity: 'review',
  at: 'c_2_1',
  message: 'x',
  ...over,
});
const conditions = (f: GateFacts) => evaluateGate(f).failures.map((x) => x.condition);
const ref = (f: GateFacts, kind: 'U3' | 'D13') => {
  const r = f.references.find((x) => x.kind === kind);
  if (!r) throw new Error(`no ${kind} reference`);
  return r;
};

describe('passing', () => {
  test('a clean D12 passes', () => {
    expect(evaluateGate(passingFacts())).toEqual({ passed: true, failures: [] });
  });

  test('a clean D1-SP built on frozen U3 and D13 passes', () => {
    expect(evaluateGate(passingSubscriptionFacts()).passed).toBe(true);
  });

  test('a review finding kept with a reason passes', () => {
    const f = passingFacts({
      findings: [finding({})],
      dispositions: [{ finding_id: 'f1', decision: 'keep', reason: 'Defined in the OM.', by: 'u1', at: '2026-10-01' }],
    });
    expect(evaluateGate(f).passed).toBe(true);
  });
});

describe('each condition fails on its own', () => {
  test('1: template not approved', () => {
    expect(conditions(passingFacts({ template: { version_id: 't', status: 'retired' } }))).toEqual([1]);
    expect(conditions(passingFacts({ template: { version_id: 't', status: 'draft' } }))).toEqual([1]);
  });

  test('2: a required-slot finding', () => {
    expect(conditions(passingFacts({ findings: [finding({ check: 'required_slot', severity: 'blocks' })] }))).toEqual([
      2,
    ]);
  });

  test('3: a contracting-party finding (INV-9)', () => {
    expect(
      conditions(passingFacts({ findings: [finding({ check: 'contracting_party', severity: 'blocks' })] })),
    ).toEqual([3]);
  });

  test('4: a cross-portfolio finding (INV-10)', () => {
    expect(conditions(passingFacts({ findings: [finding({ check: 'cross_portfolio', severity: 'blocks' })] }))).toEqual(
      [4],
    );
  });

  test('5: another blocking finding', () => {
    expect(conditions(passingFacts({ findings: [finding({ check: 'cross_reference', severity: 'blocks' })] }))).toEqual(
      [5],
    );
  });

  test('5: a required check that did not run', () => {
    const r = evaluateGate(
      passingFacts({ checks_run: ['required_slot', 'cross_reference', 'defined_terms', 'contracting_party'] }),
    );
    expect(r.failures).toEqual([expect.objectContaining({ condition: 5, refs: ['cross_portfolio'] })]);
  });

  test('6: a review finding with no decision', () => {
    expect(conditions(passingFacts({ findings: [finding({})] }))).toEqual([6]);
  });

  test('6: a decision to fix is not a decision to keep', () => {
    const f = passingFacts({
      findings: [finding({})],
      dispositions: [{ finding_id: 'f1', decision: 'fix', by: 'u', at: 't' }],
    });
    expect(conditions(f)).toEqual([6]);
  });

  test('6: keeping without a reason does not count', () => {
    const f = passingFacts({
      findings: [finding({})],
      dispositions: [{ finding_id: 'f1', decision: 'keep', reason: '   ', by: 'u', at: 't' }],
    });
    expect(conditions(f)).toEqual([6]);
  });

  test('7: the guardrail blocked or did not run', () => {
    expect(
      conditions(passingFacts({ ai_zones: [{ zone: 'issuer_description', guardrail: 'blocked', statements: [] }] })),
    ).toEqual([7]);
    expect(
      conditions(passingFacts({ ai_zones: [{ zone: 'issuer_description', guardrail: 'not_run', statements: [] }] })),
    ).toEqual([7]);
  });

  test('7: an unsupported statement not kept', () => {
    const zone = {
      zone: 'issuer_description',
      guardrail: 'passed' as const,
      statements: [{ id: 's1', source_check: 'unsupported' as const }],
    };
    expect(conditions(passingFacts({ ai_zones: [zone] }))).toEqual([7]);
  });

  test('7: a statement that was never source-checked', () => {
    const zone = {
      zone: 'issuer_description',
      guardrail: 'passed' as const,
      statements: [{ id: 's1', source_check: 'not_run' as const }],
    };
    expect(conditions(passingFacts({ ai_zones: [zone] }))).toEqual([7]);
  });

  test('8: D1-SP with no U3', () => {
    const f = passingSubscriptionFacts();
    expect(conditions({ ...f, references: f.references.filter((r) => r.kind !== 'U3') })).toEqual([8]);
  });

  test('8: the supplement is still ASSEMBLED', () => {
    const f = passingSubscriptionFacts();
    f.references[1] = { ...ref(f, 'D13'), state: 'ASSEMBLED' };
    expect(conditions(f)).toEqual([8]);
  });

  test('8: built on an older supplement version', () => {
    const f = passingSubscriptionFacts();
    f.references[1] = { ...ref(f, 'D13'), latest_frozen_version_id: 'ver_d13_3' };
    expect(conditions(f)).toEqual([8]);
  });

  test('8: the recorded hash does not match the referenced version', () => {
    const f = passingSubscriptionFacts();
    f.references[0] = { ...ref(f, 'U3'), recorded_hash: HASH_A };
    expect(conditions(f)).toEqual([8]);
  });

  test('8: two supplements referenced', () => {
    const f = passingSubscriptionFacts();
    f.references.push({ ...ref(f, 'D13'), version_id: 'ver_x', latest_frozen_version_id: 'ver_x' });
    expect(conditions(f)).toContain(8);
  });

  test('9: not the latest version', () => {
    expect(conditions(passingFacts({ latest_version_id: 'ver_2' }))).toEqual([9]);
  });
});

describe('invariants cannot be kept', () => {
  test.each(['required_slot', 'contracting_party', 'cross_portfolio'] as const)(
    'a %s finding fails even as review severity with a keep decision',
    (check) => {
      const f = passingFacts({
        findings: [finding({ check, severity: 'review' })],
        dispositions: [{ finding_id: 'f1', decision: 'keep', reason: 'Looks fine to me.', by: 'u', at: 't' }],
      });
      const expected = { required_slot: 2, contracting_party: 3, cross_portfolio: 4 }[check];
      expect(conditions(f)).toEqual([expected]); // fails once, under its own condition
    },
  );
});

test.each(['required_slot', 'contracting_party', 'cross_portfolio'] as const)(
  'an undecided %s finding at review severity is not offered as a decision for the sponsor',
  (check) => {
    // It can only be fixed, so it is reported under its own condition and never under condition 6.
    const expected = { required_slot: 2, contracting_party: 3, cross_portfolio: 4 }[check];
    expect(conditions(passingFacts({ findings: [finding({ check, severity: 'review' })] }))).toEqual([expected]);
  },
);

describe('facts that do not belong', () => {
  test('a finding from another version is reported, not ignored silently', () => {
    const r = evaluateGate(
      passingFacts({ findings: [finding({ version_id: 'ver_0', check: 'cross_portfolio', severity: 'blocks' })] }),
    );
    expect(r.failures).toEqual([expect.objectContaining({ condition: 0, refs: ['f1'] })]);
  });

  test('a version from another document fails', () => {
    const r = evaluateGate(passingFacts({ version: { id: 'ver_1', document_id: 'doc_other', content_hash: HASH_B } }));
    expect(r.failures.map((x) => x.condition)).toEqual([0]);
  });
});

test('reports every failed condition, not just the first', () => {
  const f = passingSubscriptionFacts({
    template: { version_id: 't', status: 'retired' },
    latest_version_id: 'ver_s2',
    findings: [
      finding({ id: 'a', version_id: 'ver_s1', check: 'cross_portfolio', severity: 'blocks' }),
      finding({ id: 'b', version_id: 'ver_s1' }),
    ],
    references: [],
  });
  expect(new Set(conditions(f))).toEqual(new Set([1, 4, 6, 8, 9]));
  expect(evaluateGate(f).failures.every((x) => x.message.length > 0)).toBe(true);
});
