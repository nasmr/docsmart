import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { type ApprovalRefused, approve, retire, type TemplateVersionRecord } from './approval.js';
import { contentHash, FORMAT, type TemplateTree } from './format.js';
import { DESIGNATION } from './rules.js';
import { type SelectionRule, selectTemplate } from './selection.js';
import { catalogue } from './test/first-pass.js';

const tree = (template: string): TemplateTree => ({
  format: FORMAT,
  template,
  body: [{ t: 'locked', id: 'l1', kind: 'contracting_party', text: [...DESIGNATION] }],
});
const draft = (template: string, version = 1, over: Partial<TemplateVersionRecord> = {}): TemplateVersionRecord => ({
  id: `${template}_v${version}`,
  template,
  class: template.split('-')[0] as string,
  version,
  jurisdictions: ['VG'],
  content_hash: contentHash(tree(template)),
  status: 'draft',
  ...over,
});
const counsel = { lawyer_id: 'law_1', verified: true, admissions: ['VG'] };
const AT = '2026-10-02T09:00:00Z';

describe('approval (DF-02, DF-P2)', () => {
  test('records the named lawyer, jurisdictions and date', () => {
    expect(approve(draft('D12-A'), tree('D12-A'), catalogue, counsel, AT, [])).toMatchObject({
      status: 'approved',
      approval: { lawyer_id: 'law_1', approved_at: AT, jurisdictions: ['VG'], supersedes: null },
    });
  });

  test.each([
    ['an unverified lawyer', { ...counsel, verified: false }, /not verified/],
    ['a lawyer not admitted in the jurisdiction', { ...counsel, admissions: ['KY'] }, /not admitted in VG/],
  ])('refuses %s', (_, approver, reason) => {
    expect(() => approve(draft('D12-A'), tree('D12-A'), catalogue, approver, AT, [])).toThrow(reason);
  });

  test('refuses content that does not match the version’s hash', () => {
    const changed = { ...tree('D12-A'), body: [] };
    expect(() => approve(draft('D12-A'), changed, catalogue, counsel, AT, [])).toThrow(/does not match/);
  });

  test('refuses a template that breaks an import rule', () => {
    const t: TemplateTree = {
      format: FORMAT,
      template: 'D12-A',
      body: [{ t: 'para', id: 'p', style: 'body', text: [{ t: 'slot', name: 'nope.field' }] }],
    };
    expect(() => approve(draft('D12-A', 1, { content_hash: contentHash(t) }), t, catalogue, counsel, AT, [])).toThrow(
      /import rule/,
    );
  });

  test('refuses a version that is not a draft, listing every reason', () => {
    try {
      approve(
        draft('D12-A', 1, { status: 'approved' }),
        tree('D12-B'),
        catalogue,
        { ...counsel, verified: false },
        AT,
        [],
      );
      throw new Error('not refused');
    } catch (e) {
      expect((e as ApprovalRefused).reasons).toHaveLength(4);
    }
  });

  test('a later version supersedes the earlier approved one without retiring it', () => {
    const v1 = approve(draft('D12-A', 1), tree('D12-A'), catalogue, counsel, AT, []);
    const v2 = approve(draft('D12-A', 2), tree('D12-A'), catalogue, counsel, AT, [v1]);
    expect(v2.approval?.supersedes).toBe('D12-A_v1');
    expect(v1.status).toBe('approved');
    expect(() => approve(draft('D12-A', 1, { id: 'D12-A_v1b' }), tree('D12-A'), catalogue, counsel, AT, [v2])).toThrow(
      /not later/,
    );
  });

  test('retiring needs an approved version and a reason (DF-03)', () => {
    const v1 = approve(draft('D12-A'), tree('D12-A'), catalogue, counsel, AT, []);
    expect(retire(v1, 'law_1', AT, 'Replaced by counsel’s new form.')).toMatchObject({
      status: 'retired',
      retirement: { by: 'law_1' },
    });
    expect(() => retire(v1, 'law_1', AT, ' ')).toThrow(/reason/);
    expect(() => retire(draft('D12-A'), 'law_1', AT, 'x')).toThrow(/not approved/);
  });
});

// Selection rules as policy might hold them for the first-pass templates (build plan B3).
const RULES: SelectionRule[] = [
  { class: 'D12', when: ['resolution.held_at_meeting'], template: 'D12-C' },
  { class: 'D12', when: ['resolution.written', 'asset.acquisition_source = gp_sourced'], template: 'D12-B' },
  { class: 'D12', when: ['resolution.written', 'asset.acquisition_source = issuer_primary'], template: 'D12-A' },
  { class: 'D12', when: ['resolution.written', 'asset.acquisition_source = market_secondary'], template: 'D12-A' },
  { class: 'D13', when: ['asset.acquisition_source = issuer_primary'], template: 'D13-A' },
  { class: 'D13', when: ['asset.acquisition_source = gp_sourced'], template: 'D13-B' },
  { class: 'D13', when: ['asset.acquisition_source = market_secondary'], template: 'D13-C' },
  { class: 'D1-SP', when: ['investor.has_earlier_agreement'], template: 'D1SP-C' },
  { class: 'D1-SP', when: ['investor.is_first_subscription', 'investor.type = individual'], template: 'D1SP-A' },
  { class: 'D1-SP', when: ['investor.is_first_subscription', 'investor.type = entity'], template: 'D1SP-B' },
].map((r) => ({ jurisdiction: 'VG', entity_type: 'bvi_spc', scope: 'portfolio' as const, ...r }));

const VERSIONS = ['D12-A', 'D12-B', 'D12-C', 'D13-A', 'D13-B', 'D13-C', 'D1SP-A', 'D1SP-B', 'D1SP-C'].map((t) =>
  approve(draft(t), tree(t), catalogue, counsel, AT, []),
);
const request = (cls: string, facts: Record<string, unknown>) => ({
  class: cls,
  jurisdiction: 'VG',
  entity_type: 'bvi_spc',
  scope: 'portfolio' as const,
  facts,
});

describe('selection against the Meridian Horizon fixtures', () => {
  const fx = (path: string) =>
    JSON.parse(readFileSync(new URL(`../../../fixtures/meridian-horizon/${path}`, import.meta.url), 'utf8'));
  const docs: Array<{
    id: string;
    class: string;
    portfolio_id?: string;
    expected_template?: string;
    inputs?: { meeting?: unknown };
  }> = fx('documents.json').documents;
  const assets: Record<string, { acquisition_source: string }> = Object.fromEntries(
    ['lumen', 'atlas', 'atlas-ii'].map((p) => {
      const r = fx(`portfolios/${p}.json`);
      return [r.portfolio.id, r.asset];
    }),
  );

  test.each(docs.filter((d) => d.expected_template && d.portfolio_id))('$id picks $expected_template', (d) => {
    const asset = assets[d.portfolio_id as string] as { acquisition_source: string };
    const meeting = !!d.inputs?.meeting;
    const r = selectTemplate(
      request(d.class, {
        'asset.acquisition_source': asset.acquisition_source,
        'resolution.held_at_meeting': meeting,
        'resolution.written': !meeting,
      }),
      RULES,
      VERSIONS,
    );
    expect(r).toMatchObject({ ok: true, version: { template: d.expected_template } });
  });

  test('every Atlas subscription agreement picks the variant the fixtures expect (27 A, 9 B, 5 C)', () => {
    const parties: Array<{ id: string; type: string }> = fx('parties.json');
    const earlier = new Set(fx('documents.json').executed.map((e: { party_id: string }) => e.party_id));
    const counts: Record<string, number> = {};
    for (const s of fx('subscriptions/atlas.json') as Array<{ party_id: string }>) {
      const party = parties.find((x) => x.id === s.party_id) as { type: string };
      const r = selectTemplate(
        request('D1-SP', {
          'investor.has_earlier_agreement': earlier.has(s.party_id),
          'investor.is_first_subscription': !earlier.has(s.party_id),
          'investor.type': party.type,
        }),
        RULES,
        VERSIONS,
      );
      if (!r.ok) throw new Error(r.reason);
      counts[r.version.template] = (counts[r.version.template] ?? 0) + 1;
    }
    expect(counts).toEqual({ 'D1SP-A': 27, 'D1SP-B': 9, 'D1SP-C': 5 });
  });
});

describe('selection refuses rather than guesses', () => {
  const facts = { 'asset.acquisition_source': 'gp_sourced' };

  test('no rule matches', () => {
    expect(selectTemplate(request('D16', facts), RULES, VERSIONS)).toEqual({
      ok: false,
      reason: expect.stringMatching(/No selection rule matches D16/),
    });
    expect(selectTemplate({ ...request('D13', facts), jurisdiction: 'KY' }, RULES, VERSIONS).ok).toBe(false);
  });

  test('two rules match', () => {
    const r = selectTemplate(
      request('D13', facts),
      [...RULES, { ...(RULES[5] as SelectionRule), template: 'D13-X' }],
      VERSIONS,
    );
    expect(r).toEqual({ ok: false, reason: expect.stringMatching(/More than one selection rule matches/) });
  });

  test('a fact the rules need is missing', () => {
    expect(selectTemplate(request('D13', {}), RULES, VERSIONS)).toEqual({
      ok: false,
      reason: expect.stringMatching(/No fact for asset.acquisition_source/),
    });
  });

  test('only approved versions are selectable (DF-P2)', () => {
    const versions = VERSIONS.map((v) => (v.template === 'D13-B' ? { ...v, status: 'draft' as const } : v));
    expect(selectTemplate(request('D13', facts), RULES, versions)).toEqual({
      ok: false,
      reason: 'No approved version of D13-B for VG.',
    });
    const retired = VERSIONS.map((v) => (v.template === 'D13-B' ? retire(v, 'law_1', AT, 'old') : v));
    expect(selectTemplate(request('D13', facts), RULES, retired).ok).toBe(false);
  });

  test('a superseded version is not selected; its successor is', () => {
    const v1 = VERSIONS.find((v) => v.template === 'D13-B') as TemplateVersionRecord;
    const v2 = approve(draft('D13-B', 2), tree('D13-B'), catalogue, counsel, AT, [v1]);
    expect(selectTemplate(request('D13', facts), RULES, [...VERSIONS, v2])).toMatchObject({
      ok: true,
      version: { id: 'D13-B_v2' },
    });
  });

  test('two current approved versions is an error, not a choice', () => {
    const twin = { ...(VERSIONS.find((v) => v.template === 'D13-B') as TemplateVersionRecord), id: 'D13-B_twin' };
    expect(selectTemplate(request('D13', facts), RULES, [...VERSIONS, twin])).toEqual({
      ok: false,
      reason: expect.stringMatching(/More than one current approved version/),
    });
  });
});
