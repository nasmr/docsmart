// The HTTP API end to end, through Fastify's inject, against the test database and SeaweedFS.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { S3ObjectStore } from '@docsmart/platform';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { connect } from '../db/connect.js';
import { createTenant, fieldCatalogue, firstPassTree } from '../test/db.js';
import { APP_TEST, S3, TEST_BUCKET } from '../test/env.js';
import { devTokens, type Principal } from './auth.js';
import { buildServer } from './server.js';

const SPONSOR = 'sponsor-token-0123456789';
const COUNSEL = 'counsel-token-0123456789';
const SPONSOR_SPOKE = 'other-tenant-token-0123456789';
const tokens = devTokens(
  JSON.stringify({
    [SPONSOR]: { role: 'sponsor', tenant_id: 'http_t', actor: 'sponsor_ops_1' },
    [COUNSEL]: {
      role: 'counsel',
      tenant_id: 'http_t',
      actor: 'law_bvi_1',
      lawyer: { verified: true, admissions: ['VG'] },
    },
    [SPONSOR_SPOKE]: { role: 'sponsor', tenant_id: 'http_u', actor: 'someone_else' },
  } satisfies Record<string, Principal>),
  true,
);

const repo = new URL('../../../../', import.meta.url);
const fx = (path: string) => JSON.parse(readFileSync(new URL(`fixtures/meridian-horizon/${path}`, repo), 'utf8'));
const firstPass = (name: string) => readFileSync(new URL(`templates/first-pass/${name}`, repo));
const WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const db = connect(APP_TEST);
const store = new S3ObjectStore(TEST_BUCKET, S3);
let app: FastifyInstance;

const call = (
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  token: string | null,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  app.inject({
    method,
    url,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : Buffer.isBuffer(body) ? { payload: body } : { payload: body as object }),
  });

beforeAll(async () => {
  await createTenant('http_t');
  await createTenant('http_u');
  app = await buildServer({
    db,
    store,
    catalogue: fieldCatalogue,
    tokens,
    now: () => new Date('2026-10-02T12:00:00Z'),
  });
});
afterAll(async () => {
  await app.close();
  store.destroy();
  await db.destroy();
});

describe('sign-in', () => {
  test('health and the contract need no token', async () => {
    expect((await call('GET', '/health', null)).statusCode).toBe(200);
    expect((await call('GET', '/openapi.json', null)).statusCode).toBe(200);
  });

  test('everything else needs a recognised token', async () => {
    expect((await call('GET', '/templates', null)).json()).toEqual({
      error: 'unauthenticated',
      message: 'Send a bearer token.',
    });
    expect((await call('GET', '/templates', 'not-a-real-token-xxxxxxxx')).statusCode).toBe(401);
  });

  test('development tokens are refused unless explicitly allowed', () => {
    expect(() => devTokens('{}', false)).toThrow(/local use only/);
    expect(() => devTokens(JSON.stringify({ short: { role: 'sponsor', tenant_id: 't', actor: 'a' } }), true)).toThrow(
      /at least 16/,
    );
  });
});

describe('the first slice over HTTP', () => {
  test('records: saved through validation, with the problem named when invalid', async () => {
    const save = (entity: string, id: string, data: unknown) => call('PUT', `/records/${entity}/${id}`, SPONSOR, data);
    const umbrella = fx('umbrella.json');
    expect((await save('umbrella', umbrella.id, umbrella)).json()).toEqual({
      entity: 'umbrella',
      id: 'umb_meridian',
      version: 1,
    });
    await save('sponsor', 'spn_meridian', fx('sponsor.json'));
    const lumen = fx('portfolios/lumen.json');
    await save('portfolio', 'pf_lumen', lumen.portfolio);
    await save('portfolio_terms', 'pf_lumen', lumen.terms);
    await save('offer', lumen.offer.id, lumen.offer);
    await save('asset', lumen.asset.id, lumen.asset);
    await save('subscription_account', 'pf_lumen', lumen.subscription_account);

    const bad = await save('portfolio', 'pf_bad', { ...lumen.portfolio, id: 'pf_bad', legal_name: 'Bad SP' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({
      error: 'invalid_record',
      issues: ['legal_name: must include “Segregated Portfolio” as words'],
    });
    expect((await call('GET', '/records/portfolio/pf_lumen', SPONSOR)).json().data.legal_name).toBe(
      'Lumen Segregated Portfolio',
    );
  });

  test('templates: imported from Word, approved only by counsel', async () => {
    const imported = await call(
      'POST',
      '/templates?id=d12a_v1&template=D12-A&class=D12&version=1&jurisdictions=VG',
      SPONSOR,
      firstPass('D12-A_Creation_Resolution_Written_Standard.docx'),
      { 'content-type': WORD },
    );
    expect(imported.statusCode).toBe(201);
    expect(imported.json()).toMatchObject({ template: { id: 'd12a_v1', status: 'draft' }, rule_problems: [] });
    expect((await call('POST', '/templates/d12a_v1/approve', SPONSOR)).statusCode).toBe(403);
    expect((await call('POST', '/templates/d12a_v1/approve', COUNSEL)).json()).toMatchObject({
      status: 'approved',
      approval: { lawyer_id: 'law_bvi_1' },
    });
  });

  test('a file that is not Word is refused with the reason', async () => {
    const r = await call(
      'POST',
      '/templates?id=junk_v1&template=D12-A&class=D12&version=1&jurisdictions=VG',
      SPONSOR,
      Buffer.from('not a word file'),
      { 'content-type': WORD },
    );
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({ error: 'import_failed', problems: [{ code: 'not_word' }] });
  });

  test('policy: changed only by counsel, with a change reference', async () => {
    const body = { value: { D12: ['required_slot'] }, change_ref: 'CHG-HTTP-1' };
    expect((await call('PUT', '/policies/checks.required', SPONSOR, body)).statusCode).toBe(403);
    expect((await call('PUT', '/policies/checks.required', COUNSEL, body)).json()).toEqual({
      key: 'checks.required',
      version: 1,
    });
  });

  test('document: create, assemble, read the version and its Word file, pass the gate', async () => {
    const created = await call('POST', '/documents', SPONSOR, {
      id: 'lumen_d12',
      class: 'D12',
      scope: 'portfolio',
      umbrella_id: 'umb_meridian',
      portfolio_id: 'pf_lumen',
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ state: 'DRAFTING', current_version: null });
    expect(
      (
        await call('POST', '/documents', SPONSOR, {
          id: 'lumen_d12',
          class: 'D12',
          scope: 'portfolio',
          umbrella_id: 'umb_meridian',
          portfolio_id: 'pf_lumen',
        })
      ).statusCode,
    ).toBe(409);

    const inputs = fx('documents.json').documents.find((d: { id: string }) => d.id === 'doc_lumen_d12').inputs;
    const v = await call('POST', '/documents/lumen_d12/versions', SPONSOR, { template_version_id: 'd12a_v1', inputs });
    expect(v.statusCode).toBe(201);
    const version = v.json();
    expect(version).toMatchObject({ number: 1, problems: [] });

    const content = (await call('GET', `/documents/lumen_d12/versions/${version.version_id}`, SPONSOR)).json();
    expect(content.content_hash).toBe(version.content_hash);
    expect(
      content.content.body
        .find((b: { t: string }) => b.t === 'locked')
        .text.map((p: { v: string }) => p.v)
        .join(''),
    ).toBe('Meridian Horizon SPC Limited for and on behalf of Lumen Segregated Portfolio');

    const word = await call('GET', `/documents/lumen_d12/versions/${version.version_id}/word`, SPONSOR);
    expect(word.headers['content-type']).toBe(WORD);
    expect(createHash('sha256').update(word.rawPayload).digest('hex')).toBe(version.rendering);

    const ready = await call('POST', '/documents/lumen_d12/ready', SPONSOR);
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({
      version_id: version.version_id,
      content_hash: version.content_hash,
      passed_by: 'sponsor_ops_1',
    });
    expect((await call('GET', '/documents/lumen_d12/package', SPONSOR)).json().package_hash).toBe(
      ready.json().package_hash,
    );
    expect((await call('GET', '/documents/lumen_d12', SPONSOR)).json()).toMatchObject({
      state: 'READY_FOR_SUBMISSION',
      ready_version_id: version.version_id,
    });
  });

  test('another tenant cannot see it', async () => {
    expect((await call('GET', '/documents/lumen_d12', SPONSOR_SPOKE)).statusCode).toBe(404);
    expect((await call('GET', '/records/umbrella/umb_meridian', SPONSOR_SPOKE)).statusCode).toBe(404);
  });

  test('a missing value: the version records it, the finding shows it, and the gate refuses', async () => {
    await call('POST', '/documents', SPONSOR, {
      id: 'lumen_d12_b',
      class: 'D12',
      scope: 'portfolio',
      umbrella_id: 'umb_meridian',
      portfolio_id: 'pf_lumen',
    });
    const v = (
      await call('POST', '/documents/lumen_d12_b/versions', SPONSOR, {
        template_version_id: 'd12a_v1',
        inputs: { effective_date: '2026-10-20' },
      })
    ).json();
    expect(v.problems).toContainEqual(expect.objectContaining({ field: 'resolution.date', kind: 'missing_value' }));
    const findings = (await call('GET', `/documents/lumen_d12_b/versions/${v.version_id}/findings`, SPONSOR)).json()
      .findings;
    expect(findings).toContainEqual(expect.objectContaining({ check: 'required_slot', severity: 'blocks' }));
    expect(
      (
        await call('POST', `/findings/${findings[0].id}/disposition`, SPONSOR, { decision: 'keep', reason: 'fine' })
      ).json(),
    ).toMatchObject({ error: 'conflict' });
    const refused = await call('POST', '/documents/lumen_d12_b/ready', SPONSOR);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({
      error: 'gate_refused',
      gate: { passed: false, failures: [expect.objectContaining({ condition: 2 })] },
    });
  });

  test('withdrawn: nothing more is accepted', async () => {
    expect(
      (await call('POST', '/documents/lumen_d12_b/withdraw', SPONSOR, { reason: 'Started again.' })).statusCode,
    ).toBe(204);
    expect(
      (
        await call('POST', '/documents/lumen_d12_b/versions', SPONSOR, { template_version_id: 'd12a_v1', inputs: {} })
      ).json(),
    ).toMatchObject({
      error: 'conflict',
      message: 'The document has been withdrawn.',
    });
  });

  test('requests that break the contract are refused before anything runs', async () => {
    const r = await call('POST', '/documents', SPONSOR, {
      id: 'Bad Id',
      class: 'D99',
      scope: 'portfolio',
      umbrella_id: 'umb_meridian',
      portfolio_id: null,
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe('invalid_request');
    expect(
      (await call('POST', '/findings/x/disposition', SPONSOR, { decision: 'keep', reason: '  ' })).statusCode,
    ).toBe(400);
  });
});

describe('the OpenAPI contract', () => {
  test('describes every route, with typed responses and errors', async () => {
    const doc = (await call('GET', '/openapi.json', null)).json();
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths).sort()).toEqual([
      '/documents',
      '/documents/{id}',
      '/documents/{id}/package',
      '/documents/{id}/ready',
      '/documents/{id}/versions',
      '/documents/{id}/versions/{version}',
      '/documents/{id}/versions/{version}/findings',
      '/documents/{id}/versions/{version}/word',
      '/documents/{id}/withdraw',
      '/findings/{id}/disposition',
      '/policies/{key}',
      '/records/{entity}/{id}',
      '/templates',
      '/templates/{id}/approve',
    ]);
    expect(Object.keys(doc.components.schemas)).toEqual(
      expect.arrayContaining(['Error', 'AssembledDocument', 'SubmissionPackage', 'Piece']),
    );
    expect(doc.paths['/documents/{id}/ready'].post.responses['409']).toBeDefined();
  });
});

test('the catalogue the server uses covers the templates it imports', async () => {
  expect((await firstPassTree('D12-A')).template).toBe('D12-A');
  expect(Object.keys(fieldCatalogue.fields).length).toBeGreaterThan(100);
});
