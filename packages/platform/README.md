# Platform services

**Build plan block:** B1  
**Milestone:** M0 (thin), M1  
**Status:** Built for this slice: audit log, policy store, evidence store. The identity stub comes with investor screens (M3).  
**Decisions:** 0005, 0007, 0012  

## What goes here

Minimal versions of the shared services from the agent spec: audit log (SVC-LOG), evidence store (SVC-EVID), policy store (SVC-POLICY), and a stub of the shared identity module (parties and consent grants).

## What's here

| Module | Holds |
|---|---|
| `audit.ts` | `audit()` writes an entry in the caller's transaction, so a change and its record commit together; `auditTrail()` reads one entity's trail. The log is append-only in the database. |
| `policy.ts` | Versioned configuration. Each change adds a version and needs an approver and a change reference; the latest version counts. |
| `evidence.ts` | Content-addressed evidence: bytes in object storage under their SHA-256, metadata in the database. Reads check the bytes against their hash, so altered or missing content is an error. `S3ObjectStore` (decision 0012) and `MemoryObjectStore` implement the storage interface. |
| `tables.ts` | Kysely types for the platform's tables. The functions take any database that includes them. |

The tables are created by `services/api/migrations/0001_foundation.sql`. Tests are in `services/api/src/platform.int.test.ts` (`pnpm test:integration`).

## Rules this code must hold

- Every other package writes audit rows through this one; nothing writes them directly.
- Evidence is content-addressed (SHA-256).
- Policy (template-selection rules, check severities) changes only through a reviewed change.

## References

Agent spec §1.2; build plan B1; spec DF-50
