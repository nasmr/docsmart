import { describe, expect, test } from 'vitest';
import type { DocumentView, ListedRecord } from './api.js';
import { buildWorkspace, missingParts, portfolioName } from './workspace.js';

const rec = (entity: ListedRecord['entity'], id: string, data: Record<string, unknown> = {}): ListedRecord => ({
  entity,
  id,
  version: 1,
  data,
});
const doc = (id: string, portfolio_id: string | null): DocumentView => ({
  id,
  class: portfolio_id ? 'D12' : 'U3',
  scope: portfolio_id ? 'portfolio' : 'umbrella',
  umbrella_id: 'umb',
  portfolio_id,
  state: 'DRAFTING',
  current_version: null,
  ready_version_id: null,
});

describe('the workspace', () => {
  const ws = buildWorkspace({
    umbrella: [rec('umbrella', 'umb', { sponsor_id: 'spn_b' })],
    sponsor: [rec('sponsor', 'spn_a'), rec('sponsor', 'spn_b')],
    portfolio: [
      rec('portfolio', 'pf_a', { legal_name: 'A Segregated Portfolio', short_name: 'A SP' }),
      rec('portfolio', 'pf_b', { legal_name: 'B Segregated Portfolio' }),
    ],
    portfolio_terms: [rec('portfolio_terms', 'pf_a', { portfolio_id: 'pf_a' })],
    offer: [rec('offer', 'a_offer', { portfolio_id: 'pf_a' }), rec('offer', 'b_offer', { portfolio_id: 'pf_b' })],
    asset: [rec('asset', 'a_asset', { portfolio_id: 'pf_a' })],
    subscription_account: [rec('subscription_account', 'pf_a')],
    documents: [doc('a_d12', 'pf_a'), doc('u3', null), doc('b_d12', 'pf_b')],
  });

  test("each portfolio's records are found by how they are kept", () => {
    const [a, b] = ws.portfolios;
    expect(a?.terms?.id).toBe('pf_a');
    expect(a?.offer?.id).toBe('a_offer');
    expect(a?.asset?.id).toBe('a_asset');
    expect(a?.account?.id).toBe('pf_a');
    expect(b?.offer?.id).toBe('b_offer');
    expect(b && missingParts(b)).toEqual(['Terms', 'Asset', 'Subscription account']);
    expect(a && missingParts(a)).toEqual([]);
  });

  test('documents go with their portfolio, or the umbrella', () => {
    expect(ws.portfolios[0]?.documents.map((d) => d.id)).toEqual(['a_d12']);
    expect(ws.portfolios[1]?.documents.map((d) => d.id)).toEqual(['b_d12']);
    expect(ws.umbrellaDocuments.map((d) => d.id)).toEqual(['u3']);
  });

  test("the umbrella's sponsor, and names for screens", () => {
    expect(ws.sponsor?.id).toBe('spn_b');
    expect(ws.portfolios.map((p) => portfolioName(p))).toEqual(['A SP', 'B Segregated Portfolio']);
  });
});
