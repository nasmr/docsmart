# Documentation

## Reading order

1. **[spec/document-factory-spec-and-plan.md](spec/document-factory-spec-and-plan.md)**: what the product is, its principles, document catalogue, architecture, data model, requirements and the original six-month plan.
2. **[spec/bvi-spc-addendum.md](spec/bvi-spc-addendum.md)**: how the product models a BVI segregated portfolio company with one portfolio per project. Adds the umbrella and portfolio records, portfolio-level documents and invariants INV-9 to INV-14.
3. **[spec/architecture-and-lifecycle.html](spec/architecture-and-lifecycle.html)**: interactive component map and document lifecycle walkthrough. Open it in a browser.
4. **[spec/build-plan-drafting-to-submission.md](spec/build-plan-drafting-to-submission.md)**: the first build slice (drafting → assembled → ready for submission), ten building blocks, six milestones over about 15 weeks.
5. **[decisions/](decisions/)**: decisions made and still open.
6. **[spec/jev-integration-proposal.md](spec/jev-integration-proposal.md)**: optional judgment layer using a calibrated classification model. Not in the first build slice unless the M0 spike is approved.
7. **[spec/open-source-libraries.md](spec/open-source-libraries.md)**: candidate libraries for the state machine and template library.
8. **[design/](design/)**: the portal design exploration.

## Status of each document

| Document | Status | Known updates pending |
|---|---|---|
| Spec and plan | Draft v0.1 | State machine gains `READY_FOR_SUBMISSION` if decision 0001 is accepted |
| BVI SPC addendum | Draft v0.1 | Contracting wording and portfolio naming (decision 0003) |
| Architecture page | Draft v0.1 | None |
| Build plan | Draft v0.1 | Decisions 0001, 0002 and 0004 are listed in its §10 |
| Jev proposal | Proposal | Depends on an M0 spike |
| Open-source libraries | Research note | Re-check before committing to a library |

## Names in the Claude project

These documents started in the "Singularity Markets" Claude project under longer names. Cross-references inside the documents still use those names.

| In this repository | In the project |
|---|---|
| `spec/document-factory-spec-and-plan.md` | `Singularity_Tool2_Document_Factory_Spec_and_Plan.md` |
| `spec/bvi-spc-addendum.md` | `Singularity_Tool2_BVI_SPC_Addendum.md` |
| `spec/jev-integration-proposal.md` | `Singularity_Tool2_Jev_Integration_Proposal.md` |
| `spec/architecture-and-lifecycle.html` | `Singularity_Tool2_Architecture_and_Lifecycle.html` |
| `spec/build-plan-drafting-to-submission.md` | `Singularity_Tool2_Build_Plan_Drafting_to_Submission.md` |

From now on, this repository is the place to edit them. The project copies are snapshots.

## Platform-wide documents

The specs cite IDs from four platform-wide documents that are kept out of this repository: the agent requirements spec (DP-, GR-, RQ-, LRA- and SVC- IDs), the ops console spec (principles P1 to P7), the platform build brief (A1 to A12, B1 to B10) and the tools market research brief v2. They live in the "Singularity Markets" Claude project.
