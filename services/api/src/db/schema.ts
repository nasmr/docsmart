/** Kysely types for services/api/migrations. Platform tables come from @docsmart/platform. */
import type { PlatformTables } from '@docsmart/platform';
import type { ColumnType, Generated } from 'kysely';

type Json = ColumnType<unknown, string, string>;
type JsonOnce = ColumnType<unknown, string, never>;
type Defaulted<T> = ColumnType<T, T | undefined, never>;

export interface Database extends PlatformTables {
  tenants: { id: string; name: string; created_at: Defaulted<Date> };
  record_versions: {
    tenant_id: string;
    entity: RecordEntity;
    id: string;
    version: number;
    data: JsonOnce;
    created_by: string;
    created_at: Defaulted<Date>;
  };
  template_versions: {
    tenant_id: string;
    id: string;
    template: string;
    class: string;
    version: number;
    jurisdictions: string[];
    content_hash: string;
    content: JsonOnce;
    status: 'draft' | 'approved' | 'retired';
    approval: Json | null;
    retirement: Json | null;
    created_at: Defaulted<Date>;
  };
  documents: {
    tenant_id: string;
    id: string;
    class: string;
    scope: 'umbrella' | 'portfolio';
    umbrella_id: string;
    portfolio_id: string | null;
    state: 'DRAFTING' | 'ASSEMBLED' | 'READY_FOR_SUBMISSION' | 'WITHDRAWN';
    lifecycle: Json;
    row_version: ColumnType<number, number | undefined, number>;
    created_at: Defaulted<Date>;
    updated_at: ColumnType<Date, Date | undefined, Date>;
  };
  draft_versions: {
    tenant_id: string;
    id: string;
    document_id: string;
    number: number;
    parent_version_id: string | null;
    template_version_id: string;
    content_hash: string;
    content: JsonOnce;
    slot_snapshot: JsonOnce;
    calculations: JsonOnce;
    referenced_hashes: JsonOnce;
    rendering_sha256: string | null;
    created_by: string;
    created_at: Defaulted<Date>;
  };
  check_runs: { tenant_id: string; version_id: string; check: string; ran_at: Defaulted<Date> };
  findings: {
    tenant_id: string;
    id: string;
    version_id: string;
    check: string;
    severity: 'blocks' | 'review';
    at: string;
    message: string;
    created_at: Defaulted<Date>;
  };
  dispositions: {
    tenant_id: string;
    seq: Generated<string>;
    finding_id: string;
    decision: 'keep' | 'fix';
    reason: string | null;
    decided_by: string;
    decided_at: Defaulted<Date>;
  };
  submission_packages: {
    tenant_id: string;
    version_id: string;
    document_id: string;
    package: JsonOnce;
    package_hash: string;
    created_at: Defaulted<Date>;
  };
}

export type RecordEntity =
  | 'umbrella'
  | 'sponsor'
  | 'portfolio'
  | 'portfolio_terms'
  | 'offer'
  | 'asset'
  | 'subscription_account'
  | 'party'
  | 'subscription_request';
