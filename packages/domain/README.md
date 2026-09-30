# Domain model and document state machine

**Build plan block:** B2 (and the state machine used by B9)  
**Milestone:** M1  
**Status:** Not started

## What goes here

Umbrella, Portfolio, PortfolioTerms, Asset, Party/Role/ConsentGrant, Template/TemplateVersion/Clause, DocumentInstance, DraftVersion, Finding, Disposition, SubmissionPackage; and the lifecycle DRAFTING → ASSEMBLED → READY_FOR_SUBMISSION.

## Rules this code must hold

- INV-3: a DraftVersion is never updated; enforce in the database, not only in code.
- INV-9 / INV-10 are checked before READY_FOR_SUBMISSION.
- Consent grants default to the portfolio the party joined through (INV-14).

## References

Spec §5; addendum §3 and §6; build plan B2 and §2.3; decision 0001
