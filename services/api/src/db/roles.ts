/**
 * A login role in docsmart_app for local development and tests. Production roles and passwords are
 * provisioned outside the repository.
 */
import pg from 'pg';

export async function ensureAppLogin(
  ownerUrl: string,
  database: string,
  name: string,
  password: string,
): Promise<void> {
  if (!/^[a-z][a-z0-9_]*$/.test(name) || !/^[a-z][a-z0-9_]*$/.test(database))
    throw new Error('Invalid role or database name.');
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name]);
    const pw = client.escapeLiteral(password);
    await client.query(
      exists.rowCount
        ? `ALTER ROLE ${name} LOGIN PASSWORD ${pw}`
        : `CREATE ROLE ${name} LOGIN PASSWORD ${pw} IN ROLE docsmart_app`,
    );
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${name}`);
  } finally {
    await client.end();
  }
}
