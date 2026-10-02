// Creates a fresh test database with the migrations applied, a login role in docsmart_app, and the
// evidence bucket. Needs `pnpm db:up`.
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import { migrate } from '../db/migrate.js';
import { ensureAppLogin } from '../db/roles.js';
import { APP_PASSWORD, APP_ROLE, OWNER, OWNER_TEST, S3, TEST_BUCKET, TEST_DB } from './env.js';

export default async function setup() {
  const client = new pg.Client({ connectionString: OWNER });
  try {
    await client.connect();
  } catch (e) {
    throw new Error(
      `Cannot reach Postgres at ${OWNER.replace(/:[^:@]+@/, ':…@')}. Run pnpm db:up first. (${(e as Error).message})`,
    );
  }
  await client.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await client.query(`CREATE DATABASE ${TEST_DB}`);
  await client.end();
  await migrate(OWNER_TEST);
  await ensureAppLogin(OWNER_TEST, TEST_DB, APP_ROLE, APP_PASSWORD);

  const s3 = new S3Client({ endpoint: S3.endpoint, region: S3.region, forcePathStyle: true, credentials: S3 });
  try {
    await s3.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') throw e;
  } finally {
    s3.destroy();
  }
}
