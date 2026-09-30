# 0003 Contracting-party wording and portfolio names

Status: Proposed (needs BVI counsel)
Date: 30 September 2026
Decided by: (BVI counsel)

## Context

The BVI SPC addendum and the portal design use "[SPC] for the account of [Portfolio]" and short portfolio names such as "Atlas SP". Research for the first-pass templates found public guidance from BVI law firms saying:

- a contract meant to bind a segregated portfolio must state that it is executed by the SPC for and on behalf of that portfolio (Harneys);
- each segregated portfolio's name must include the words "Segregated Portfolio" (Harneys; Carey Olsen);
- the SPC's own name must include "Segregated Portfolio Company" or "SPC" (Conyers).

## Decision (proposed)

- The designation generator (addendum DF-62) produces "[SPC legal name] for and on behalf of [portfolio legal name]".
- `portfolio.legal_name` always holds the full name including "Segregated Portfolio". A separate `portfolio.short_name` may be used in the interface if counsel agrees.
- The name fields are validated for the required words when a portfolio or umbrella is created.

## Consequences

- The addendum and the portal design are updated to match once counsel confirms.
- The first-pass templates already use this wording.

## Open points

- Exact wording approved by counsel.
- Whether a short name may appear in investor-facing screens and emails.
