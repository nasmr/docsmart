# API service

**Build plan block:** B9 host (submission gate) and the API for all blocks  
**Milestone:** M1 onward  
**Status:** Built for this slice: migrations, data layer and HTTP API

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
| `src/http/server.ts` | The HTTP API: Fastify, with shapes from `@docsmart/schemas` and the OpenAPI document at `/openapi.json`. Errors map to one shape (`Error`): 400 for an invalid request or record (naming each field), 401/403, 404, 409 for a conflict or a refused gate (listing every failed condition), 422 for an import or approval refusal (naming each place). |
| `src/http/auth.ts` | Development sign-in until sign-in is decided (decision 0005): bearer tokens from `API_DEV_TOKENS`, each mapped to a tenant, an actor and a role (sponsor or counsel). Refused unless `ALLOW_DEV_TOKENS=1`. |
| `src/http/assembly-input.ts` | Builds the assembly input from the database: the approved template, current records, and the versions a document is built on. |
| `src/main.ts` | Starts the server from the environment (see `.env.example`). |
| `src/documents.ts` | Create, record a version, record checks and dispositions, mark ready, withdraw. Each is one transaction that applies the domain lifecycle, writes its rows and audits. Assembly's problems become blocking findings. The rendering of each version can be kept as evidence. The gate's required checks come from the `checks.required` policy; with no policy, the gate refuses. |

## Routes

| Route | Who | Does |
|---|---|---|
| `PUT /records/{entity}/{id}`, `GET …` | sponsor | Save a record (validated, versioned); read the current one |
| `POST /templates?id&template&class&version&jurisdictions` | any | Import a Word master; returns the import-rule problems |
| `POST /templates/{id}/approve`, `GET /templates` | counsel | Approve (DF-02); list |
| `PUT /policies/{key}` | counsel | A reviewed policy change, e.g. `checks.required` |
| `POST /documents`, `GET /documents/{id}` | sponsor | Create; read state and current version |
| `POST /documents/{id}/versions` | sponsor | Assemble from the records and record a version |
| `GET /documents/{id}/versions/{v}`, `…/word`, `…/findings` | sponsor | The assembled content, its Word rendering, its findings |
| `POST /findings/{id}/disposition` | sponsor | Keep (with a reason) or fix a review finding |
| `POST /documents/{id}/ready`, `GET …/package` | sponsor | Pass the submission gate and freeze the package; read it |
| `POST /documents/{id}/withdraw` | sponsor | Withdraw |

## Running

```
pnpm db:up
cp .env.example .env            # then export the variables
pnpm db:migrate                 # as the owner (DATABASE_URL)
pnpm --filter @docsmart/api run dev   # builds, then serves on PORT
pnpm test:integration           # fresh docsmart_test database, then all integration tests
```

The server needs a login role in `docsmart_app` for `APP_DATABASE_URL` (never the owner, or row-level security would not apply) and an evidence bucket. For local work, `src/db/roles.ts` creates the role; the integration tests create theirs.

The integration tests cover the HTTP API end to end, the database's guarantees (append-only history as the application and as the owner, tenant isolation, template status, migrations), the first slice end to end through the database, and the platform services. Twelve deliberately planted bugs in the migration, the document code and the HTTP layer were each caught.

## Rules this code must hold

- The submission gate (build plan §4) is enforced here, not in the UI.
- All permissive transitions are logged with the actor and version hash.

## References

Build plan §4 and B9
