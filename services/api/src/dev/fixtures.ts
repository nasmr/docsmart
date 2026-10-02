// The Meridian Horizon fixtures and first-pass templates, loaded through the API's own functions so
// every record is validated. Used by the integration tests and the local seed (dev/seed.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { importWord, type TemplateTree } from '@docsmart/template-library';
import type { Kysely } from 'kysely';
import { type Actor, withTenant } from '../db/connect.js';
import type { Database, RecordEntity } from '../db/schema.js';
import { saveRecord } from '../records.js';

const repo = new URL('../../../../', import.meta.url);
const fx = (path: string) => JSON.parse(readFileSync(new URL(`fixtures/meridian-horizon/${path}`, repo), 'utf8'));

/** The first-pass templates in templates/first-pass, by id. */
export const FIRST_PASS = ['D12-A', 'D12-B', 'D12-C', 'D13-A', 'D13-B', 'D13-C', 'D1SP-A', 'D1SP-B', 'D1SP-C'] as const;

export async function firstPassTree(id: string): Promise<TemplateTree> {
  const dir = 'templates/first-pass/';
  const name = readdirSync(new URL(dir, repo)).find((f) => f.startsWith(`${id}_`)) as string;
  return (await importWord(readFileSync(new URL(dir + name, repo)), id)).tree;
}

/** "D12-A" → "D12", "D1SP-B" → "D1-SP". */
export const classOf = (template: string) =>
  template.startsWith('D1SP') ? 'D1-SP' : (template.split('-')[0] as string);

/** Saves every Meridian Horizon record for a tenant through saveRecord (so each is validated). */
export async function loadFixtures(db: Kysely<Database>, who: Actor): Promise<void> {
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
