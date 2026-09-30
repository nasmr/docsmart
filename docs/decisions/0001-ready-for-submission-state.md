# 0001 Add a READY_FOR_SUBMISSION state

Status: Proposed
Date: 30 September 2026
Decided by: (founder)

## Context

The spec's state machine goes from `ASSEMBLED` straight to `SUBMITTED` when the sponsor finishes self-review, and `SUBMITTED` implies an order with counsel. The first build slice does not include the counsel marketplace, so there is no way to create an order.

## Decision

Add `READY_FOR_SUBMISSION` between `ASSEMBLED` and `SUBMITTED`. A document enters it when one version passes the submission gate (build plan §4). That version is frozen as a submission package, which can be downloaded for counsel outside the platform until the marketplace exists. Any change creates a new version back in `ASSEMBLED`.

## Consequences

- The spec's §5.2 state machine and diagram need updating once accepted.
- The counsel slice starts from `READY_FOR_SUBMISSION` rather than `ASSEMBLED`.
- Sponsors can use the product with their own counsel before the marketplace is built.

## Open points

None.
