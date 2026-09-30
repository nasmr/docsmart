# 0002 Technology stack for the first build slice

Status: Proposed
Date: 30 September 2026
Decided by: (founder, engineering lead)

## Context

Build plan §7 recommends a stack, to be confirmed in milestone M0. See also `docs/spec/open-source-libraries.md`.

## Decision (proposed)

| Area | Choice |
|---|---|
| Main service language | TypeScript on Node |
| Database | PostgreSQL, with database-level immutability for document versions |
| State machine | XState v5, pinned, inside the API service |
| Durable execution | Not in the first slice. Choose Temporal or DBOS in the counsel slice. |
| Canonical template format | Own clause-tree JSON with stable clause IDs and typed slot schemas; Word for import and export. A one-week M0 spike tests Accord TemplateMark as the alternative. |
| Word rendering | docxtemplater core or a Python renderer behind an internal service |
| AI drafting | A generative model behind an internal model interface, with zero data retention and no training on customer data |
| Repository | One repository with `apps/`, `services/` and `packages/` workspaces |

## Consequences

- Tooling (package manager, workspace configuration, lint, test runner) is added only after this decision is accepted.
- Redline libraries are Python-strongest, so the counsel slice may add a small Python service.

## Open points

- Package manager and workspace tool.
- Hosting and data residency, which depend on where tenants are (spec §11).
