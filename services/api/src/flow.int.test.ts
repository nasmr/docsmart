// The first slice end to end, through the database: records → approved template → assembly →
// version → checks → submission gate → frozen package (build plan §4, B9).
import { type AssemblyInput, assemble } from '@docsmart/assembly';
import type { PortfolioRecords, Sponsor, Umbrella } from '@docsmart/domain';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Tx } from './db/connect.js';
import { type Actor, withTenant } from './db/connect.js';
import {
  CHECKS_POLICY,
  createDocument,
  type DocumentError,
  markReady,
  recordChecks,
  recordDisposition,
  recordVersion,
  withdraw,
} from './documents.js';
import { currentRecord, portfolioRecords } from './records.js';
import { templateVersion } from './templates.js';
import { app, approvedTemplate, createTenant, fieldCatalogue, fixtureInput, loadFixtures } from './test/db.js';
import { S3, TEST_BUCKET } from './test/env.js';
import { auditTrail, getEvidence, S3ObjectStore, setPolicy, verifySubmissionPackageHash } from './test/platform.js';

const WHO: Actor = { tenant_id: 'meridian', actor: 'sponsor_ops_1' };
const AT = '2026-10-02T12:00:00Z';
const db = app();
const store = new S3ObjectStore(TEST_BUCKET, S3);
const templates: Record<string, string> = {};

beforeAll(async () => {
  await createTenant(WHO.tenant_id);
  await loadFixtures(db, WHO);
  for (const t of ['D12-A', 'D13-B', 'D1SP-A']) templates[t] = await approvedTemplate(db, WHO, t);
  await withTenant(db, WHO.tenant_id, (tx) =>
    setPolicy(tx, {
      tenant_id: WHO.tenant_id,
      key: CHECKS_POLICY,
      value: { D12: ['required_slot'], D13: ['required_slot'], 'D1-SP': ['required_slot'] },
      approved_by: 'law_bvi_1',
      change_ref: 'CHG-1',
    }),
  );
});
afterAll(async () => {
  store.destroy();
  await db.destroy();
});

/** The assembly input for a fixture document, with the records and template read from the database. */
async function fromDatabase(
  tx: Tx,
  fixtureId: string,
  opts: { party?: string; template: string },
): Promise<AssemblyInput> {
  const fixture = await fixtureInput(fixtureId, opts.party ? { party: opts.party } : {});
  const portfolioId = fixture.records.portfolio?.portfolio.id as string;
  const portfolio = (await portfolioRecords(tx, portfolioId)) as PortfolioRecords;
  const tpl = await templateVersion(tx, templates[opts.template] as string);
  return {
    ...fixture,
    template: tpl?.tree ?? fixture.template,
    template_version_id: templates[opts.template] as string,
    catalogue: fieldCatalogue,
    records: {
      ...fixture.records,
      umbrella: (await currentRecord<Umbrella>(tx, 'umbrella', 'umb_meridian')) as Umbrella,
      sponsor: (await currentRecord<Sponsor>(tx, 'sponsor', 'spn_meridian')) as Sponsor,
      portfolio,
    },
  };
}

describe('the M1 demo, through the database', () => {
  test('records read back from the database assemble to the same hash as the fixtures', async () => {
    const fromDb = await withTenant(db, WHO.tenant_id, async (tx) =>
      assemble(await fromDatabase(tx, 'doc_lumen_d12', { template: 'D12-A' })),
    );
    const direct = assemble({
      ...(await fixtureInput('doc_lumen_d12')),
      template_version_id: templates['D12-A'] as string,
    });
    expect(fromDb.content_hash).toBe(direct.content_hash);
  });

  test('create, record a version with its rendering as evidence, re-assemble to the same hash, and pass the gate', async () => {
    const pkg = await withTenant(db, WHO.tenant_id, async (tx) => {
      await createDocument(tx, WHO, {
        id: 'lumen_d12',
        class: 'D12',
        scope: 'portfolio',
        umbrella_id: 'umb_meridian',
        portfolio_id: 'pf_lumen',
      });
      const first = await recordVersion(tx, WHO, {
        document_id: 'lumen_d12',
        version_id: 'lumen_d12_v1',
        template_version_id: templates['D12-A'] as string,
        assembled: assemble(await fromDatabase(tx, 'doc_lumen_d12', { template: 'D12-A' })),
        store,
      });
      expect(first.number).toBe(1);
      const rendering = await getEvidence(tx, store, first.rendering as string);
      expect(rendering.bytes.length).toBeGreaterThan(5000);

      // Re-running assembly gives the same hash (the M1 demo), recorded as version 2.
      const second = await recordVersion(tx, WHO, {
        document_id: 'lumen_d12',
        version_id: 'lumen_d12_v2',
        template_version_id: templates['D12-A'] as string,
        assembled: assemble(await fromDatabase(tx, 'doc_lumen_d12', { template: 'D12-A' })),
      });
      expect(second).toEqual({ number: 2, content_hash: first.content_hash });
      return markReady(tx, WHO, 'lumen_d12', AT);
    });
    expect(pkg).toMatchObject({
      document_id: 'lumen_d12',
      version_id: 'lumen_d12_v2',
      findings: [],
      passed_by: WHO.actor,
    });
    expect(verifySubmissionPackageHash(pkg)).toBe(true);

    const stored = await withTenant(db, WHO.tenant_id, async (tx) => ({
      state: (await tx.selectFrom('documents').select('state').where('id', '=', 'lumen_d12').executeTakeFirstOrThrow())
        .state,
      pkg: await tx
        .selectFrom('submission_packages')
        .select('package_hash')
        .where('version_id', '=', 'lumen_d12_v2')
        .executeTakeFirstOrThrow(),
      trail: (await auditTrail(tx, 'document', 'lumen_d12')).map((r) => r.action),
    }));
    expect(stored.state).toBe('READY_FOR_SUBMISSION');
    expect(stored.pkg.package_hash).toBe(pkg.package_hash);
    expect(stored.trail).toEqual([
      'document.created',
      'document.version_assembled',
      'document.version_assembled',
      'document.mark_ready',
    ]);
  });

  test('a ready document goes back to ASSEMBLED only with a new version (decisions 0001, 0009)', async () => {
    const state = await withTenant(db, WHO.tenant_id, async (tx) => {
      await recordVersion(tx, WHO, {
        document_id: 'lumen_d12',
        version_id: 'lumen_d12_v3',
        template_version_id: templates['D12-A'] as string,
        assembled: assemble(await fromDatabase(tx, 'doc_lumen_d12', { template: 'D12-A' })),
      });
      return (await tx.selectFrom('documents').select('state').where('id', '=', 'lumen_d12').executeTakeFirstOrThrow())
        .state;
    });
    expect(state).toBe('ASSEMBLED');
  });
});

describe('the gate refuses, and nothing is written when it does', () => {
  async function freshDocument(id: string) {
    await withTenant(db, WHO.tenant_id, async (tx) => {
      await createDocument(tx, WHO, {
        id,
        class: 'D12',
        scope: 'portfolio',
        umbrella_id: 'umb_meridian',
        portfolio_id: 'pf_lumen',
      });
      await recordVersion(tx, WHO, {
        document_id: id,
        version_id: `${id}_v1`,
        template_version_id: templates['D12-A'] as string,
        assembled: assemble(await fromDatabase(tx, 'doc_lumen_d12', { template: 'D12-A' })),
      });
    });
  }
  const refusal = async (id: string) => {
    try {
      await withTenant(db, WHO.tenant_id, (tx) => markReady(tx, WHO, id, AT));
    } catch (e) {
      return e as DocumentError;
    }
    throw new Error('markReady did not refuse');
  };
  const state = (id: string) =>
    withTenant(
      db,
      WHO.tenant_id,
      async (tx) =>
        (await tx.selectFrom('documents').select('state').where('id', '=', id).executeTakeFirstOrThrow()).state,
    );

  test('a blocking finding: refused with the reason, and the document stays ASSEMBLED', async () => {
    await freshDocument('gate_blocking');
    await withTenant(db, WHO.tenant_id, (tx) =>
      recordChecks(tx, WHO, {
        version_id: 'gate_blocking_v1',
        checks_run: ['cross_reference'],
        findings: [
          { id: 'f_xr', check: 'cross_reference', severity: 'blocks', at: 'x', message: 'section 12 has no target' },
        ],
      }),
    );
    const e = await refusal('gate_blocking');
    expect(e.gate?.failures.map((f) => f.condition)).toEqual([5]);
    expect(await state('gate_blocking')).toBe('ASSEMBLED');
    const packages = await withTenant(db, WHO.tenant_id, (tx) =>
      tx.selectFrom('submission_packages').select('version_id').where('document_id', '=', 'gate_blocking').execute(),
    );
    expect(packages).toEqual([]);
  });

  test('a blocking finding cannot be kept, only fixed', async () => {
    await expect(
      withTenant(db, WHO.tenant_id, (tx) =>
        recordDisposition(tx, WHO, { finding_id: 'f_xr', decision: 'keep', reason: 'fine' }),
      ),
    ).rejects.toThrow(/can only be fixed/);
  });

  test('a review finding needs a decision to keep, with a reason', async () => {
    await freshDocument('gate_review');
    await withTenant(db, WHO.tenant_id, (tx) =>
      recordChecks(tx, WHO, {
        version_id: 'gate_review_v1',
        checks_run: ['defined_terms'],
        findings: [
          {
            id: 'f_dt',
            check: 'defined_terms',
            severity: 'review',
            at: 'x',
            message: '“Sponsor” defined but not used',
          },
        ],
      }),
    );
    expect((await refusal('gate_review')).gate?.failures.map((f) => f.condition)).toEqual([6]);
    // The database refuses a keep with no reason.
    await expect(
      withTenant(db, WHO.tenant_id, (tx) => recordDisposition(tx, WHO, { finding_id: 'f_dt', decision: 'keep' })),
    ).rejects.toThrow(/check constraint/);
    await withTenant(db, WHO.tenant_id, (tx) =>
      recordDisposition(tx, WHO, {
        finding_id: 'f_dt',
        decision: 'keep',
        reason: 'Defined in the offering memorandum.',
      }),
    );
    const pkg = await withTenant(db, WHO.tenant_id, (tx) => markReady(tx, WHO, 'gate_review', AT));
    expect(pkg.dispositions).toEqual([
      expect.objectContaining({ finding_id: 'f_dt', decision: 'keep', reason: 'Defined in the offering memorandum.' }),
    ]);
  });

  test('a missing slot found by assembly is a blocking finding (condition 2)', async () => {
    await withTenant(db, WHO.tenant_id, async (tx) => {
      await createDocument(tx, WHO, {
        id: 'gate_missing',
        class: 'D12',
        scope: 'portfolio',
        umbrella_id: 'umb_meridian',
        portfolio_id: 'pf_lumen',
      });
      const input = await fromDatabase(tx, 'doc_lumen_d12', { template: 'D12-A' });
      const portfolio = structuredClone(input.records.portfolio) as PortfolioRecords;
      delete (portfolio.portfolio as { share_class_name?: string }).share_class_name;
      await recordVersion(tx, WHO, {
        document_id: 'gate_missing',
        version_id: 'gate_missing_v1',
        template_version_id: templates['D12-A'] as string,
        assembled: assemble({ ...input, records: { ...input.records, portfolio } }),
      });
    });
    expect((await refusal('gate_missing')).gate?.failures.map((f) => f.condition)).toEqual([2]);
  });

  test('without a checks policy, the gate refuses rather than guessing which checks must run', async () => {
    await withTenant(db, WHO.tenant_id, (tx) =>
      setPolicy(tx, {
        tenant_id: WHO.tenant_id,
        key: CHECKS_POLICY,
        value: { D12: ['required_slot', 'cross_portfolio'] },
        approved_by: 'law_bvi_1',
        change_ref: 'CHG-2',
      }),
    );
    await freshDocument('gate_unrun');
    // cross_portfolio is now required and has not run on this version.
    expect((await refusal('gate_unrun')).gate?.failures).toEqual([
      expect.objectContaining({ condition: 5, refs: ['cross_portfolio'] }),
    ]);
    await withTenant(db, WHO.tenant_id, (tx) =>
      setPolicy(tx, {
        tenant_id: WHO.tenant_id,
        key: CHECKS_POLICY,
        value: { D12: ['required_slot'], D13: ['required_slot'], 'D1-SP': ['required_slot'] },
        approved_by: 'law_bvi_1',
        change_ref: 'CHG-3',
      }),
    );
  });

  test('an unapproved template is refused before anything is written', async () => {
    const message = await withTenant(db, WHO.tenant_id, async (tx) => {
      await createDocument(tx, WHO, {
        id: 'unapproved',
        class: 'D12',
        scope: 'portfolio',
        umbrella_id: 'umb_meridian',
        portfolio_id: 'pf_lumen',
      });
      try {
        await recordVersion(tx, WHO, {
          document_id: 'unapproved',
          version_id: 'unapproved_v1',
          template_version_id: 'no_such_template',
          assembled: assemble(await fixtureInput('doc_lumen_d12')),
        });
      } catch (e) {
        return (e as Error).message;
      }
      return 'recorded';
    }).catch((e: Error) => e.message);
    expect(message).toMatch(/is not approved/);
  });
});

describe('a subscription agreement built on a frozen supplement (addendum §4.2)', () => {
  test('records the supplement it used, and fails the gate while there is no U3 (case RF-02)', async () => {
    const d13 = await withTenant(db, WHO.tenant_id, async (tx) => {
      await createDocument(tx, WHO, {
        id: 'atlas_d13',
        class: 'D13',
        scope: 'portfolio',
        umbrella_id: 'umb_meridian',
        portfolio_id: 'pf_atlas',
      });
      const v = await recordVersion(tx, WHO, {
        document_id: 'atlas_d13',
        version_id: 'atlas_d13_v1',
        template_version_id: templates['D13-B'] as string,
        assembled: assemble(await fromDatabase(tx, 'doc_atlas_d13', { template: 'D13-B' })),
      });
      await markReady(tx, WHO, 'atlas_d13', AT);
      return v;
    });
    const e = await withTenant(db, WHO.tenant_id, async (tx) => {
      await createDocument(tx, WHO, {
        id: 'atlas_sa_001',
        class: 'D1-SP',
        scope: 'portfolio',
        umbrella_id: 'umb_meridian',
        portfolio_id: 'pf_atlas',
      });
      const input = await fromDatabase(tx, 'batch_atlas_d1sp', { party: 'pty_001', template: 'D1SP-A' });
      const assembled = assemble({
        ...input,
        references: {
          ...input.references,
          D13: {
            ...(input.references.D13 as { supplement_number: number; date: string }),
            content_hash: d13.content_hash,
          },
        },
      });
      await recordVersion(tx, WHO, {
        document_id: 'atlas_sa_001',
        version_id: 'atlas_sa_001_v1',
        template_version_id: templates['D1SP-A'] as string,
        assembled,
        references: [{ kind: 'D13', document_id: 'atlas_d13', version_id: 'atlas_d13_v1' }],
      });
    }).then(async () => {
      try {
        await withTenant(db, WHO.tenant_id, (tx) => markReady(tx, WHO, 'atlas_sa_001', AT));
      } catch (err) {
        return err as DocumentError;
      }
      throw new Error('not refused');
    });
    expect(e.gate?.failures).toEqual([
      expect.objectContaining({ condition: 8, message: 'No U3 version is referenced.' }),
    ]);
  });

  test('a version claiming a supplement it was not assembled on is refused', async () => {
    const message = await withTenant(db, WHO.tenant_id, async (tx) => {
      await createDocument(tx, WHO, {
        id: 'atlas_sa_002',
        class: 'D1-SP',
        scope: 'portfolio',
        umbrella_id: 'umb_meridian',
        portfolio_id: 'pf_atlas',
      });
      const input = await fromDatabase(tx, 'batch_atlas_d1sp', { party: 'pty_003', template: 'D1SP-A' });
      // Assembled on some other supplement version.
      const assembled = assemble({
        ...input,
        references: {
          ...input.references,
          D13: {
            ...(input.references.D13 as { supplement_number: number; date: string }),
            content_hash: 'f'.repeat(64),
          },
        },
      });
      await recordVersion(tx, WHO, {
        document_id: 'atlas_sa_002',
        version_id: 'atlas_sa_002_v1',
        template_version_id: templates['D1SP-A'] as string,
        assembled,
        references: [{ kind: 'D13', document_id: 'atlas_d13', version_id: 'atlas_d13_v1' }],
      });
      return 'recorded';
    }).catch((e: Error) => e.message);
    expect(message).toMatch(/The D13 this version was assembled on is not version atlas_d13_v1/);
  });
});

describe('concurrency and withdrawal', () => {
  test('two versions recorded at once are numbered one after the other, never twice', async () => {
    await withTenant(db, WHO.tenant_id, (tx) =>
      createDocument(tx, WHO, {
        id: 'race',
        class: 'D12',
        scope: 'portfolio',
        umbrella_id: 'umb_meridian',
        portfolio_id: 'pf_lumen',
      }),
    );
    const assembled = assemble({
      ...(await fixtureInput('doc_lumen_d12')),
      template_version_id: templates['D12-A'] as string,
    });
    const record = (n: number) =>
      withTenant(db, WHO.tenant_id, (tx) =>
        recordVersion(tx, WHO, {
          document_id: 'race',
          version_id: `race_v${n}`,
          template_version_id: templates['D12-A'] as string,
          assembled,
        }),
      );
    const results = await Promise.all([record(1), record(2), record(3)]);
    expect(results.map((r) => r.number).sort()).toEqual([1, 2, 3]);
  });

  test('a withdrawn document accepts nothing more, and the attempt writes nothing', async () => {
    await withTenant(db, WHO.tenant_id, (tx) => withdraw(tx, WHO, 'race', 'Project cancelled.'));
    const attempt = await withTenant(db, WHO.tenant_id, async (tx) =>
      recordVersion(tx, WHO, {
        document_id: 'race',
        version_id: 'race_v4',
        template_version_id: templates['D12-A'] as string,
        assembled: assemble(await fixtureInput('doc_lumen_d12')),
      }),
    ).catch((e: Error) => e.message);
    expect(attempt).toMatch(/withdrawn/);
    const versions = await withTenant(db, WHO.tenant_id, (tx) =>
      tx.selectFrom('draft_versions').select('id').where('document_id', '=', 'race').execute(),
    );
    expect(versions.map((v) => v.id).sort()).toEqual(['race_v1', 'race_v2', 'race_v3']);
  });
});
