# API service

**Build plan block:** B9 host (submission gate) and the API for all blocks  
**Milestone:** M1 onward  
**Status:** Data layer built (migrations, records, templates, documents and the gate); HTTP routes next

## What goes here

Hosts the document state machine and exposes the API the web app uses: umbrella and portfolio set-up, document creation, assembly, checks, dispositions, re-drafts, the submission gate and package download.

## What's here

| Path | Holds |
|---|---|
| `migrations/` | Plain SQL, applied in order by `src/db/migrate.ts`. Each applied file is recorded with its SHA-256; a changed or missing applied file stops the runner. Fix mistakes with a new migration. |
| `migrations/0001_foundation.sql` | Tenancy with row-level security on every table; the platform tables; records as versioned documents; templates; documents, draft versions, check runs, findings, dispositions and submission packages. History tables are append-only twice over: no UPDATE, DELETE or TRUNCATE grant for `docsmart_app`, and a trigger that refuses them from anyone. Template content is immutable and status moves only draft → approved → retired. |
| `src/db/` | Connections (`withTenant` runs work in one transaction for one tenant), the Kysely types, the migration runner, and a local login role for development and tests. |
| `src/records.ts` | Records validated by `@docsmart/domain` and saved as new versions. |
| `src/templates.ts` | Template versions stored once and approved through `@docsmart/template-library`. |
| `src/documents.ts` | Create, record a version, record checks and dispositions, mark ready, withdraw. Each is one transaction that applies the domain lifecycle, writes its rows and audits. Assembly's problems become blocking findings. The rendering of each version can be kept as evidence. The gate's required checks come from the `checks.required` policy; with no policy, the gate refuses. |

## Running

```
pnpm db:up
DATABASE_URL=postgres://docsmart:docsmart@127.0.0.1:5432/docsmart pnpm db:migrate
pnpm test:integration     # fresh docsmart_test database, then 39 tests
```

The integration tests cover the database's guarantees (append-only history as the application and as the owner, tenant isolation, template status, migrations), the first slice end to end through the database, and the platform services. Eight deliberately planted bugs in the migration and the document code were each caught.

## Rules this code must hold

- The submission gate (build plan §4) is enforced here, not in the UI.
- All permissive transitions are logged with the actor and version hash.

## References

Build plan §4 and B9
