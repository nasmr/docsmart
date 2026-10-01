# Domain model and document state machine

**Build plan block:** B2 (and the state machine used by B9)  
**Milestone:** M1  
**Status:** Built for this slice, without the database layer

## What goes here

Umbrella, Portfolio, PortfolioTerms, Asset, Party/Role/ConsentGrant, Template/TemplateVersion/Clause, DocumentInstance, DraftVersion, Finding, Disposition, SubmissionPackage; and the lifecycle DRAFTING → ASSEMBLED → READY_FOR_SUBMISSION.

## What's here

| Module | Holds |
|---|---|
| `names.ts` | Legal-name rules and the contracting-party designation (decision 0003). The wording is a labelled placeholder until counsel confirms it. |
| `records.ts` | Zod schemas for the records the sponsor enters: umbrella, sponsor, portfolio, terms, offer, asset, subscription account, party, subscription request. They enforce what the spec requires of the records themselves. Whether a template has everything it needs is the required-slot check's job (B6). |
| `documents.ts` | Document instances, immutable draft versions, findings and dispositions. |
| `gate.ts` | The submission gate (build plan §4): every failed condition, in plain words. |
| `lifecycle.ts` | DRAFTING → ASSEMBLED → READY_FOR_SUBMISSION, plus WITHDRAWN (decision 0001). XState is used only as a pure transition function: the state lives in the database. |
| `submission.ts` | The frozen submission package, with a hash over its RFC 8785 form. |
| `consent.ts` | Consent to read an investor's record, scoped to one portfolio (INV-14). |

Rules the gate applies beyond the plain list in §4:

- Findings from the required-slot, contracting-party and cross-portfolio checks fail the gate whatever their severity, and can't be kept. They are invariants (INV-9, INV-10).
- A check that policy requires but that did not run fails condition 5, so a check can never pass silently.
- A referenced U3 or D13 must be READY_FOR_SUBMISSION. That stands in for CLEARED until field-catalogue gap G11 is decided.
- Which version is latest comes from the stored lifecycle, not from the caller's facts.

## Tests

`pnpm exec vitest run packages/domain` runs 125 tests:

- Every Meridian Horizon fixture validates, and each record rule rejects what it should, naming the field.
- Each gate condition fails on its own and all failures are reported together.
- Lifecycle transitions and refusals, plus an exhaustive exploration of every reachable state that checks the lifecycle invariants.
- Submission packages are frozen and tamper-evident.
- Consent is scoped to one portfolio, investor, purpose and time window.

Ten deliberately planted bugs, such as letting a stale version be marked ready or ignoring the portfolio in a consent check, were each caught.

## Rules this code must hold

- INV-3: a DraftVersion is never updated; enforce in the database, not only in code.
- INV-9 / INV-10 are checked before READY_FOR_SUBMISSION.
- Consent grants default to the portfolio the party joined through (INV-14).

## References

Spec §5; addendum §3 and §6; build plan B2 and §2.3; decision 0001
