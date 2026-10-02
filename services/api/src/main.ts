/**
 * Starts the API. Configuration comes from the environment (see .env.example):
 *   APP_DATABASE_URL         a login role in docsmart_app (not the owner)
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_EVIDENCE_BUCKET
 *   API_DEV_TOKENS, ALLOW_DEV_TOKENS=1   development sign-in only (http/auth.ts)
 *   PORT                     default 3000
 */
import { readFileSync } from 'node:fs';
import { FieldCatalogueSchema } from '@docsmart/assembly';
import { S3ObjectStore } from '@docsmart/platform';
import { connect } from './db/connect.js';
import { devTokens } from './http/auth.js';
import { buildServer } from './http/server.js';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name}.`);
  return v;
};

const catalogue = FieldCatalogueSchema.parse(
  JSON.parse(readFileSync(new URL('../../../templates/fields/catalogue.json', import.meta.url), 'utf8')),
);
const store = new S3ObjectStore(env('S3_EVIDENCE_BUCKET'), {
  endpoint: env('S3_ENDPOINT'),
  region: env('S3_REGION'),
  accessKeyId: env('S3_ACCESS_KEY_ID'),
  secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
});
const app = await buildServer({
  db: connect(env('APP_DATABASE_URL')),
  store,
  catalogue,
  tokens: devTokens(process.env.API_DEV_TOKENS, process.env.ALLOW_DEV_TOKENS === '1'),
  logger: true,
});
await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
