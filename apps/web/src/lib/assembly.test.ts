import { describe, expect, test } from 'vitest';
import type { DocumentView, Template } from './api.js';
import {
  approvedTemplates,
  blankInterests,
  buildRequest,
  DraftProblem,
  pruneBlank,
  suggestDocumentId,
  suggestTemplate,
} from './assembly.js';

const HASH = 'a'.repeat(64);
const doc = (id: string, version: string | null): DocumentView => ({
  id,
  class: 'D13',
  scope: 'portfolio',
  umbrella_id: 'umb',
  portfolio_id: 'pf_a',
  state: version ? 'ASSEMBLED' : 'DRAFTING',
  current_version: version ? { id: version, number: 1, content_hash: HASH } : null,
  ready_version_id: null,
});

describe('building an assembly request', () => {
  test('blank inputs are left out; false and numbers stay', () => {
    expect(
      pruneBlank({
        resolution_date: '2026-10-20',
        effective_date: '',
        director_interests: [{ director_id: 'dir_01', is_interested: false, description: '' }],
        meeting: { place: '', time: undefined },
        supplement_number: 0,
      }),
    ).toEqual({
      resolution_date: '2026-10-20',
      director_interests: [{ director_id: 'dir_01', is_interested: false }],
      supplement_number: 0,
    });
  });

  test('referenced documents are named by their current version', () => {
    const req = buildRequest(
      {
        template_version_id: 'd1spa_v1',
        inputs: { company_signatory_id: 'sig_01' },
        party_id: 'pty_001',
        subscription_id: 'sub_001',
        d13: 'a_d13',
        d15_date: '2026-12-18',
        earlier: { portfolio_legal_name: '', executed_date: '', ref: '' },
      },
      [doc('a_d13', 'ver_1')],
    );
    expect(req).toEqual({
      template_version_id: 'd1spa_v1',
      inputs: { company_signatory_id: 'sig_01' },
      party_id: 'pty_001',
      subscription_id: 'sub_001',
      references: { D13: { document_id: 'a_d13', version_id: 'ver_1' }, D15: { date: '2026-12-18' } },
    });
  });

  test('a reference with no version, or a half-entered earlier agreement, is refused before sending', () => {
    expect(() => buildRequest({ template_version_id: 't', inputs: {}, d13: 'a_d13' }, [doc('a_d13', null)])).toThrow(
      DraftProblem,
    );
    expect(() => buildRequest({ template_version_id: 't', inputs: {}, earlier: { ref: 'SA-1' } }, [])).toThrow(
      /legal name, its date and its reference/,
    );
  });

  test('declarations of interest start with every director, none interested', () => {
    expect(blankInterests([{ id: 'dir_01' }, { id: 'dir_02' }])).toEqual([
      { director_id: 'dir_01', is_interested: false, abstains: false, description: '' },
      { director_id: 'dir_02', is_interested: false, abstains: false, description: '' },
    ]);
  });
});

describe('choosing', () => {
  test.each([
    ['D12', { acquisition_source: 'gp_sourced' }, 'D12-B'],
    ['D12', { acquisition_source: 'issuer_primary' }, 'D12-A'],
    ['D13', { acquisition_source: 'issuer_primary' }, 'D13-A'],
    ['D13', { acquisition_source: 'gp_sourced' }, 'D13-B'],
    ['D13', { acquisition_source: 'market_secondary' }, 'D13-C'],
    ['D1-SP', { party_type: 'individual' }, 'D1SP-A'],
    ['D1-SP', { party_type: 'entity' }, 'D1SP-B'],
    ['D1-SP', {}, undefined],
  ])('%s with %j suggests %s', (cls, facts, template) => {
    expect(suggestTemplate(cls, facts)).toBe(template);
  });

  test('only approved, current templates of the class are offered', () => {
    const t = (
      id: string,
      template: string,
      cls: string,
      status: Template['status'],
      supersedes?: string,
    ): Template => ({
      id,
      template,
      class: cls,
      version: Number(id.slice(-1)),
      jurisdictions: ['VG'],
      content_hash: HASH,
      status,
      ...(status === 'approved'
        ? { approval: { lawyer_id: 'l', approved_at: '', jurisdictions: ['VG'], supersedes: supersedes ?? null } }
        : {}),
    });
    const list = [
      t('d12a_v1', 'D12-A', 'D12', 'approved'),
      t('d12a_v2', 'D12-A', 'D12', 'approved', 'd12a_v1'),
      t('d12b_v1', 'D12-B', 'D12', 'draft'),
      t('d13a_v1', 'D13-A', 'D13', 'approved'),
    ];
    expect(approvedTemplates(list, 'D12').map((x) => x.id)).toEqual(['d12a_v2']);
  });

  test('document ids', () => {
    expect(suggestDocumentId('pf_atlas', 'D1-SP', [])).toBe('atlas_d1sp');
    expect(suggestDocumentId('pf_atlas', 'D12', ['atlas_d12', 'atlas_d12_2'])).toBe('atlas_d12_3');
    expect(suggestDocumentId(undefined, 'U3', [])).toBe('umbrella_u3');
  });
});
