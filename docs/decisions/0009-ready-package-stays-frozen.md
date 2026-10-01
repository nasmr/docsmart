# 0009 A ready document's package stays frozen when records change

Status: Accepted
Date: 1 October 2026
Decided by: nas

## Context

Build plan §2.3 and decision 0001 say a document leaves `READY_FOR_SUBMISSION` when the sponsor makes a change, which creates a new version. They don't say what happens when the underlying records change while a document is ready, for example when the portfolio is renamed after its D12 passed the gate.

## Decision

The submission package stays exactly as it was frozen. A change to records does not move the document out of `READY_FOR_SUBMISSION`, and does not alter or invalidate the package. The document leaves `READY_FOR_SUBMISSION` only when a new version is assembled, which takes it back to `ASSEMBLED` (0001).

## Consequences

- `packages/domain` refuses `INPUTS_CHANGED` in `READY_FOR_SUBMISSION`. A test covers this.
- A package always describes the records as they were when it passed the gate. Whoever re-assembles a document after a records change sees the change through the checks on the new version: a rename, for example, fails the contracting-party check until the new wording is in place.
- Showing the sponsor that records have changed since a ready package was frozen is a matter for the workspace screens (B7), not for the lifecycle.

## Open points

None.
