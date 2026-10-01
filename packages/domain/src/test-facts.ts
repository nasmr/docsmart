// Test helpers: gate facts that pass, to be broken one condition at a time.
import type { GateFacts } from './gate.js';

export const HASH_A = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);
export const HASH_C = 'c'.repeat(64);

export function passingFacts(over: Partial<GateFacts> = {}): GateFacts {
  return {
    document_id: 'doc_lumen_d12',
    document_class: 'D12',
    version: { id: 'ver_1', document_id: 'doc_lumen_d12', content_hash: HASH_A },
    latest_version_id: 'ver_1',
    template: { version_id: 'tpl_d12a_1', status: 'approved' },
    checks_required: ['required_slot', 'cross_reference', 'defined_terms', 'contracting_party', 'cross_portfolio'],
    checks_run: ['required_slot', 'cross_reference', 'defined_terms', 'contracting_party', 'cross_portfolio'],
    findings: [],
    dispositions: [],
    ai_zones: [],
    references: [],
    ...over,
  };
}

/** A D1-SP built on a frozen U3 and D13. */
export function passingSubscriptionFacts(over: Partial<GateFacts> = {}): GateFacts {
  return passingFacts({
    document_id: 'doc_atlas_d1sp_pty_001',
    document_class: 'D1-SP',
    version: { id: 'ver_s1', document_id: 'doc_atlas_d1sp_pty_001', content_hash: HASH_A },
    latest_version_id: 'ver_s1',
    template: { version_id: 'tpl_d1spa_1', status: 'approved' },
    references: [
      {
        kind: 'U3',
        document_id: 'doc_u3',
        version_id: 'ver_u3_1',
        state: 'READY_FOR_SUBMISSION',
        recorded_hash: HASH_B,
        version_hash: HASH_B,
        latest_frozen_version_id: 'ver_u3_1',
      },
      {
        kind: 'D13',
        document_id: 'doc_atlas_d13',
        version_id: 'ver_d13_2',
        state: 'READY_FOR_SUBMISSION',
        recorded_hash: HASH_C,
        version_hash: HASH_C,
        latest_frozen_version_id: 'ver_d13_2',
      },
    ],
    ...over,
  });
}
