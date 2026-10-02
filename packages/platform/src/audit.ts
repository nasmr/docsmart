/**
 * SVC-LOG: the audit log (GR-6). Every other package writes audit rows through this function, inside
 * the same transaction as the change it records, so the change and its record commit together.
 * The database makes the log append-only (migration 0001).
 */
import type { Kysely } from 'kysely';
import { type PlatformTables, platform } from './tables.js';

export interface AuditEntry {
  tenant_id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  /** The content hash of the version the action concerns, if any. */
  version_hash?: string;
  details?: Readonly<Record<string, unknown>>;
}

export async function audit<DB extends PlatformTables>(anyDb: Kysely<DB>, entry: AuditEntry): Promise<void> {
  const db = platform(anyDb);
  if (!entry.actor.trim()) throw new Error('An audit entry needs an actor.');
  await db
    .insertInto('audit_log')
    .values({
      tenant_id: entry.tenant_id,
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id,
      version_hash: entry.version_hash ?? null,
      details: JSON.stringify(entry.details ?? {}),
    })
    .execute();
}

export interface AuditRow {
  seq: string;
  at: Date;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  version_hash: string | null;
  details: unknown;
}

/** The trail for one entity, oldest first. */
export async function auditTrail<DB extends PlatformTables>(
  anyDb: Kysely<DB>,
  entity: string,
  entityId: string,
): Promise<AuditRow[]> {
  const db = platform(anyDb);
  return db
    .selectFrom('audit_log')
    .select(['seq', 'at', 'actor', 'action', 'entity', 'entity_id', 'version_hash', 'details'])
    .where('entity', '=', entity)
    .where('entity_id', '=', entityId)
    .orderBy('seq')
    .execute();
}
