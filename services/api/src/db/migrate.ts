/**
 * Applies the SQL migrations in services/api/migrations in order (decision 0005). Each applied file
 * is recorded with its SHA-256; if an applied file has since changed, nothing runs. A mistake is
 * fixed by a new migration, never by editing one.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import pg from 'pg';

export const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url);

export interface Migration {
  name: string;
  sha256: string;
  sql: string;
}

export function readMigrations(dir: URL = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((name) => {
      const sql = readFileSync(new URL(name, dir), 'utf8');
      return { name, sql, sha256: createHash('sha256').update(sql).digest('hex') };
    });
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/** Applies pending migrations, each in its own transaction. Returns the names applied. */
export async function migrate(connectionString: string, migrations: Migration[] = readMigrations()): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    // One runner at a time.
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['docsmart_migrations']);
    const applied = new Map(
      (await client.query<{ name: string; sha256: string }>('SELECT name, sha256 FROM schema_migrations')).rows.map(
        (r) => [r.name, r.sha256],
      ),
    );
    const known = new Set(migrations.map((m) => m.name));
    const changed = migrations
      .filter((m) => applied.has(m.name) && applied.get(m.name) !== m.sha256)
      .map((m) => m.name);
    const vanished = [...applied.keys()].filter((n) => !known.has(n));
    if (changed.length || vanished.length) {
      throw new MigrationError(
        [
          changed.length ? `Applied migrations have changed: ${changed.join(', ')}.` : '',
          vanished.length ? `Applied migrations are missing: ${vanished.join(', ')}.` : '',
          'Fix a mistake with a new migration.',
        ]
          .filter(Boolean)
          .join(' '),
      );
    }
    const done: string[] = [];
    for (const m of migrations.filter((x) => !applied.has(x.name))) {
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (name, sha256) VALUES ($1, $2)', [m.name, m.sha256]);
        await client.query('COMMIT');
        done.push(m.name);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new MigrationError(`${m.name} failed: ${(e as Error).message}`);
      }
    }
    return done;
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['docsmart_migrations']).catch(() => undefined);
    await client.end();
  }
}

// `pnpm --filter @docsmart/api run migrate` with DATABASE_URL set.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL.');
  const done = await migrate(url);
  console.log(done.length ? `Applied ${done.join(', ')}` : 'Nothing to apply.');
}
