-- 0001 Foundation: tenancy, the platform services' tables (B1), records and documents (B2).
--
-- Decision 0005: immutability is enforced in the database. Tables that hold history are
-- append-only twice over: the application role is never granted UPDATE, DELETE or TRUNCATE on
-- them, and a trigger refuses those changes from anyone, including the owner. Every table is
-- scoped to a tenant by row-level security from this first migration.
--
-- The application connects as a member of docsmart_app and sets app.tenant_id for each
-- transaction. Migrations run as the owner.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'docsmart_app') THEN
    CREATE ROLE docsmart_app NOLOGIN;
  END IF;
END
$$;

-- The tenant the current transaction acts for; null when none is set, which matches no row.
CREATE FUNCTION current_tenant() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '') $$;

-- Raised by triggers on append-only tables.
CREATE FUNCTION refuse_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

-- ---------- tenants ----------

CREATE TABLE tenants (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]*$'),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- platform services (B1) ----------

-- SVC-LOG. Every state change, version, check result, decision and AI call (GR-6).
CREATE TABLE audit_log (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants (id),
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor text NOT NULL CHECK (actor <> ''),
  action text NOT NULL CHECK (action <> ''),
  entity text NOT NULL,
  entity_id text NOT NULL,
  version_hash text CHECK (version_hash ~ '^[0-9a-f]{64}$'),
  details jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_log_entity ON audit_log (tenant_id, entity, entity_id, seq);

-- SVC-EVID. Content-addressed: the key is the SHA-256 of the bytes, which live in object storage.
CREATE TABLE evidence (
  tenant_id text NOT NULL REFERENCES tenants (id),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  media_type text NOT NULL,
  size bigint NOT NULL CHECK (size >= 0),
  storage_key text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, sha256)
);

-- SVC-POLICY. Versioned configuration, each version from a reviewed change. The current value is
-- the highest version.
CREATE TABLE policy_versions (
  tenant_id text NOT NULL REFERENCES tenants (id),
  key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  value jsonb NOT NULL,
  approved_by text NOT NULL CHECK (approved_by <> ''),
  change_ref text NOT NULL CHECK (change_ref <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key, version)
);

-- ---------- records (B2) ----------

-- Every record the sponsor enters, as versioned documents validated by @docsmart/domain before
-- they are written. A change is a new version; the current record is the highest version.
CREATE TABLE record_versions (
  tenant_id text NOT NULL REFERENCES tenants (id),
  entity text NOT NULL CHECK (entity IN (
    'umbrella', 'sponsor', 'portfolio', 'portfolio_terms', 'offer', 'asset', 'subscription_account',
    'party', 'subscription_request'
  )),
  id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  data jsonb NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, entity, id, version)
);

-- ---------- templates (B3) ----------

-- Template content is immutable. Only the status moves, and only draft → approved → retired;
-- the approval and retirement records are set once.
CREATE TABLE template_versions (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  template text NOT NULL,
  class text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  jurisdictions text[] NOT NULL CHECK (cardinality(jurisdictions) > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  content jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'retired')),
  approval jsonb,
  retirement jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, template, version)
);

CREATE FUNCTION template_version_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'template versions are never deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.tenant_id, NEW.id, NEW.template, NEW.class, NEW.version, NEW.jurisdictions, NEW.content_hash, NEW.content, NEW.created_at)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.id, OLD.template, OLD.class, OLD.version, OLD.jurisdictions, OLD.content_hash, OLD.content, OLD.created_at) THEN
    RAISE EXCEPTION 'template content is immutable; make a new version' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT ((OLD.status = 'draft' AND NEW.status = 'approved' AND OLD.approval IS NULL AND NEW.approval IS NOT NULL AND NEW.retirement IS NULL)
       OR (OLD.status = 'approved' AND NEW.status = 'retired' AND NEW.approval IS NOT DISTINCT FROM OLD.approval
           AND OLD.retirement IS NULL AND NEW.retirement IS NOT NULL)) THEN
    RAISE EXCEPTION 'template status can only move draft → approved → retired, once each' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER template_versions_guard BEFORE UPDATE OR DELETE ON template_versions
  FOR EACH ROW EXECUTE FUNCTION template_version_guard();

-- ---------- documents (B2, decisions 0001, 0009) ----------

-- The document and its lifecycle. The state changes; everything it points to is append-only.
CREATE TABLE documents (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  class text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('umbrella', 'portfolio')),
  umbrella_id text NOT NULL,
  portfolio_id text,
  state text NOT NULL CHECK (state IN ('DRAFTING', 'ASSEMBLED', 'READY_FOR_SUBMISSION', 'WITHDRAWN')),
  lifecycle jsonb NOT NULL,
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  -- INV-9: a portfolio document has a portfolio; an umbrella document has none.
  CHECK ((scope = 'portfolio') = (portfolio_id IS NOT NULL))
);

-- INV-3: a draft version is never changed.
CREATE TABLE draft_versions (
  tenant_id text NOT NULL,
  id text NOT NULL,
  document_id text NOT NULL,
  number integer NOT NULL CHECK (number > 0),
  parent_version_id text,
  template_version_id text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  content jsonb NOT NULL,
  slot_snapshot jsonb NOT NULL,
  calculations jsonb NOT NULL,
  referenced_hashes jsonb NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, document_id, number),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id),
  FOREIGN KEY (tenant_id, template_version_id) REFERENCES template_versions (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_version_id) REFERENCES draft_versions (tenant_id, id),
  CHECK ((number = 1) = (parent_version_id IS NULL))
);

-- The checks that ran on a version, so a check can never pass by not running (build plan B6).
CREATE TABLE check_runs (
  tenant_id text NOT NULL,
  version_id text NOT NULL,
  "check" text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version_id, "check"),
  FOREIGN KEY (tenant_id, version_id) REFERENCES draft_versions (tenant_id, id)
);

CREATE TABLE findings (
  tenant_id text NOT NULL,
  id text NOT NULL,
  version_id text NOT NULL,
  "check" text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('blocks', 'review')),
  at text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, version_id) REFERENCES draft_versions (tenant_id, id)
);

-- The sponsor's decisions on review findings. Appended; the latest decision on a finding counts.
CREATE TABLE dispositions (
  tenant_id text NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  finding_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('keep', 'fix')),
  reason text,
  decided_by text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, seq),
  FOREIGN KEY (tenant_id, finding_id) REFERENCES findings (tenant_id, id),
  CHECK (decision <> 'keep' OR (reason IS NOT NULL AND btrim(reason) <> ''))
);

-- The frozen package (B9). One per version that passed the gate.
CREATE TABLE submission_packages (
  tenant_id text NOT NULL,
  version_id text NOT NULL,
  document_id text NOT NULL,
  package jsonb NOT NULL,
  package_hash text NOT NULL CHECK (package_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version_id),
  FOREIGN KEY (tenant_id, version_id) REFERENCES draft_versions (tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id)
);

-- ---------- append-only, row-level security, grants ----------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_log', 'evidence', 'policy_versions', 'record_versions', 'draft_versions',
                           'check_runs', 'findings', 'dispositions', 'submission_packages'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION refuse_change()', t || '_append_only', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION refuse_change()', t || '_no_truncate', t);
    EXECUTE format('GRANT SELECT, INSERT ON %I TO docsmart_app', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['audit_log', 'evidence', 'policy_versions', 'record_versions', 'template_versions', 'documents',
                           'draft_versions', 'check_runs', 'findings', 'dispositions', 'submission_packages'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant())', t);
  END LOOP;
END
$$;

-- Templates move status; documents move state. Neither is ever deleted.
GRANT SELECT, INSERT, UPDATE ON template_versions, documents TO docsmart_app;
GRANT SELECT ON tenants TO docsmart_app;
