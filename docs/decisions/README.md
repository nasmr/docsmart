# Decisions

One file per decision. A decision starts as **Proposed**, becomes **Accepted** or **Rejected** when the founder (and counsel, where marked) agrees, and is **Superseded** by a later decision rather than edited.

| # | Decision | Status | Needs |
|---|---|---|---|
| [0001](0001-ready-for-submission-state.md) | Add a `READY_FOR_SUBMISSION` state to the document lifecycle | Accepted | — |
| [0002](0002-technology-stack.md) | Technology stack for the first build slice | Accepted | — |
| [0003](0003-contracting-wording-and-portfolio-names.md) | Contracting-party wording and portfolio naming | Proposed | BVI counsel |
| [0004](0004-first-three-document-types.md) | First three document types | Proposed | Founder, design partner |
| [0005](0005-m1-tooling-and-libraries.md) | Tooling and libraries for milestone M1 | Accepted | — |
| [0006](0006-word-rendering.md) | Render Word documents from the canonical content | Accepted | — |
| [0007](0007-node-24-and-seaweedfs.md) | Node 24, and SeaweedFS for local object storage | Accepted | — |
| [0008](0008-canonical-template-format.md) | Canonical template format: our own clause tree | Accepted | — |
| [0009](0009-ready-package-stays-frozen.md) | A ready document's package stays frozen when records change | Accepted | — |
| [0010](0010-word-import-libraries-and-tracked-changes.md) | Word import: libraries, and refusing tracked changes | Accepted | — |
| [0011](0011-house-formatting.md) | House formatting for assembled documents | Accepted | — |
| [0012](0012-s3-client.md) | S3 client for the evidence store | Accepted | — |

## Format

```
# NNNN Title
Status: Proposed | Accepted | Rejected | Superseded by NNNN
Date:
Decided by:

## Context
## Decision
## Consequences
## Open points
```
