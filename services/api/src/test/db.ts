// Helpers for the integration tests: connections as the application and as the owner, and the
// Meridian Horizon fixtures loaded through the API's own functions.
import { catalogue as fieldCatalogue, input as fixtureInput } from '@docsmart/assembly/testing';
import { sql } from 'kysely';
import { type Actor, connect, withTenant } from '../db/connect.js';
import { classOf, firstPassTree } from '../dev/fixtures.js';
import { approveTemplate, storeTemplate } from '../templates.js';
import { APP_TEST, OWNER_TEST } from './env.js';

export const app = () => connect(APP_TEST);
export const owner = () => connect(OWNER_TEST);
export { classOf, firstPassTree, loadFixtures } from '../dev/fixtures.js';
export { fieldCatalogue, fixtureInput };

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
