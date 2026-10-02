/**
 * SVC-POLICY: versioned configuration such as check severities and template-selection rules (build
 * plan B1). A value changes only by adding a version from a reviewed change, naming who approved it.
 */
import type { Kysely } from 'kysely';
import { audit } from './audit.js';
import { type PlatformTables, platform } from './tables.js';

export interface PolicyValue<T = unknown> {
  version: number;
  value: T;
  approved_by: string;
  change_ref: string;
}

/** The current value (the highest version), or undefined when none has been set. */
export async function getPolicy<DB extends PlatformTables>(
  anyDb: Kysely<DB>,
  key: string,
): Promise<PolicyValue | undefined> {
  const db = platform(anyDb);
  const row = await db
    .selectFrom('policy_versions')
    .select(['version', 'value', 'approved_by', 'change_ref'])
    .where('key', '=', key)
    .orderBy('version', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row;
}

/** Adds a version. Run it in a transaction; two concurrent changes to one key cannot both succeed. */
export async function setPolicy<DB extends PlatformTables>(
  anyDb: Kysely<DB>,
  change: { tenant_id: string; key: string; value: unknown; approved_by: string; change_ref: string },
): Promise<number> {
  const db = platform(anyDb);
  if (!change.approved_by.trim() || !change.change_ref.trim()) {
    throw new Error('A policy change needs an approver and a change reference.');
  }
  const current = await getPolicy(db, change.key);
  const version = (current?.version ?? 0) + 1;
  await db
    .insertInto('policy_versions')
    .values({
      tenant_id: change.tenant_id,
      key: change.key,
      version,
      value: JSON.stringify(change.value),
      approved_by: change.approved_by,
      change_ref: change.change_ref,
    })
    .execute();
  await audit(db, {
    tenant_id: change.tenant_id,
    actor: change.approved_by,
    action: 'policy.changed',
    entity: 'policy',
    entity_id: change.key,
    details: { version, change_ref: change.change_ref },
  });
  return version;
}
