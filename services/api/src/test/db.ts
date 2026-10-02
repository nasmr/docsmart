// Helpers for the integration tests: connections as the application and as the owner, and the
// Meridian Horizon fixtures loaded through the API's own functions.
import { readdirSync, readFileSync } from 'node:fs';
import { catalogue as fieldCatalogue, input as fixtureInput } from '@docsmart/assembly/testing';
import { importWord, type TemplateTree } from '@docsmart/template-library';
import { sql } from 'kysely';
import { type Actor, connect, withTenant } from '../db/connect.js';
import type { RecordEntity } from '../db/schema.js';
import { saveRecord } from '../records.js';
import { approveTemplate, storeTemplate } from '../templates.js';
import { APP_TEST, OWNER_TEST } from './env.js';

export const app = () => connect(APP_TEST);
export const owner = () => connect(OWNER_TEST);
export { fieldCatalogue, fixtureInput };

const repo = new URL('../../../../', import.meta.url);
const fx = (path: string) => JSON.parse(readFileSync(new URL(`fixtures/meridian-horizon/${path}`, repo), 'utf8'));

export const COUNSEL = { lawyer_id: 'law_bvi_1', verified: true, admissions: ['VG'] };

/** A tenant created by the owner (tenants are not the application's to create). */
export async function createTenant(id: string): Promise<void> {
  const db = owner();
  try {
    await sql`INSERT INTO tenants (id, name) VALUES (${id}, ${id}) ON CONFLICT DO NOTHING`.execute(db);
  } finally {
    await db.destroy();
  }
}

export async function firstPassTree(id: string): Promise<TemplateTree> {
  const dir = 'templates/first-pass/';
  const name = readdirSync(new URL(dir, repo)).find((f) => f.startsWith(`${id}_`)) as string;
  return (await importWord(readFileSync(new URL(dir + name, repo)), id)).tree;
}

/** Saves every Meridian Horizon record for a tenant through saveRecord (so each is validated). */
export async function loadFixtures(db: ReturnType<typeof app>, who: Actor): Promise<void> {
  await withTenant(db, who.tenant_id, async (tx) => {
    const save = (entity: RecordEntity, id: string, data: unknown) => saveRecord(tx, who, entity, id, data);
    const umbrella = fx('umbrella.json');
    await save('umbrella', umbrella.id, umbrella);
    const sponsor = fx('sponsor.json');
    await save('sponsor', sponsor.id, sponsor);
    for (const f of ['lumen', 'atlas', 'atlas-ii']) {
      const r = fx(`portfolios/${f}.json`);
      await save('portfolio', r.portfolio.id, r.portfolio);
      await save('portfolio_terms', r.portfolio.id, r.terms);
      await save('offer', r.offer.id, r.offer);
      await save('asset', r.asset.id, r.asset);
      await save('subscription_account', r.portfolio.id, r.subscription_account);
    }
    for (const p of fx('parties.json')) await save('party', p.id, p);
    for (const s of [...fx('subscriptions/atlas.json'), ...fx('subscriptions/lumen.json')])
      await save('subscription_request', s.id, s);
  });
}

/** "D12-A" → "D12", "D1SP-B" → "D1-SP". */
export const classOf = (template: string) =>
  template.startsWith('D1SP') ? 'D1-SP' : (template.split('-')[0] as string);

/** Stores and approves a first-pass template; returns its version id. */
export async function approvedTemplate(db: ReturnType<typeof app>, who: Actor, template: string): Promise<string> {
  const id = `${template}_v1`;
  await withTenant(db, who.tenant_id, async (tx) => {
    await storeTemplate(tx, who, {
      id,
      class: classOf(template),
      version: 1,
      jurisdictions: ['VG'],
      tree: await firstPassTree(template),
    });
    await approveTemplate(tx, who, id, fieldCatalogue, COUNSEL, '2026-10-02T09:00:00Z');
  });
  return id;
}
