# 0005 Tooling and libraries for milestone M1

Status: Accepted (Node version and MinIO superseded by 0007)
Date: 1 October 2026
Decided by: nas

## Context

Decision 0002 proposes the main stack: TypeScript on Node, PostgreSQL, XState v5, and one repository with `apps/`, `services/` and `packages/`. It leaves out the smaller choices engineers need in the first week of M1, and lists the package manager and workspace tool as open. This record makes those choices.

It builds on 0002's language and database. If 0002 is changed on those points, this record is revisited.

## Decision

| # | Area | Choice |
|---|---|---|
| 1 | Package manager and workspaces | pnpm workspaces, with TypeScript project references. No Nx or Turborepo until build times need them. |
| 2 | Tests, lint and format | Vitest for tests. Biome for lint and format. |
| 3 | Database access and migrations | Kysely (typed query builder) on `pg`. Migrations are plain SQL files, applied in order by a small in-repo runner. The runner records each file's SHA-256 and refuses to run if an applied migration has changed. No ORM. |
| 4 | Enforcing INV-3 and the audit log | Triggers reject `UPDATE` and `DELETE` on `draft_version` and `audit_log`, and the application's database role is never granted those rights. Tenancy uses PostgreSQL row-level security from the first migration. |
| 5 | Canonical form for content hashes | The canonical clause tree is serialised with RFC 8785 (JSON Canonicalization Scheme) and hashed with SHA-256. Hashes are stored as lower-case hex. |
| 6 | API style | REST, with an OpenAPI contract generated from Zod schemas. The schemas live in a shared package and are used by both the API and the web app. The API runs on Fastify. |
| 7 | Calculation service | `packages/calc`: pure functions on decimal strings using decimal.js. Every result carries an evidence record (function, version, inputs), which is what the `calculated` origin in the field catalogue points to. This resolves field-catalogue gap G9 for this slice. |
| 8 | Local environment | Docker Compose running PostgreSQL and MinIO (S3-compatible storage for the evidence store). Everything runs offline, with no cloud account. |
| 9 | Web app | React with Vite, as a single-page app with no server rendering. The component library is still the front-end engineer's choice (build plan §7). |

### Versions at the time of this decision

Majors are pinned when the workspace is set up. Re-check licences before upgrading.

| Package | Version | Licence |
|---|---|---|
| pnpm | 12.8 | MIT |
| TypeScript | 7.0 | Apache-2.0 |
| Vitest | 5.0 | MIT |
| Biome (`@biomejs/biome`) | 2.5 | MIT or Apache-2.0 |
| Kysely | 0.29 | MIT |
| pg | 8.23 | MIT |
| Fastify | 5.12 | MIT |
| Zod | 4.6 | MIT |
| fastify-type-provider-zod | 7.0 | MIT |
| @fastify/swagger | 9.9 | MIT |
| decimal.js | 10.6 | MIT |
| canonicalize (RFC 8785) | 5.1 | Apache-2.0 |
| React | 19.3 | MIT |
| Vite | 8.3 | MIT |
| XState (from 0002) | 5.33 | MIT |

Node 22 LTS.

## Why

- **pnpm:** its strict dependency resolution stops a package from using a dependency it hasn't declared, which matters when packages have hard boundaries (for example, only `packages/platform` writes audit rows).
- **Kysely and plain SQL:** INV-3, the append-only audit log and row-level security all live in SQL (triggers, roles, policies). An ORM that generates its own migrations hides or fights these. The checksum rule gives migrations the same property as draft versions: once applied, never changed.
- **Row-level security from the first migration:** spec §11 requires it, and adding it to an existing schema is much harder than starting with it.
- **RFC 8785:** the M1 exit test is "same inputs, same hash". Plain `JSON.stringify` doesn't guarantee key order or number formatting, so golden hashes would break for reasons unrelated to content.
- **Zod and OpenAPI:** build plan §5 has front-end work starting in M1 against the API contract. A single schema source keeps the contract, the validation and the types in step.
- **`packages/calc`:** CLAUDE.md requires every number in a document to come from records or the calculation service. D12 needs a calculated total consideration in M1, and the build plan has no block for the service. A small package is enough until notices and allocations need more.
- **React and Vite:** the sponsor workspace is an authenticated app, so server rendering adds cost without benefit.

## Consequences

- Workspace tooling can be set up now that 0002 is accepted.
- `packages/calc` and a shared schema package are added to the repository layout.
- Field-catalogue gap G9 is resolved for this slice.
- Migration files are append-only in practice: a mistake is fixed by a new migration.

## Open points

- Word rendering. 0002 proposes docxtemplater or a Python renderer. The alternative, rendering from the canonical content with the `docx` library the generator already uses, is not decided here.
- The canonical template format itself, which the M0 spike decides.
- Deferred: hosting and data residency, and sign-in with two-factor authentication (both needed before design-partner data is hosted, about M4); the AI provider (M3; start the zero-retention and data-processing agreements now); PDF rendering (M2).
