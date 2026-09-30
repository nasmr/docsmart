# Open-source libraries for the state machine and template library

Research note, September 2026. Licences and project activity change; re-check before committing to any of these.

## Document state machine

Three separate needs: a declarative transition table with guards (the invariants), durable waiting over days (counsel SLAs, signature collection), and an immutable record of every transition.

| Need | Candidate | Licence | Notes |
|---|---|---|---|
| Transitions, guards, generated path tests | **XState v5** | MIT | Zero dependencies; persists and restores actor snapshots; ships graph-traversal and model-based testing utilities. v6 is in alpha with API changes, so pin v5. |
| Durable execution (counsel slice onward) | **Temporal** | MIT | Mature; self-hosts on Postgres; a separate server to run. A public reference project pairs Temporal with XState for an e-signature workflow. |
| Durable execution (lighter option) | **DBOS** | MIT | A library that checkpoints to your own Postgres, so workflow state never leaves your database. Simpler story for the privilege partition. |
| Immutable transition log | **immudb 1.11** | Apache-2.0 | Tamper-evident storage with verification functions callable in SQL over the Postgres wire protocol. |

Not recommended:
- **Camunda 8 / Zeebe.** The source is available under the Camunda License, but production use needs a paid licence.
- **Restate.** The server is BSL-licensed; only the SDKs are MIT.

Durable execution isn't needed in the first build slice, which has no multi-day waits. It becomes relevant when counsel orders and signatures arrive.

## Template library

| Need | Candidate | Licence | Notes |
|---|---|---|---|
| Clause text, typed slot schema | **Accord Project** (TemplateMark, Concerto, template engine) | Apache-2.0 | Template stack reached stable 1.0 in Q2 2026. Markdown-native, so Word import and export is our own code. The project's roadmap has shifted towards agent payment protocols; the core template engine is stable. |
| Rendering Word documents | **docxtemplater** (core) or **docxtpl** (Python) | MIT (core) | docxtemplater's HTML, image and several other modules are paid. |
| Native Word redlines | **Python-Redlines**, **docx-revisions**, **docx-editor**, **docx-redline-js** | MIT | Young projects; expect to maintain a fork. Needed in the counsel slice, not the first slice. |
| Guided interviews | **docassemble** | MIT | A full application; useful as a reference for Word-template conventions, too opinionated to embed. |

## Implication for the build plan

The build plan recommends its own clause-tree format with stable clause IDs as the canonical template format, with Word as the import and export format, because checks, diffs and the cross-portfolio match need stable IDs. Milestone M0 includes a one-week spike to test whether Accord's TemplateMark can serve as the canonical format instead.

## Sources

- XState: https://stately.ai/docs/xstate and https://stately.ai/blog/2023-12-01-xstate-v5
- Temporal and XState e-signature example: https://github.com/Devessier/temporal-electronic-signature
- DBOS vs Temporal: https://docs.dbos.dev/explanations/comparing-temporal
- Camunda licensing: https://docs.camunda.io/docs/reference/licenses/
- immudb 1.11: https://github.com/codenotary/immudb/releases
- Accord Project Q2 2026 review: https://accordproject.org/news/accord-project-tech-working-group-q2-2026-in-review/
- docxtemplater FAQ: https://docxtemplater.com/faq/
- Python-Redlines: https://github.com/JSv4/Python-Redlines
- docx-revisions: https://github.com/balalofernandez/docx-revisions
- docx-editor: https://github.com/pablospe/docx-editor
- docx-redline-js: https://github.com/AnsonLai/docx-redline-js
- docassemble: https://docassemble.org/
