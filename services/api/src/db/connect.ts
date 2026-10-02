/**
 * Database access. The application connects as a member of docsmart_app (migration 0001), and every
 * piece of work runs in one transaction with the tenant set, so row-level security applies to it.
 */
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import pg from 'pg';
import type { Database } from './schema.js';

// bigint columns (audit sequence, sizes) come back as strings; keep them exact.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => v);

export function connect(connectionString: string, max = 10): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max }) }) });
}

export type Tx = Transaction<Database>;

/** The caller: which tenant, and who is acting. */
export interface Actor {
  tenant_id: string;
  actor: string;
}

/** Runs `work` in a transaction acting for one tenant. Everything commits together or not at all. */
export async function withTenant<T>(db: Kysely<Database>, tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  if (!/^[a-z][a-z0-9_]*$/.test(tenantId)) throw new Error(`Invalid tenant id “${tenantId}”.`);
  return db.transaction().execute(async (tx) => {
    await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(tx);
    return work(tx);
  });
}
