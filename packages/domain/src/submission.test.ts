import { describe, expect, test } from 'vitest';
import { createDraftVersion, type DraftVersion } from './documents.js';
import { applyEvent, type DocumentLifecycle, startDocument } from './lifecycle.js';
import { createSubmissionPackage, verifySubmissionPackage } from './submission.js';
import { HASH_A, HASH_B, HASH_C, passingFacts, passingSubscriptionFacts } from './test-facts.js';

function readyLumen(): DocumentLifecycle {
  let d = startDocument({
    document_id: 'doc_lumen_d12',
    document_class: 'D12',
    scope: 'portfolio',
    portfolio_id: 'pf_lumen',
  });
  for (const e of [
    { type: 'VERSION_ASSEMBLED', version: { id: 'ver_1', number: 1, content_hash: HASH_A } } as const,
    { type: 'MARK_READY', facts: passingFacts(), actor: 'sponsor_1' } as const,
  ]) {
    const r = applyEvent(d, e);
    if (!r.ok) throw new Error(r.reason);
    d = r.lifecycle;
  }
  return d;
}

describe('submission package', () => {
  test('freezes the version with its findings and decisions', () => {
    const facts = passingFacts({
      findings: [
        { id: 'f1', version_id: 'ver_1', check: 'defined_terms', severity: 'review', at: 'c_1_2', message: 'm' },
      ],
      dispositions: [{ finding_id: 'f1', decision: 'keep', reason: 'Defined in the OM.', by: 'sponsor_1', at: 't' }],
    });
    const p = createSubmissionPackage(readyLumen(), facts, 'sponsor_1', '2026-10-01T09:00:00Z');
    expect(p).toMatchObject({
      document_id: 'doc_lumen_d12',
      version_id: 'ver_1',
      content_hash: HASH_A,
      template_version_id: 'tpl_d12a_1',
      findings: [expect.objectContaining({ id: 'f1' })],
      dispositions: [expect.objectContaining({ finding_id: 'f1', decision: 'keep' })],
      passed_by: 'sponsor_1',
    });
    expect(p.package_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('records the hashes of the documents a D1-SP is built on', () => {
    let d = startDocument({
      document_id: 'doc_atlas_d1sp_pty_001',
      document_class: 'D1-SP',
      scope: 'portfolio',
      portfolio_id: 'pf_atlas',
    });
    const v = { id: 'ver_s1', number: 1, content_hash: HASH_A };
    const facts = passingSubscriptionFacts();
    for (const e of [
      { type: 'VERSION_ASSEMBLED', version: v } as const,
      { type: 'MARK_READY', facts, actor: 's' } as const,
    ]) {
      const r = applyEvent(d, e);
      if (!r.ok) throw new Error(r.reason);
      d = r.lifecycle;
    }
    expect(createSubmissionPackage(d, facts, 's', 't').references).toEqual({
      U3: { version_id: 'ver_u3_1', content_hash: HASH_B },
      D13: { version_id: 'ver_d13_2', content_hash: HASH_C },
    });
  });

  test('is frozen: nothing in it can be changed', () => {
    const p = createSubmissionPackage(readyLumen(), passingFacts(), 's', 't');
    expect(() => {
      (p as { content_hash: string }).content_hash = HASH_B;
    }).toThrow(TypeError);
    expect(() => {
      (p.findings as unknown[]).push({});
    }).toThrow(TypeError);
  });

  test('its hash detects a change made to a copy', () => {
    const p = createSubmissionPackage(readyLumen(), passingFacts(), 's', 't');
    expect(verifySubmissionPackage(p)).toBe(true);
    expect(verifySubmissionPackage({ ...p, content_hash: HASH_B })).toBe(false);
  });

  test('is deterministic', () => {
    const make = () => createSubmissionPackage(readyLumen(), passingFacts(), 's', '2026-10-01T09:00:00Z');
    expect(make().package_hash).toBe(make().package_hash);
  });

  test('is refused unless the document is READY_FOR_SUBMISSION on that version', () => {
    const assembled = startDocument({
      document_id: 'doc_lumen_d12',
      document_class: 'D12',
      scope: 'portfolio',
      portfolio_id: 'pf_lumen',
    });
    expect(() => createSubmissionPackage(assembled, passingFacts(), 's', 't')).toThrow(/DRAFTING/);
    const otherVersion = passingFacts({
      version: { id: 'ver_2', document_id: 'doc_lumen_d12', content_hash: HASH_A },
      latest_version_id: 'ver_2',
    });
    expect(() => createSubmissionPackage(readyLumen(), otherVersion, 's', 't')).toThrow(/not for the version/);
  });

  test('is refused when the facts no longer pass the gate', () => {
    const facts = passingFacts({
      findings: [{ id: 'f', version_id: 'ver_1', check: 'cross_portfolio', severity: 'blocks', at: 'c', message: 'm' }],
    });
    expect(() => createSubmissionPackage(readyLumen(), facts, 's', 't')).toThrow(/INV-10/);
  });
});

describe('draft versions (INV-3)', () => {
  const v: DraftVersion = {
    id: 'ver_1',
    document_id: 'doc_lumen_d12',
    number: 1,
    content_hash: HASH_A,
    parent_version_id: null,
    template_version_id: 'tpl_d12a_1',
    slot_snapshot: { 'portfolio.legal_name': 'Lumen Segregated Portfolio' },
    referenced_document_hashes: {},
    created_by: 'sponsor_1',
    created_at: '2026-10-01T09:00:00Z',
  };

  test('cannot be changed once created', () => {
    const d = createDraftVersion(v);
    expect(Object.isFrozen(d)).toBe(true);
    expect(() => {
      (d.slot_snapshot as Record<string, unknown>)['portfolio.legal_name'] = 'Other';
    }).toThrow(TypeError);
  });

  test('is a copy: changing the input afterwards does not change it', () => {
    const input = structuredClone(v);
    const d = createDraftVersion(input);
    (input.slot_snapshot as Record<string, unknown>)['portfolio.legal_name'] = 'Other';
    expect(d.slot_snapshot['portfolio.legal_name']).toBe('Lumen Segregated Portfolio');
  });

  test.each([
    [{ number: 0 }, /positive integer/],
    [{ content_hash: 'ABC' }, /SHA-256/],
    [{ number: 2 }, /parent/],
    [{ parent_version_id: 'ver_0' }, /parent/],
  ])('refuses %j', (over, error) => {
    expect(() => createDraftVersion({ ...v, ...over })).toThrow(error);
  });
});
