// What the database itself guarantees (migration 0001, decision 0005), tested as the application role
// and, where it matters, as the owner.

import { assemble } from '@docsmart/assembly';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { withTenant } from './db/connect.js';
import { MigrationError, migrate, readMigrations } from './db/migrate.js';
import { createDocument, recordVersion } from './documents.js';
import { app, approvedTemplate, createTenant, fixtureInput, loadFixtures, owner } from './test/db.js';
import { OWNER_TEST } from './test/env.js';

const A = { tenant_id: 'tenant_a', actor: 'sponsor_a' };
const B = { tenant_id: 'tenant_b', actor: 'sponsor_b' };
const db = app();
const own = owner();

beforeAll(async () => {
  await createTenant(A.tenant_id);
  await createTenant(B.tenant_id);
  await loadFixtures(db, A);
  const template = await approvedTemplate(db, A, 'D12-A');
  await withTenant(db, A.tenant_id, async (tx) => {
    await createDocument(tx, A, {
      id: 'doc_guard',
      class: 'D12',
      scope: 'portfolio',
      umbrella_id: 'umb_meridian',
      portfolio_id: 'pf_lumen',
    });
    await recordVersion(tx, A, {
      document_id: 'doc_guard',
      version_id: 'ver_guard_1',
      template_version_id: template,
      assembled: assemble(await fixtureInput('doc_lumen_d12')),
    });
  });
});
afterAll(async () => {
  await db.destroy();
  await own.destroy();
});

/** The Postgres error a statement raises, as the application acting for a tenant. */
async function appError(tenant: string, statement: ReturnType<typeof sql>): Promise<string> {
  try {
    await withTenant(db, tenant, (tx) => statement.execute(tx));
  } catch (e) {
    return (e as Error).message;
  }
  return 'no error';
}
async function ownerError(statement: ReturnType<typeof sql>): Promise<string> {
  try {
    await statement.execute(own);
  } catch (e) {
    return (e as Error).message;
  }
  return 'no error';
}

describe('INV-3: history is append-only', () => {
  test.each(['draft_versions', 'audit_log', 'record_versions', 'findings', 'check_runs'])(
    'the application cannot update or delete %s',
    async (table) => {
      expect(await appError(A.tenant_id, sql`UPDATE ${sql.table(table)} SET tenant_id = tenant_id`)).toMatch(
        /permission denied/,
      );
      expect(await appError(A.tenant_id, sql`DELETE FROM ${sql.table(table)}`)).toMatch(/permission denied/);
    },
  );

  test('not even the owner can change a draft version, the audit log or a record version', async () => {
    expect(await ownerError(sql`UPDATE draft_versions SET content_hash = repeat('0', 64)`)).toMatch(
      /draft_versions is append-only: UPDATE/,
    );
    expect(await ownerError(sql`DELETE FROM audit_log`)).toMatch(/audit_log is append-only: DELETE/);
    expect(await ownerError(sql`UPDATE record_versions SET data = '{}'`)).toMatch(/record_versions is append-only/);
    expect(await ownerError(sql`TRUNCATE draft_versions CASCADE`)).toMatch(/append-only: TRUNCATE/);
  });

  test('the version is still there, unchanged', async () => {
    const row = await withTenant(db, A.tenant_id, (tx) =>
      tx.selectFrom('draft_versions').select('content_hash').where('id', '=', 'ver_guard_1').executeTakeFirstOrThrow(),
    );
    expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.content_hash).not.toBe('0'.repeat(64));
  });
});

describe('tenancy: row-level security from the first migration', () => {
  test('another tenant sees none of tenant A’s rows', async () => {
    const counts = await withTenant(db, B.tenant_id, async (tx) => ({
      documents: (await tx.selectFrom('documents').select('id').execute()).length,
      versions: (await tx.selectFrom('draft_versions').select('id').execute()).length,
      records: (await tx.selectFrom('record_versions').select('id').execute()).length,
      audit: (await tx.selectFrom('audit_log').select('seq').execute()).length,
    }));
    expect(counts).toEqual({ documents: 0, versions: 0, records: 0, audit: 0 });
  });

  test('a transaction with no tenant sees nothing', async () => {
    const rows = await db.transaction().execute((tx) => tx.selectFrom('documents').select('id').execute());
    expect(rows).toEqual([]);
  });

  test('a tenant cannot write a row for another tenant', async () => {
    const message = await appError(
      B.tenant_id,
      sql`INSERT INTO audit_log (tenant_id, actor, action, entity, entity_id) VALUES ('tenant_a', 'x', 'x', 'x', 'x')`,
    );
    expect(message).toMatch(/row-level security/);
  });

  test('a tenant cannot move its own row to another tenant', async () => {
    expect(
      await appError(A.tenant_id, sql`UPDATE documents SET tenant_id = 'tenant_b' WHERE id = 'doc_guard'`),
    ).toMatch(/row-level security/);
  });
});

describe('templates and decisions', () => {
  test('template content cannot change, and status moves only forward', async () => {
    expect(await appError(A.tenant_id, sql`UPDATE template_versions SET content = '{}'`)).toMatch(
      /template content is immutable/,
    );
    expect(await appError(A.tenant_id, sql`UPDATE template_versions SET status = 'draft', approval = NULL`)).toMatch(
      /can only move draft → approved → retired/,
    );
    expect(await appError(A.tenant_id, sql`DELETE FROM template_versions`)).toMatch(/permission denied/);
  });

  test('a document must have a portfolio exactly when it is portfolio-scoped (INV-9)', async () => {
    const message = await appError(
      A.tenant_id,
      sql`INSERT INTO documents (tenant_id, id, class, scope, umbrella_id, portfolio_id, state, lifecycle)
      VALUES ('tenant_a', 'doc_bad', 'D12', 'portfolio', 'umb_meridian', NULL, 'DRAFTING', '{}')`,
    );
    expect(message).toMatch(/check constraint/);
  });

  test('version numbers are unique within a document', async () => {
    const message = await appError(
      A.tenant_id,
      sql`INSERT INTO draft_versions (tenant_id, id, document_id, number, parent_version_id, template_version_id, content_hash, content, slot_snapshot, calculations, referenced_hashes, created_by)
      SELECT tenant_id, 'ver_dup', document_id, number, parent_version_id, template_version_id, content_hash, content, slot_snapshot, calculations, referenced_hashes, created_by FROM draft_versions WHERE id = 'ver_guard_1'`,
    );
    expect(message).toMatch(/duplicate key/);
  });
});

describe('migrations (decision 0005)', () => {
  test('applying again does nothing', async () => {
    expect(await migrate(OWNER_TEST)).toEqual([]);
  });

  test('an applied migration that has changed stops everything', async () => {
    const changed = readMigrations().map((m) => ({ ...m, sha256: 'f'.repeat(64) }));
    await expect(migrate(OWNER_TEST, changed)).rejects.toThrow(MigrationError);
    await expect(migrate(OWNER_TEST, changed)).rejects.toThrow(/Applied migrations have changed: 0001_foundation.sql/);
  });

  test('a migration that fails leaves nothing behind', async () => {
    const broken = [
      ...readMigrations(),
      {
        name: '9999_broken.sql',
        sha256: 'a'.repeat(64),
        sql: 'CREATE TABLE half_done (x int); SELECT nonsense_function();',
      },
    ];
    await expect(migrate(OWNER_TEST, broken)).rejects.toThrow(/9999_broken.sql failed/);
    const exists = await sql<{ t: string | null }>`SELECT to_regclass('half_done')::text AS t`.execute(own);
    expect(exists.rows[0]?.t).toBeNull();
  });
});
