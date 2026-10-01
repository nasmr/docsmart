# Singularity — Tool 2 Build Plan: Drafting → Assembled → Ready for Submission
### What to build first, and in what order

**Version:** 0.2 · 1 October 2026 (draft for founder and engineering review)
**Changes in 0.2:** the canonical template format is decided (decision 0008, after the M0 spike and its validation in `spikes/template-format/`). §3 (B2, B3, B5), §5, §6, §7 and §9 are updated to match.
**Builds on:** `Singularity_Tool2_Document_Factory_Spec_and_Plan.md` (§5 data model and state machine, §6.1–6.3, §6.6), `Singularity_Tool2_BVI_SPC_Addendum.md` (umbrella/portfolio model, INV-9 to INV-12), `Singularity_Tool2_Jev_Integration_Proposal.md` (optional judgment layer)
**Status:** Implementation plan. Technical choices marked **[decide in M0]** are recommendations to confirm in the first two weeks.

---

## 1. Summary

This slice covers the first half of the document lifecycle: a sponsor sets up the umbrella and a portfolio, starts a document, the system assembles it from an approved template and the sponsor's records, checks it, the sponsor reviews it, and the document reaches a frozen **ready for submission** version that counsel can pick up.

It stops before anything involving a lawyer's order, fees, clearance or signature. Those come in the next slice (the validation marketplace and counsel review room).

| | |
|---|---|
| **Outcome** | A sponsor can take a BVI SPC portfolio from set-up to three submission-ready documents: creation resolution (D12), portfolio supplement (D13) and investor subscription agreements (D1-SP). |
| **Sequence** | Foundations → a document with no AI → checks and the submission gate → composed and repeated documents → AI-drafted sections → hardening. The AI is added last on purpose, because the spec requires the workflow to run without it (DF-52). |
| **Duration** | About 15 weeks with the team in §8. Weeks 1–10 give a usable product without AI; weeks 11–15 add AI drafting and hardening. |
| **Exit test** | A design-partner sponsor prepares Atlas-style documents for a real portfolio with their own counsel's templates, and counsel confirms the submission packages are complete and correctly designated. |

## 2. Scope

### 2.1 In scope

- Umbrella and portfolio records (the SPC and its SPs), portfolio terms, assets, and references to investors in the shared identity module.
- Template import, structure review, approval record and selection rules.
- Deterministic assembly: slot filling, the locked contracting-party wording, composition of umbrella and portfolio documents.
- Deterministic checks: missing slots, cross-references, defined terms, contracting-party wording, references to other portfolios.
- AI drafting in marked sections only, with guardrail checks and source checks.
- The sponsor's review: provenance display, checks panel, comments, re-drafts as new versions.
- The submission gate and the frozen submission package.
- Audit logging and re-derivation for everything above.

### 2.2 Out of scope for this slice

Counsel orders, fees and matching (DF-30 to DF-34); clearance and amendment (DF-35 to DF-37); signatures (DF-40 to DF-42); extraction (LRA-07, DF-43, DF-44); notices (D4/D5); side letters and MFN checks (D2, DF-22); allocation runs (DF-65). The data model is designed so these attach without rework.

### 2.3 States covered, and one proposed change

The base spec goes straight from `ASSEMBLED` to `SUBMITTED` when the sponsor finishes self-review. This plan adds an explicit **`READY_FOR_SUBMISSION`** state between them, for two reasons: the marketplace that creates `SUBMITTED` isn't built yet, and it gives the sponsor a frozen package to hand to counsel outside the platform in the meantime.

```
             assemble                 pass submission gate            order placed (next slice)
 DRAFTING ─────────────▶ ASSEMBLED ─────────────────────────▶ READY_FOR_SUBMISSION ─────────────▶ SUBMITTED
    ▲                     │  ▲                                     │
    │ inputs changed      │  │ re-draft / new inputs               │ any change: new version,
    └─────────────────────┘  └── (new DraftVersion, stays ──────── ┘ back to ASSEMBLED
                                   ASSEMBLED)
 withdraw from any state → WITHDRAWN
```

| State | Means | Enters when | Leaves when |
|---|---|---|---|
| `DRAFTING` | The document exists; inputs are being gathered. | Sponsor creates a document of a class, scope and portfolio. | Assembly succeeds. |
| `ASSEMBLED` | At least one immutable `DraftVersion` exists and has been checked. The sponsor is reviewing. | First successful assembly. Re-drafts create new versions and stay here. | The sponsor passes the submission gate on the current version, or inputs change enough to need re-assembly. |
| `READY_FOR_SUBMISSION` | One specific version is frozen with its checks, decisions and provenance as a submission package. | The submission gate passes (§4). | An order is placed (next slice), or the sponsor makes any change, which creates a new version back in `ASSEMBLED`. |

## 3. What needs to be built

Ten building blocks. The sequence in §5 says when each is built; some are built in thin form early and filled out later.

### B1. Platform foundations (minimal shared services)

The four shared services from the agent spec, in the thinnest form this slice needs:

- **Audit log (SVC-LOG):** append-only table; every state change, version, check result, decision and AI call written with actor, time and versions (GR-6). Can move to immudb later behind the same interface.
- **Evidence store (SVC-EVID):** content-addressed storage for templates, uploaded source documents and generated versions (SHA-256 key, object storage, metadata row).
- **Policy store (SVC-POLICY):** versioned configuration for template-selection rules, check severities and which checks block submission. Changed only through a reviewed change.
- **Identity reference:** a stub of the shared identity module that holds party records and consent grants, enough for D1-SP. The real module replaces it later.

*Done when:* every other block writes through these; nothing writes audit rows directly.

### B2. Data model

From the addendum §3 and base spec §5.1, only what this slice uses:

| Entity | Key point for this slice |
|---|---|
| `Umbrella` | Legal name, directors and signatories, fund category ref, constitutional document refs. |
| `Portfolio` | Name, share class, status, terms and asset refs. |
| `PortfolioTerms` | Versioned; the slot source for D12, D13 and D1-SP. |
| `Asset` | Includes acquisition source; `gp_sourced` adds required slots for the conflict section. |
| `Party`, `Role`, `ConsentGrant` | Via the identity stub; roles and consent scoped to a portfolio (INV-14). |
| `Template`, `TemplateVersion`, `Clause`, `SlotSchema`, `ZoneMap` | Stored as the clause tree (decision 0008), in which every block has a stable id. Content-addressed; only approved versions selectable. Slot types come from the field catalogue. |
| `DocumentInstance` | Class, scope (`umbrella` or `portfolio`), portfolio id, state. |
| `DraftVersion` | Immutable (INV-3): content hash, slot snapshot, zone provenance, parent version, template version, referenced document hashes. |
| `Finding`, `Disposition` | Check results and the sponsor's decision on each, with reason. |
| `SubmissionPackage` | Frozen version hash, all findings and dispositions, provenance summary, referenced umbrella/supplement hashes. |

*Done when:* the schema and migrations exist, INV-3 is enforced at the database level (no updates to `DraftVersion` rows), and every entity has an audit trail.

### B3. Template library

- **Import:** take a firm's Word master (the BVI counsel set: U3, D12, D13, D1-SP schedule) and turn it into the clause tree (decision 0008): blocks with stable ids, conditions and loops around blocks, inline text or table rows, and fields as named slots. Detect candidate slots and free-text zones. Slot types come from the field catalogue (`templates/fields/catalogue.json`), so a template can use only the fields the catalogue defines.
- **Word features:** the importer reads automatic numbering, heading styles and tracked changes. Firms' masters use all three; the first-pass templates don't yet.
- **Import rules:** a template is data, never code (DP-3). An import fails, naming the place, unless all of these hold:
  - every condition and loop filter is a field path, optionally `= value` for an enum, optionally a leading `any` for a test over a list
  - every field path is in the field catalogue, and every enum value is one the catalogue lists for that field
  - every loop variable is used only inside the loop that binds it
  - the locked contracting-party wording equals the wording generated from the umbrella and portfolio records (INV-9)
- **Clause ids across edits:** each block's id travels in Word as a hidden bookmark and is read back on import. A block that comes back without its bookmark is matched against the previous version by its text. Ids therefore survive counsel's rewording, inserting, deleting, moving and pasting, and findings, decisions and diffs stay attached to the right clause.
- **Structure review screen:** counsel or the platform's counsel of record confirms the parsed structure, slot types and which sections the AI may draft in.
- **Approval record:** named approving lawyer, jurisdictions, document class, date, superseded version (DF-P2). In this slice this is a simple approval action; it moves onto the shared review queue in the next slice.
- **Selection rules:** jurisdiction × entity type × document class × scope → one approved template version (in SVC-POLICY).

*Done when:* the three first templates are imported, reviewed and approved; selection picks the right one every time in tests; a template that breaks an import rule is rejected; and re-importing an edited master keeps the id of every clause that is still there.

### B4. Sponsor data entry

Forms for the umbrella, a portfolio and its terms, the asset, and (for D1-SP) the investors and their allocations. Field types come from the slot schemas, so a template can't ask for something the forms don't capture. Allocations are typed in for now; the allocation engine (DF-65) replaces this later.

*Done when:* a sponsor can enter everything the three first templates need, with validation messages that name the missing item.

### B5. Assembly engine

- **Slot filling:** deterministic, typed, with formatting rules per slot type (currency, dates, percentages, share counts).
- **Contracting-party wording:** generated from the umbrella and portfolio records, locked in every template that needs it (DF-P10, DF-62). The wording itself comes from BVI counsel (addendum 13.11).
- **Composition:** D1-SP is assembled from the frozen umbrella terms (U3), the frozen portfolio supplement (D13) and a per-investor schedule (addendum §4.2).
- **Batch assembly:** one D1-SP per investor for a portfolio, all from the same template and supplement version.
- **Conditions and loops:** decided from records by a fixed evaluator that accepts only the forms the import rules allow (B3). Nothing written in a template is executed.
- **Rendering:** canonical structured content (for checks and diffs) plus a DOCX and PDF rendering for people to read. The hash is taken over the canonical content. The Word renderer works from the canonical content (decision 0006) and writes each block's id as a hidden bookmark (decision 0008).

*Done when:* the same inputs always produce byte-identical canonical content, and a slot-only document (D12) assembles with no AI involved.

### B6. Checks engine (deterministic)

| Check | Severity | Source |
|---|---|---|
| Required slot missing or wrong type | Blocks | DF-20 |
| Broken internal cross-reference | Blocks | DF-20 |
| Defined term used but not defined, or defined but unused | Review | DF-20 |
| Contracting-party wording missing or not matching the registry | Blocks | INV-9 |
| Mentions another portfolio's name, share class, asset, investors or figures | Blocks | INV-10 |
| Template version retired since assembly | Review | DF-03 |
| Referenced umbrella or supplement version not in the required state | Blocks | Addendum §4.2 |
| Jurisdiction flag from the template's applicability list | Review | DF-20 |

Severities live in SVC-POLICY so counsel can tighten them without a code change. The cross-portfolio check matches against every other portfolio under the same umbrella, including near-duplicate names.

*Done when:* each check has seeded positive and negative test documents and none is ever skipped silently.

### B7. Sponsor review workspace

The screens from the portal design, made real:

- **Document view** with the three provenance styles (from records, written by the AI, approved template text), the locked contracting-party strip and the "not legal advice" banner, rendered by the platform, not the AI.
- **Checks panel:** each finding with its location, why it matters, and actions. Blocking findings can only be fixed; review findings need a decision (fix or keep, with a reason).
- **Comments and re-drafts:** the sponsor can't edit AI-drafted sections directly (DF-24). A comment either triggers a re-draft or is carried to counsel as an instruction.
- **Version history** with a clause-level diff between any two versions.
- **Submission gate screen:** the gate checklist (§4) with what's still missing, and the action to mark the version ready.

*Done when:* a design-partner sponsor can go from a new document to ready for submission without help, measured in a moderated session.

### B8. AI drafting (marked sections only)

- **Drafting service:** writes only in zones the approved template marks as AI-draftable, from facts the sponsor supplies and approved clauses; never touches slots, the contracting-party wording or template text.
- **Guardrail checks (GR-3):** every drafted section is screened for legal conclusions, return or liquidity promises, eligibility statements and advice to a party, before it's stored. Blocked text is logged, never shown.
- **Source checks (GR-1):** every factual statement in a drafted section must point to an uploaded source. Quotes are matched in code; whether the source supports the statement is checked by a second model. Unsupported statements become review findings, as in the portal design.
- **Model interface:** one internal interface for "draft this zone" and "judge this claim", so Jev can be adopted later (Jev proposal §4) without changing callers. All calls log model version, prompt version and inputs.
- **Switch-off:** with the AI switched off, zones stay empty and are flagged for the sponsor or counsel to write; everything else keeps working (DF-52).

*Done when:* the D13 project description and risk-factor sections draft from a sponsor's facts, the guardrail and source-check evaluation sets pass (§6), and switching the AI off leaves the workflow usable.

### B9. Submission gate and package

The gate runs the checks in §4 on one version. If they all pass, it freezes a `SubmissionPackage` and moves the document to `READY_FOR_SUBMISSION`. The package can be downloaded (PDF, DOCX and a checks report) for counsel outside the platform until the marketplace exists.

*Done when:* no version can reach `READY_FOR_SUBMISSION` with an open blocking finding, in tests or in the audit log.

### B10. Audit, re-derivation and tests

- Re-derivation: any version can be rebuilt from its logged template version, slot snapshot and AI call records, and diffed against the original (DF-51).
- Test suites: invariant tests (§6), golden documents per template, check test sets, AI evaluation sets.
- A quarterly switch-off drill from week 13 (DF-NFR-4).

## 4. The submission gate

A version passes only if all of these hold. Each failed condition is shown to the sponsor in plain words.

1. It was assembled from a template version that is approved and not retired.
2. Every required slot is filled from records and valid for its type.
3. The contracting-party wording matches the registry for its portfolio (INV-9).
4. It contains nothing belonging to another portfolio (INV-10).
5. No blocking finding is open.
6. Every review finding has the sponsor's decision and reason.
7. Every AI-drafted section has passed the guardrail check, and every statement in it either passed the source check or was kept by the sponsor with a reason that counsel will see.
8. For D1-SP, the umbrella terms and portfolio supplement it is built on are in the required state and their hashes are recorded in the package.
9. It is the latest version of the document.

Passing the gate is recorded with the sponsor's identity and the version hash. Any later change creates a new version and the document returns to `ASSEMBLED`.

## 5. Build sequence

Six milestones. Each ends with a demo on real design-partner data.

```
 M0 Decisions & fixtures ─▶ M1 First document, no AI ─▶ M2 Checks & gate ─▶ M3 Composed & batch docs ─▶ M4 AI sections ─▶ M5 Hardening
   wk 1–2                     wk 3–5                      wk 6–7               wk 8–10                      wk 11–13          wk 14–15
   B1 thin, B3 spike          B1, B2, B3, B4, B5 (D12)    B6, B7, B9           B5 composition, B7, B4        B8               B10, usability
```

| Milestone | Weeks | Build | Demo at the end |
|---|---|---|---|
| **M0 Decisions and fixtures** | 1–2 | Confirm stack (§7). One-week spike on the template format: done on the nine first-pass templates, and decided in 0008. Collect the design partner's U3, D12, D13 and D1-SP masters and one executed portfolio set as test fixtures, then repeat the spike's import and clause-id checks on those masters. Confirm in real Word that bookmarks survive counsel's edits; the spike only simulated the edits. Agree check severities with counsel. Thin B1. | Template spike result and the decisions record. |
| **M1 First document, no AI** | 3–5 | Data model (B2); template import, review and approval (B3) for D12, with the import rules, the Word features and clause ids as bookmarks; the first-pass template generator moved to Word heading styles and automatic numbering, and the D12-C loop mistake fixed, so those templates pass the same import as a firm's master; umbrella and portfolio forms (B4); assembly with slot filling and locked contracting-party wording (B5); document view with provenance (B7, read-only). | Sponsor creates Lumen SP and assembles its creation resolution. Re-running assembly gives the same hash. |
| **M2 Checks and submission gate** | 6–7 | Checks engine (B6); checks panel and decisions (B7); version history and diff; submission gate and package (B9). | A seeded mistake (another portfolio's name in D12) blocks submission; after the fix, the document reaches ready for submission and the package downloads. |
| **M3 Composed and repeated documents** | 8–10 | Import and approve D13 and D1-SP templates; asset and investor data entry; composition of D1-SP from frozen U3 and D13; batch assembly for all investors in a portfolio; the D13 conflict section for sponsor-supplied assets. | 41 subscription agreements for Atlas SP assembled from one supplement; each shows its own investor schedule and the same frozen references. |
| **M4 AI-drafted sections** | 11–13 | Drafting service, guardrail checks and source checks (B8); comments and re-drafts; switch-off behaviour. | D13 project description and risk factors drafted from the sponsor's facts; an unsupported claim is flagged; switching the AI off still lets the sponsor reach ready for submission. |
| **M5 Hardening** | 14–15 | Re-derivation, full test suites, first switch-off drill, performance targets (assembly under 60 s p95), moderated sessions with the design-partner sponsor and their counsel. | Exit test in §1. |

**Why this order.** D12 is slot-only, so M1 proves the foundations with no AI and no composition. The checks and gate come next (M2) because they are the product's core control, and every later document goes through them. D1-SP comes before AI drafting (M3) because it's the highest-volume document and needs no AI at all. AI drafting (M4) is last because it's the riskiest part and the only part the spec says the workflow must survive without.

**What can run in parallel.** Front-end work on B7 starts in M1 against the API contract. AI evaluation sets (§6) are built during M2–M3 so M4 starts with them ready. If the Jev spike (Jev proposal §7, Phase A) is approved, it runs alongside M2–M3 using the same fixtures.

## 6. Testing and acceptance

| Test | What it proves | From |
|---|---|---|
| Invariant tests | No `DraftVersion` update is possible (INV-3); no document without correct contracting-party wording reaches ready (INV-9); no cross-portfolio reference reaches ready (INV-10); no open blocking finding reaches ready. Enforced at the API and database, not only the UI. | M1–M2 |
| Golden documents | Each template with fixed inputs produces the same canonical content and hash every time. | M1 onward |
| Template import tests | Templates that break an import rule are rejected: a condition outside the allowed forms, a field not in the catalogue, a loop variable used outside its loop, edited contracting-party wording. Clause ids survive a round trip through Word and each kind of counsel edit. | M1 onward |
| Check test sets | Per check, seeded documents that must trigger it and must not. The cross-portfolio set includes near-duplicate portfolio names and shared words. | M2 |
| Guardrail evaluation set | About 200 prompts and drafts designed to produce legal conclusions or return promises; pass = none reach storage. | Built M2–M3, run M4 |
| Source-check evaluation set | Drafted statements with known support, contradiction or no support in the source; recall on unsupported statements ≥ 0.95. | Built M2–M3, run M4 |
| Injection tests | Uploaded templates and source documents containing hidden instructions; pass = none are acted on (DP-3). | M4 |
| Switch-off drill | With the AI off, D12 and D1-SP go from new to ready for submission. | M4–M5 |
| Re-derivation | Ten random historical versions rebuilt and diffed with no differences. | M5 |
| Moderated sessions | Sponsor completes the flow unaided; counsel confirms packages are complete. | M5 |

## 7. Technical choices [decide in M0]

| Area | Recommendation | Why |
|---|---|---|
| Main service language | TypeScript on Node | Matches the template and state-machine libraries found in the earlier research, and the front end. |
| Database | PostgreSQL | Relational model with strict immutability rules; row-level tenancy. |
| State machine | XState v5 (pinned) inside the service | Declarative transitions and guards, with generated path tests for the invariants. Durable waiting (Temporal or DBOS) isn't needed until the counsel slice introduces multi-day waits. |
| Canonical template format | **Decided (0008).** Own clause-tree JSON with a stable id on every block. Slot types come from the field catalogue as Zod schemas. Word stays the import and export format. Accord TemplateMark and Concerto are not adopted. | Checks, diffs and the cross-portfolio match need stable ids on every block, which neither Word nor TemplateMark provides. The M0 spike found that TemplateMark can express the two templates ported to it without code, but it has no Word import or export, and it prints wrong text with no error in several cases. |
| DOCX rendering | **Decided (0006).** The `docx` library, rendering from the canonical content. | What people read is exactly what was checked and hashed. The renderer also carries the clause ids into Word as bookmarks (0008). |
| AI drafting | A generative model behind the internal model interface (B8), with zero data retention and no training on customer data | Keeps the Jev option open and meets the data-handling conditions in the Jev proposal §5. |
| Front end | The portal design canvas as the visual reference; component library chosen by the front-end engineer | The design is exploratory; build to its structure, not pixel-exact. |

## 8. Team and effort

| Role | FTE | Main blocks |
|---|---|---|
| Tech lead / backend | 1 | B1, B2, B5, B9 |
| Backend engineer | 1 | B3, B6, B10 |
| Front-end engineer | 1 | B4, B7 |
| ML/LLM engineer | 0.5 in M2–M3, 1 in M4–M5 | Evaluation sets, B8 |
| Product designer | 0.5 | B7 flows, moderated sessions |
| Product lead | 0.5 | Design partner, M0 decisions, acceptance |
| BVI counsel | About 2–3 days per milestone | Template review and approval, check severities, contracting-party wording, package review |

Counsel time is the scarcest input. Book it for M0, M1 (D12 approval), M3 (D13 and D1-SP approval) and M5.

## 9. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| BVI counsel answers (addendum §9, especially 13.11 on contracting-party wording) arrive late | Templates can't be approved; M1 slips | Raise them in week 1. Build against a clearly labelled placeholder wording, and block anything leaving the platform until counsel confirms it. |
| Firm templates parse badly | Import and review take much longer than planned | The M0 spike imported only our own first-pass templates. Test the importer on the design partner's masters as soon as they arrive. Build automatic numbering, heading styles and tracked changes into the importer in M1. Accept manual clause marking in the review screen for the first templates. |
| Clause ids don't survive real editing in Word (bookmarks lost, split or duplicated on cut and paste) | Findings, decisions and diffs attach to the wrong clause or to none | Test with real Word editing in M0. Matching against the previous version by text is the fallback when a bookmark is lost; tune its threshold on real edits. Show unmatched clauses in the structure review screen for counsel to confirm. |
| Cross-portfolio check produces too many false positives (shared words, similar names) | Sponsors learn to ignore it | Match on registry identifiers and exact names first; tune with counsel on the test set; keep it blocking, but make the reason clear. |
| AI drafting quality is poor on fund documents | M4 needs more time | M4 is last and optional for the first release; the product is usable after M3. |
| Scope creep into the counsel slice | Dates slip | The submission package is the handoff; anything needing a lawyer's action waits for the next slice. |

## 10. Decisions needed now

1. **Confirm the added `READY_FOR_SUBMISSION` state** (§2.3), which changes the base spec's state machine.
2. **Which design-partner portfolio to build against**, and permission to use its templates and documents as test fixtures.
3. **The first three document types**: D12, D13 and D1-SP are recommended. Swap if a different document is more urgent for the partner.
4. **Whether the first release includes AI drafting (M4)**, or ships after M3 with AI added in a later release.
5. **Engineering team**: confirm the stack in §7, and whether this team or a separate one builds the shared services in B1.

---

*This plan is a product and engineering planning document, not legal advice. Items that depend on BVI law or regulation follow the questions for counsel in the BVI SPC addendum §9 and must be confirmed before documents leave the platform.*
