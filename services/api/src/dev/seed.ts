/**
 * Local development data: the Meridian Horizon tenant, its fixture records, the first-pass templates
 * approved by a development counsel identity, and a checks policy. For a local database only: it
 * refuses to run unless ALLOW_DEV_TOKENS=1, the same switch that allows development sign-in.
 * Running it again leaves what is already there.
 *
 *   DATABASE_URL       the owner, to create the tenant
 *   APP_DATABASE_URL   the application role, for everything else
 *   SEED_TENANT        default "meridian"
 */
import { readFileSync } from 'node:fs';
import { FieldCatalogueSchema } from '@docsmart/assembly';
import { getPolicy, setPolicy } from '@docsmart/platform';
import type { Catalogue } from '@docsmart/template-library';
import { sql } from 'kysely';
import { type Actor, connect, withTenant } from '../db/connect.js';
import { CHECKS_POLICY } from '../documents.js';
import { currentRecord } from '../records.js';
import { approveTemplate, storeTemplate, templateVersion } from '../templates.js';
import { classOf, FIRST_PASS, firstPassTree, loadFixtures } from './fixtures.js';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name}.`);
  return v;
};
if (process.env.ALLOW_DEV_TOKENS !== '1')
  throw new Error('The seed is for local development only: set ALLOW_DEV_TOKENS=1.');

const tenant = process.env.SEED_TENANT ?? 'meridian';
const sponsor: Actor = { tenant_id: tenant, actor: 'dev_seed' };
const counsel = { lawyer_id: 'law_bvi_1', verified: true, admissions: ['VG'] };
const catalogue = FieldCatalogueSchema.parse(
  JSON.parse(readFileSync(new URL('../../../../templates/fields/catalogue.json', import.meta.url), 'utf8')),
) as unknown as Catalogue;

const owner = connect(env('DATABASE_URL'), 1);
try {
  await sql`INSERT INTO tenants (id, name) VALUES (${tenant}, ${tenant}) ON CONFLICT DO NOTHING`.execute(owner);
} finally {
  await owner.destroy();
}

const db = connect(env('APP_DATABASE_URL'), 1);
try {
  const seeded = await withTenant(db, tenant, (tx) => currentRecord(tx, 'umbrella', 'umb_meridian'));
  if (seeded) console.log('Records: already there.');
  else {
    await loadFixtures(db, sponsor);
    console.log('Records: Meridian Horizon fixtures saved.');
  }

  for (const template of FIRST_PASS) {
    const id = `${template.toLowerCase().replace(/-/g, '')}_v1`;
    await withTenant(db, tenant, async (tx) => {
      if (await templateVersion(tx, id)) return;
      const tree = await firstPassTree(template);
      await storeTemplate(tx, sponsor, { id, class: classOf(template), version: 1, jurisdictions: ['VG'], tree });
      await approveTemplate(tx, sponsor, id, catalogue, counsel, new Date().toISOString());
      console.log(`Template ${template}: stored and approved as ${id} (development counsel identity).`);
    });
  }

  await withTenant(db, tenant, async (tx) => {
    if (await getPolicy(tx, CHECKS_POLICY)) return;
    await setPolicy(tx, {
      tenant_id: tenant,
      key: CHECKS_POLICY,
      value: { U3: ['required_slot'], D12: ['required_slot'], D13: ['required_slot'], 'D1-SP': ['required_slot'] },
      approved_by: counsel.lawyer_id,
      change_ref: 'DEV-SEED',
    });
    console.log(`Policy ${CHECKS_POLICY}: set.`);
  });
} finally {
  await db.destroy();
}
