/** The platform services' tables (services/api/migrations/0001_foundation.sql), for Kysely. */
import type { ColumnType, Generated, Kysely } from 'kysely';

type Defaulted<T> = ColumnType<T, T | undefined, never>;

export interface AuditLogTable {
  seq: Generated<string>;
  tenant_id: string;
  at: Defaulted<Date>;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  version_hash: string | null;
  details: ColumnType<unknown, string, never>;
}

export interface EvidenceTable {
  tenant_id: string;
  sha256: string;
  media_type: string;
  size: ColumnType<string, number, never>;
  storage_key: string;
  created_by: string;
  created_at: Defaulted<Date>;
}

export interface PolicyVersionsTable {
  tenant_id: string;
  key: string;
  version: number;
  value: ColumnType<unknown, string, never>;
  approved_by: string;
  change_ref: string;
  created_at: Defaulted<Date>;
}

export interface PlatformTables {
  audit_log: AuditLogTable;
  evidence: EvidenceTable;
  policy_versions: PolicyVersionsTable;
}

/**
 * A database that includes the platform tables, viewed as just those tables. Kysely's types are not
 * covariant, so callers with a wider schema pass their connection and the platform narrows it here.
 */
export function platform<DB extends PlatformTables>(db: Kysely<DB>): Kysely<PlatformTables> {
  return db as unknown as Kysely<PlatformTables>;
}
