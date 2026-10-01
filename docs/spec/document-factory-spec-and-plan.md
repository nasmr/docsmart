# Singularity — Tool 2: Counsel-in-the-Loop Fund Document Factory
### System Specification & Implementation Plan (the "legal-in-the-loop document library")

**Version:** 0.1 · September 2026 (draft for founder, engineering, and counsel review)
**Source:** `Singularity_Tools_Market_Research_Brief_v2_AllGPs.md` §3 Tool 2, §5 sequencing (Phase 0a, months 0–6, parallel with Tool 1)
**Companion documents:** `Singularity_AI_Agent_Requirements_Spec.md` (LRA §5, DP-1..4, GR-1..8, RQ-1..6, SVC-* services), `Singularity_Ops_Console_UI_Spec.md` (P1–P7, §8 queue grammar, §10 components), `Singularity_Platform_Build_Brief.md` (A4, A10, A12, B1)
**Status:** Product and engineering specification. It is not legal advice. Every statement about unauthorised practice of law, privilege, fee arrangements, e-signature validity, or data protection is a design assumption that qualified counsel must confirm or overturn **before** the corresponding component is built (see §13).

---

## 0. Scope of this document

This document turns the Tool 2 proposal into something engineering can estimate and counsel can review. It covers:

1. What the product is and is not, and who its five user types are (§1–2)
2. The document catalogue and the release in which each document class ships (§3)
3. System architecture, the deterministic/LLM split, and the data model (§4–5)
4. Functional requirements with authority tiers and human gates, using the LRA numbering where the function already exists (§6)
5. Counsel-network operations — the services business inside the software (§7)
6. Agent behaviour, UX surfaces, integrations, security and privilege (§8–11)
7. Non-functional requirements, legal preconditions, acceptance criteria (§12–14)
8. A six-month implementation plan with phase gates, team, dependencies and risks (§15)

Out of scope: fund administration, LP portals, SPV formation (Brief v2 §1 — contested centres Singularity does not build), and any user-facing legal Q&A surface (Agent Spec §5.2).

---

## 1. Product definition

### 1.1 One paragraph

The Document Factory is a **document-lifecycle workflow layer** for sub-enterprise GPs. It assembles first drafts of recurring fund documents from counsel-approved, versioned templates and a canonical fund data model; routes every draft through a **hard counsel gate** in which a qualified lawyer validates, amends and clears it; executes the cleared document by e-signature with LPs and counterparties on-platform; and, at execution, extracts the obligations and register changes the document creates and emits them to Tools 1, 3 and 5. A curated network of fund-formation lawyers performs validation at fixed, published fees. The GP's own counsel can use the same workflow if they prefer.

### 1.2 What it is not

| It is not | Because | Consequence for design |
|---|---|---|
| A legal-advice product | Agent Spec §5.2 (UPL), LRA-P0 | No user-facing legal Q&A; every draft is labelled and cannot be executed unless a lawyer clears it |
| A template shop | Template vendors already exist with no validation loop (Brief v2 §3) | Templates are never downloadable as finished documents; the product is the loop, not the file |
| A law firm | Liability sits with the validating lawyer (Brief v2 Tool 2 cons) | Platform is a marketplace and workflow operator; engagement is lawyer ↔ GP; platform fee structure must respect fee-sharing rules (§13) |
| A general-purpose contract AI | Harvey/Robin are law-firm-facing and horizontal | Bounded document classes, bounded templates, bounded jurisdictions — the agent operates only within them |
| A place where documents get edited freely | "Edit-after-clearance made structurally impossible" (Agent Spec L-LRA-C) | Cleared documents are immutable; any change is a new version that re-enters the gate |

### 1.3 Value proposition by buyer

| Buyer | Pain today | What Tool 2 replaces | Price anchor |
|---|---|---|---|
| Emerging GP (Fund I–III, $10M–$150M) | $50K–$150K formation bill; $5K–$15K per side letter; weeks of turnaround | Bespoke drafting of routine documents; unstructured email review loops | Platform $300–$800/mo; per-document $100–$500; validation fee at counsel's fixed rate |
| Independent sponsor / SPV organizer | Many small vehicles, same documents each time, no in-house legal | Re-papering each vehicle from scratch | Volume tier; per-vehicle template cloning |
| Law firm with emerging-manager practice | Low-margin routine work; associates redlining sub docs | Manual first drafts; version-control chaos | Firm seat licence; throughput on fixed-fee matters |
| Fund administrator (channel) | Clients arrive with inconsistent, unexecuted documents | Chasing signatures and side-letter terms | Referral / integration partner terms |
| LP / counterparty (signatory) | PDF-and-email signing; no record of what they agreed to | Email chains | Free; creates the demand-side account |

---

## 2. Governing principles (inherited and new)

Inherited verbatim from the Agent Spec: **DP-1** deterministic-first, **DP-3** untrusted input boundary, **DP-4** self-modification prohibition, **GR-1** evidence-or-silence, **GR-3** hard-coded refusal triggers, **GR-6** versioning, **GR-7** standing eval suite, **GR-8** degradation to L0, **LRA-P0** never legal advice, **RQ-1..6** review quality controls. DP-2 (no key custody) is inherited in spirit: no agent ever holds e-signature credentials or triggers a signature.

New, specific to Tool 2:

> **DF-P1 — The counsel gate is a hard gate.** No document reaches "Cleared", "Out for signature", or "Executed" without a clearance event by a human whose lawyer credential has been verified and whose admission covers the document's governing-law jurisdiction. This is enforced in the state machine and the API, not in the UI. There is no admin override. (Mirrors LRA-06's launch gate: "cannot be overridden by product urgency, only by counsel.")

> **DF-P2 — Templates carry provenance or they do not exist.** Every template version records who approved it (a named lawyer), for which jurisdictions and fund types, on what date, superseding which version. Unapproved templates cannot be selected for assembly. Template approval is itself a queue item with the standard grammar.

> **DF-P3 — Slots are deterministic; prose is drafted; nothing is decided.** Names, dates, amounts, percentages, thresholds, defined-term cross-references and jurisdiction flags are filled by code from the fund data model. The LLM drafts only in designated free-text zones (recitals, bespoke side-letter provisions, cover notes) and every drafted zone is visibly marked agent-provenance until counsel clears it. Whether a provision is appropriate is never the agent's call.

> **DF-P4 — Cleared means frozen.** A cleared document version is content-addressed (hash) and immutable. Signature envelopes reference the hash. Any edit produces a new draft version that re-enters the gate at "Submitted to counsel". Comparison to the previously cleared version is automatic.

> **DF-P5 — Execution creates structured facts, not just a PDF.** Every executed document emits typed events: obligations (side letters, MFN), register changes (subscriptions, transfers), consents (LPAC), parameters (LPA economics for Tool 4). The PDF is evidence; the structured record is the product's downstream value.

> **DF-P6 — Consent before network.** Every LP, counterparty or lawyer account created by Tool 2 carries per-purpose consent flags from creation (Brief v2 §5 consent architecture). Default is "this vehicle's documents only." Nothing downstream — Tool 3 transferee matching, any future marketplace — may read an account without the matching consent flag. This is a data-model decision in Phase A, not a policy document later.

> **DF-P7 — Privilege is a partition, not a setting.** Work product commissioned by counsel lives in a separately-permissioned partition whose boundary counsel defines (Agent Spec §5.2). Crossing the boundary is an explicit, logged act. Platform staff cannot read partitioned content in the ordinary course.

---

## 3. Document catalogue

Each class lists: template source in v1, input model, whether the agent may draft free-text zones, the minimum clearance role, and the downstream consumer. "Release" indicates the phase in §15.

| # | Document class | Template source (v1) | Structured inputs | Agent free-text zones | Clearance | Downstream events | Release |
|---|---|---|---|---|---|---|---|
| D1 | Subscription agreement + investor questionnaire | Platform library (per jurisdiction × entity type) or firm library | Vehicle terms, LP identity & eligibility (shared identity module), commitment | Cover note only | Counsel (batch-clearable per LP where the template is unchanged) | `register.subscription.recorded` → Tool 3 register; eligibility data → identity module | R1 |
| D2 | Side letter | Platform clause library + firm clauses | LP, requested provisions (clause picks), MFN election status | Bespoke provision drafting | Counsel, per document | `obligation.created[]` → Tool 5; `mfn.compendium.updated` | R1 |
| D3 | MFN compendium / election notice | Generated from D2 obligations | All executed side letters in the vehicle | Cover note | Counsel | `mfn.election.window.opened` → LP notices | R2 |
| D4 | Capital-call notice | Platform template | SVC-CALC output (Tool 4) or GP-entered amounts with reconciliation flag | None | GP (L3, no counsel) unless template changed | `notice.issued` → Tool 1 cash-flow classification | R1 |
| D5 | Distribution notice | Platform template | SVC-CALC output (Tool 4) | None | GP (L3) unless template changed | `notice.issued` → Tool 1 | R1 |
| D6 | LPAC consent / resolution | Platform template | Matter description, conflicted parties, vote threshold | Matter summary (drafted from GP input) | Counsel for novel matters; GP (L3) for template-conforming routine consents | `consent.recorded` → Tool 3 & Tool 5 | R2 |
| D7 | Transfer instrument (assignment & assumption, GP consent) | Platform template per jurisdiction | Transferor, transferee (identity module), interest, LPA transfer-restriction check (LRA-07 extraction) | None | Counsel | `register.transfer.recorded` → Tool 3 | R2 |
| D8 | LPA — amendment | Firm's executed LPA as base | Amendment scope, affected sections | Amendment drafting | Counsel | `lpa.parameters.changed` → Tool 4 | R2 |
| D9 | LPA / PPM — first draft from term sheet | Platform master forms (per jurisdiction) or firm masters | Term sheet (economics, governance, jurisdiction, regulatory wrapper) | Recitals, business description, risk factors from GP-supplied facts | Counsel, mandatory, per document, with dwell-time floor | `lpa.parameters.encoded` → Tool 4 | R3 |
| D10 | Continuation-vehicle election materials (ILPA-aligned) | Platform template pack | Election options, timelines (20-business-day window), fairness opinion reference, conflicts disclosure | Conflicts-disclosure narrative from GP facts | Counsel, mandatory | `election.window.opened` → Tool 3 | R3 (with Tool 3) |
| D11 | Board / manager resolutions, incumbency, officer's certificates | Platform template | Entity data, resolution matter | Matter description | GP (L3) for routine; counsel for novel | Archive | R2 |

**Jurisdictions in v1:** Delaware (LP / LLC), Cayman (ELP / LLC). **v1.5:** BVI, Luxembourg (SCSp), Singapore (VCC / LP), England & Wales (LP). Each jurisdiction is added only when (a) a counsel of record has approved the template set and (b) the UPL and privilege position for that jurisdiction is documented (§13).

**Fund types in v1:** closed-end VC/PE, SPV/single-asset vehicle. **v1.5:** real-estate syndication, private credit, search fund, continuation vehicle.

---

## 4. System architecture

### 4.1 Component map

```
 GP Workspace        Counsel Review Room       Signatory Portal        Ops Console (A10)
 (web)               (web, external role)      (web/mobile, external)  (internal)
     │                      │                        │                     │
     └──────────────────────┴────────────┬───────────┴─────────────────────┘
                                         │  API gateway · RBAC · tenant isolation
 ┌───────────────────────────────────────┼─────────────────────────────────────────┐
 │  DOCUMENT FACTORY SERVICES            │                                          │
 │                                       ▼                                          │
 │  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐  ┌────────────┐ │
 │  │ Template     │  │ Fund Data Model  │  │ Assembly Engine    │  │ Findings   │ │
 │  │ Library      │─▶│ (vehicle, party, │─▶│ (deterministic     │─▶│ Engine     │ │
 │  │ (versioned,  │  │  terms, identity │  │  slot-fill + LLM   │  │ (x-ref,    │ │
 │  │  approved)   │  │  refs)           │  │  free-text zones)  │  │  terms,    │ │
 │  └──────────────┘  └──────────────────┘  └────────────────────┘  │  contradict│ │
 │         │                                        │               │  deviation)│ │
 │         │                                        ▼               └─────┬──────┘ │
 │  ┌──────┴───────┐  ┌──────────────────┐  ┌────────────────────┐        │        │
 │  │ Clause       │  │ Document State   │◀─│ Counsel Validation │◀───────┘        │
 │  │ Library &    │  │ Machine          │  │ Marketplace        │                 │
 │  │ Diff Engine  │  │ (DF-P1, DF-P4)   │  │ (match, fee, SLA)  │                 │
 │  └──────────────┘  └────────┬─────────┘  └────────────────────┘                 │
 │                             │                                                    │
 │  ┌──────────────────┐  ┌────▼─────────────┐  ┌─────────────────────────────┐    │
 │  │ Obligation &     │◀─│ Execution &      │─▶│ E-signature adapter         │    │
 │  │ Register         │  │ Envelope Service │  │ (vendor-agnostic)           │    │
 │  │ Extraction       │  └──────────────────┘  └─────────────────────────────┘    │
 │  └────────┬─────────┘                                                            │
 └───────────┼──────────────────────────────────────────────────────────────────────┘
             ▼  SVC-BUS typed events
   Tool 1 (reporting)   Tool 3 (register, transfers, elections)   Tool 4 (LPA params)   Tool 5 (obligations)

 SHARED PLATFORM SERVICES (build once, Agent Spec §1.2):
   SVC-EVID  evidence store · SVC-POLICY  policy engine · SVC-QUEUE  review queue · SVC-LOG  WORM audit log
   SVC-BUS   inter-agent bus · SVC-CALC   calc service (consumed, never reimplemented) · SVC-HALT  halt bus
   Shared identity module (ex-"Eligibility Passport", Brief v2 §1): party identity, KYC status, eligibility attestations, consent flags
```

### 4.2 The deterministic / LLM split (DP-1 applied)

| Concern | Deterministic code | LLM (LRA, L1 unless stated) | Human |
|---|---|---|---|
| Which template applies | Rules: jurisdiction × entity type × document class × fund type → approved template version | — | Counsel approves the rule table |
| Slot filling (names, amounts, %, dates, thresholds) | From fund data model; type-checked; unit-tested | — | GP enters/confirms inputs |
| Defined-term consistency, cross-reference integrity | Parser over the assembled document | Explains findings in plain language | Counsel resolves |
| Internal contradiction detection | Rule checks (e.g., MFN carve-out vs. side-letter grant) | Flags candidate contradictions with evidence pointers; confidence-gated (GR-2) | Counsel decides |
| Free-text drafting (bespoke side-letter provision, recitals, conflicts narrative) | — | Drafts from GP-supplied facts and clause library; agent-provenance styling | Counsel amends/clears |
| Deviation from standard | Clause diff against approved template | Summarises deviation and its likely intent | Counsel judges acceptability |
| Obligation extraction from executed document | Structured extraction over known clause IDs | Extracts from bespoke provisions; each extraction confidence-gated and evidenced | Counsel or GP confirms extraction before it becomes an obligation of record |
| Amounts in notices (D4/D5) | SVC-CALC via Tool 4, or GP-entered with reconciliation flag | Never | GP approves |
| Clearance | State machine enforces | Never (Universal P: no agent is the final gate) | **Counsel** |
| Signature | Envelope service; vendor adapter | Never | Signatories |
| Legal question ("is this provision enforceable in Cayman?") | — | **Prohibited**; GR-3 classifier blocks; routed as a structured question to counsel | Counsel |

### 4.3 Tenancy and partitions

- **Tenant** = GP organisation. Vehicles, documents, templates (firm-private) and parties are tenant-scoped.
- **Firm tenant** = law firm using the platform for throughput; firm-private template libraries; a firm may be linked to many GP tenants via engagements.
- **Platform library** = counsel-approved master templates visible to all tenants, maintained by the platform's counsel of record.
- **Privilege partition** (DF-P7) = per-engagement sealed space; contents visible to the engaged lawyer(s) and the GP principals they designate; platform staff access requires break-glass with GC approval and is logged as a security event.
- **Party accounts** (LPs, counterparties, signatories) are global identities with per-vehicle, per-purpose consent grants (DF-P6).

---

## 5. Data model

### 5.1 Core entities

| Entity | Key fields | Notes |
|---|---|---|
| `Template` / `TemplateVersion` | id, class (D1–D11), jurisdiction[], fund_type[], entity_type[], owner (platform / firm tenant), approved_by (lawyer id), approved_at, supersedes, content (clause tree), slot schema, free-text zone map, status (draft / approved / retired) | Only `approved` versions are selectable. Approval is a SVC-QUEUE item (DF-P2). Content is content-addressed. |
| `Clause` / `ClauseVersion` | id, template_version refs, category (economic / governance / transfer / MFN / regulatory / boilerplate), text, variables, jurisdiction applicability, approved_by, risk class | Clause library is the unit of diffing and of side-letter provision selection. |
| `Vehicle` | id, tenant, legal name, jurisdiction, entity type, fund type, regulatory wrapper (e.g., 3(c)(1)/3(c)(7), Reg D 506(b)/(c), Reg S), formation status, register ref (Tool 3) | The canonical fund object shared with Tools 1, 3, 4, 5. |
| `Terms` (term sheet) | vehicle, economics (mgmt fee schedule, carry, pref, catch-up, waterfall type), governance (LPAC, key person, removal), commitments (min, GP commit), term/extensions, transfer restrictions, MFN policy | Typed, versioned; is the slot source for D9 and the encoding source for Tool 4. |
| `Party` | global id, type (individual / entity), identity ref (shared identity module), KYC status ref, eligibility attestations ref, contact | Never stores KYC documents itself; references the identity module. |
| `Role` | party, vehicle, role (GP, LP, LPAC member, transferee, signatory, counsel, administrator), consent grants[] | Consent grants are typed: `{purpose, granted_at, expires, scope}`. |
| `Engagement` | GP tenant, lawyer/firm, scope (vehicle, document classes), fee schedule ref, engagement letter hash, conflicts check result, privilege partition id, status | The lawyer–GP relationship of record. Platform is not a party to it. |
| `DocumentInstance` | id, vehicle, class, template_version, parties[], engagement, current state, current version, privilege partition | The workflow object. |
| `DraftVersion` | instance, version no., content hash, slot values snapshot, free-text zones with provenance (agent / human / clause library), findings[], diff_to_previous, diff_to_last_cleared, created_by (human or LRA with model/prompt versions per GR-6) | Immutable once created. |
| `Finding` | draft version, type (x-ref / defined term / contradiction / deviation / missing slot / jurisdiction flag), severity, location, evidence pointers (SVC-EVID), disposition, disposed_by | Findings are never "resolved" by the agent; only dispositioned by a human. |
| `ValidationOrder` | instance, engagement, lawyer, fixed fee, SLA due, status (offered / accepted / in review / amended / cleared / rejected), acceptance timestamp | The marketplace transaction. |
| `Amendment` | validation order, draft version from → to, structured reason (taxonomy + text), lawyer id | Structured reasons feed the eval suite (RQ-3, GR-7). |
| `Clearance` | instance, draft version hash, lawyer id, credential verification ref, jurisdiction admission ref, dwell time, attestation text, timestamp | The event DF-P1 requires. Written once. |
| `Envelope` | instance, cleared hash, signatories[], vendor envelope id, status, completion certificate hash | References the cleared hash; mismatch → hard fail. |
| `ExecutedDocument` | instance, envelope, final PDF hash, execution timestamp, extraction status | Evidence object in SVC-EVID. |
| `Obligation` | source executed document, clause ref, obligee, obligor, type (reporting / fee / MFN / co-invest / transfer / notice / other), trigger, frequency, confirmed_by | Emitted to Tool 5 only after human confirmation. |
| `RegisterEvent` | source executed document, type (subscription / transfer / redemption), party, interest, effective date | Emitted to Tool 3. |
| `LawyerProfile` | party, bar/roll admissions[] (jurisdiction, number, verified_at, verification evidence), practice areas, fee menu, capacity, quality metrics, insurance evidence, status | Credential verification is evidence-bound (SVC-EVID). |

### 5.2 Document state machine

```
  DRAFTING ──assemble──▶ ASSEMBLED ──GP self-review──▶ SUBMITTED ──lawyer accepts order──▶ UNDER_VALIDATION
     ▲                       │                            │                                    │
     │                       │                            │                       ┌────────────┼──────────────┐
     │                       │                            │                       ▼            ▼              ▼
     │                       │                            │                  AMENDED      CLEARED         REJECTED
     │                       │                            │                (new version,   (hash frozen,   (structured
     │                       │                            │                 auto re-enters  DF-P4)          reason; back
     │                       │                            │                 UNDER_VALIDATION)               to DRAFTING)
     │                       │                            │                                  │
     │                       │                            │                                  ▼
     │                       │                            │                            OUT_FOR_SIGNATURE ──all signed──▶ EXECUTED
     │                       │                            │                                  │                              │
     │                       │                            │                            (any edit attempt →                  ▼
     │                       │                            │                             fork to new DraftVersion,     EXTRACTING ──human confirms──▶ ARCHIVED
     │                       │                            │                             state SUBMITTED)                                     │
     └───────────────────────┴────────────────────────────┴──────────── withdraw (GP) ───────────────────────────────────────────────────────┘
```

**Amended by decision 0001 (accepted 1 October 2026):** a `READY_FOR_SUBMISSION` state sits between `ASSEMBLED` and `SUBMITTED`. A document enters it when one version passes the submission gate (build plan §4); that version is frozen as a submission package. Any change creates a new version back in `ASSEMBLED`. `SUBMITTED` is entered from `READY_FOR_SUBMISSION` when an order is placed. The diagram above predates the decision.

**Enforced invariants (API-level, tested):**

- `INV-1` No transition into `CLEARED` without a `Clearance` row whose lawyer has a verified admission matching the document's governing-law jurisdiction. (DF-P1)
- `INV-2` `Envelope.cleared_hash == DraftVersion.content_hash` of the version in `CLEARED`, else envelope creation fails. (DF-P4)
- `INV-3` A `DraftVersion` is never mutated; edits create a successor. (DF-P4)
- `INV-4` D4/D5 amounts must carry either a SVC-CALC evidence pointer or an explicit `gp_entered_unreconciled` flag that renders grey (P4) and appears in the notice's internal audit record. (DP-1)
- `INV-5` No `Obligation` or `RegisterEvent` is published to SVC-BUS without `confirmed_by` set to a human. (DF-P5)
- `INV-6` No read of a `Party` by a consumer outside the originating vehicle without a matching consent grant. (DF-P6)
- `INV-7` The proposer of a draft version (human or agent) cannot be the clearer of that version. (RQ-5)
- `INV-8` Every `Clearance` on classes D2, D7, D8, D9, D10 records dwell time ≥ the class floor set in SVC-POLICY; below-floor clearances are written but flagged as audit exceptions. (RQ-2)

---

## 6. Functional requirements

Tiers and gates follow Agent Spec §1.1. Where a function already exists in the LRA inventory, its ID is reused; new functions are `DF-xx`.

### 6.1 Templates and clause library

| ID | Requirement | Tier | Gate |
|---|---|---|---|
| DF-01 | Template ingestion: upload a firm's Word/PDF master; parse into clause tree, detect variables, propose slot schema and free-text zones | L1 | Firm lawyer / platform counsel approves the parsed structure |
| DF-02 | Template approval workflow: SVC-QUEUE item with diff to prior version, jurisdiction/fund-type applicability, approver's admission check | L3 (platform executes on approval) | Named lawyer; platform counsel of record for platform library |
| DF-03 | Template retirement and supersession; in-flight instances on a retired version are flagged, not blocked | L2 | Counsel |
| DF-04 | Clause library browse/search by category, jurisdiction, risk class; each clause shows approval provenance | L0 | — |
| DF-05 | Clause-level "deviation from standard" diff for any draft against its template version | Deterministic | — |

### 6.2 Fund data model and inputs

| ID | Requirement | Tier | Gate |
|---|---|---|---|
| DF-10 | Vehicle setup wizard: jurisdiction, entity type, fund type, regulatory wrapper → determines template eligibility | Deterministic + L1 guidance text | GP |
| DF-11 | Term-sheet capture (typed form; optional import from a PDF term sheet with LLM extraction, every field evidence-pointed and confirmed) | L1 extraction | GP confirms each extracted field |
| DF-12 | Party management via the shared identity module; KYC/eligibility status is displayed, never determined here (Universal P) | L0 | — |
| DF-13 | Consent-grant capture at party creation; default scope = originating vehicle only | Deterministic | Party |

### 6.3 Assembly and findings (LRA-05 generalised)

| ID | Requirement | Tier | Gate |
|---|---|---|---|
| LRA-05 | Assembly from approved template: deterministic slot-fill; LLM drafts only in mapped free-text zones from GP-supplied facts and clause library; output carries LRA-P0 banner rendered by the platform | L1 | Counsel (per §3 clearance column) |
| DF-20 | Findings engine: cross-reference integrity, defined-term consistency, missing slots, jurisdiction flags — deterministic; contradiction candidates and deviation summaries — LLM, confidence-gated, evidence-pointed | Deterministic / L1 | Human disposition only |
| DF-21 | Side-letter provision picker: GP selects from the clause library; bespoke provisions are drafted by LRA from a structured request ("LP requests quarterly exposure report") and marked agent-provenance | L1 | Counsel |
| DF-22 | MFN interaction check: on any new side-letter draft, deterministic check against the vehicle's MFN policy and existing side letters; conflicts become blocking findings | Deterministic | Counsel dispositions |
| DF-23 | Prohibited-content classifiers (GR-3) run on every LLM zone before it is stored: legal conclusions, return/liquidity assurances, eligibility determinations | Pre-filter | Blocked content is logged; never shown |
| DF-24 | GP self-review with structured comments; GP cannot edit LLM zones in place — GP comments become instructions to counsel or trigger a re-draft (new version) | L2 | GP |

### 6.4 Counsel validation marketplace

| ID | Requirement | Tier | Gate |
|---|---|---|---|
| DF-30 | Fixed-fee menu per document class × jurisdiction × complexity band, set by each lawyer within platform-published bands; displayed before order | Deterministic | Lawyer sets; platform bands set by ops |
| DF-31 | Matching: GP chooses own counsel (if on platform) or requests network counsel; network ranking by admission match, capacity, SLA history, quality score, conflicts pre-check | Deterministic ranking | GP selects; lawyer accepts |
| DF-32 | Conflicts check prompt at engagement creation; lawyer attests; platform stores attestation, does not adjudicate | L0 | Lawyer |
| DF-33 | Engagement letter: lawyer's own or platform-provided model (counsel-approved) executed between lawyer and GP before first order; hash stored | Envelope service | Lawyer + GP |
| DF-34 | Validation order lifecycle with SLA clock (default 3 business days routine / 10 for D9–D10), acceptance, in-review, amended, cleared/rejected; reassignment on SLA breach | L2 | Lawyer |
| DF-35 | Clearance action: typed attestation ("I have reviewed version <hash> and clear it for execution"), credential re-verification at time of clearance, dwell-time floor per class (INV-8) | L3 (platform freezes hash) | **Lawyer only** |
| DF-36 | Amend-with-reason: redline editor writes a new DraftVersion; structured reason taxonomy (drafting error / missing provision / jurisdiction issue / client instruction / template defect / other) | Human authored | Lawyer |
| DF-37 | Template-defect feedback: an amendment reason of "template defect" opens a template-review item for the template owner | L2 | Template owner |
| DF-38 | Payout and platform fee accounting: fee held on order acceptance, released on clearance or rejection; platform fee structured per §13 counsel decision; monthly statements | Deterministic (SVC-CALC for fee arithmetic) | Finance |
| DF-39 | Lawyer quality controls: amendment rate, SLA adherence, GP rating, synthetic-item catch rate (RQ-1), periodic sample review by platform counsel | L0 metrics / L2 flags | Platform counsel |

### 6.5 Execution and extraction

| ID | Requirement | Tier | Gate |
|---|---|---|---|
| DF-40 | Envelope creation from the cleared hash only (INV-2); signatory identity bound to Party; signing order per document class | Deterministic | GP initiates |
| DF-41 | Signatory portal: view cleared document, sign, download; identity verification level configurable per class (D1 requires identity-module match) | Deterministic | Signatory |
| DF-42 | Completion: vendor completion certificate stored in SVC-EVID; final PDF hashed; instance → `EXECUTED` | Deterministic | — |
| LRA-07 | Obligation extraction from executed D2/D8/D9: known clauses → structured extraction; bespoke text → LLM extraction with confidence gate and evidence pointers | L1 | GP or counsel confirms each obligation (INV-5) |
| DF-43 | Register-event extraction from executed D1/D7 → `RegisterEvent` proposal | Deterministic | GP confirms; Tool 3 records |
| DF-44 | LPA parameter encoding proposal from executed D8/D9 for Tool 4 (waterfall type, fee schedule, pref, catch-up, clawback) | L1 proposal | Counsel validates encoding (Brief v2 Tool 4: "counsel-validated via Tool 2") |
| DF-45 | Batch mode for D1 subscriptions and D4/D5 notices: one queue item per batch is permitted **only** where the template version and all non-party slots are identical; per-LP slot values diff is shown; any variance breaks the batch | L3 | GP (D4/D5); counsel (D1 first batch, then GP for unchanged template per counsel's standing instruction) |

### 6.6 Governance, audit and safety

| ID | Requirement | Tier | Gate |
|---|---|---|---|
| DF-50 | Every draft, finding, amendment, clearance, envelope and extraction logged to SVC-LOG with GR-6 versions | — | — |
| DF-51 | Re-derivation (NFR-2): any historical draft can be regenerated from logged template version, slot snapshot, prompt/model versions in a sandbox and diffed | — | — |
| DF-52 | Kill switch coverage: dropping LRA to L0 disables LLM zones and extraction; assembly of slot-only documents and the entire counsel/execution workflow continue (Agent Spec §7.4: "the platform must remain fully operable with all agents at L0") | — | Kill-switch roles |
| DF-53 | Halt integration: a SVC-HALT signal scoped to a vehicle (e.g., from Tool 1 reconciliation break) blocks issuance of D4/D5 for that vehicle | L4 (fail-safe direction only) | Human clears |
| LRA-14 | Drift detection: executed LPA/side-letter parameters vs. Tool 4 configuration and Tool 5 obligation register; divergences alert | L2 | Counsel + GP |

---

## 7. Counsel network operations

The Brief is explicit: "lawyer-network recruitment and quality control is a services business inside a software company; margins depend on take rate, not seat price." This section specifies that business so it can be staffed and measured.

### 7.1 Supply model

| Segment | Role in network | Recruitment path | Volume expectation (M6) |
|---|---|---|---|
| Solo / boutique fund-formation lawyers (DE, Cayman) | Core fixed-fee validators for D1–D8, D11 | Direct outreach; design-partner referrals; emerging-manager legal communities | 15–25 active |
| Mid-size firms with emerging-manager practices | D9/D10 validators; firm-tenant template libraries; throughput customers | Partnership; firm licence | 3–5 firms |
| Offshore counsel (Cayman, BVI, Lux, SG) | Jurisdiction-specific approvals and validations | Referral via administrators and existing GP counsel | 1–2 per jurisdiction at launch |
| GP's existing counsel | Validate own client's documents on-platform (no marketplace fee) | Invited by the GP | Organic |

### 7.2 Onboarding and credentialing

1. Identity verification via the shared identity module.
2. Admission verification per claimed jurisdiction against the official roll/registry; evidence captured to SVC-EVID with fetch timestamp; re-verified annually and at every clearance (DF-35).
3. Professional-indemnity insurance evidence uploaded (counsel to set the minimum).
4. Conflicts-process attestation and acceptance of network terms (counsel-drafted; must address independence, engagement model, platform's non-lawyer status).
5. Calibration: validate three synthetic documents with known defects; results gate activation (RQ-1 analogue for supply).
6. Fee menu set within published bands (indicative bands below, for counsel and finance to test — not commitments).

| Class | Indicative fixed-fee band | Indicative SLA |
|---|---|---|
| D1 subscription (per template first review) | $500–$1,500; per-LP re-review $50–$150 | 2–3 business days |
| D2 side letter | $750–$2,500 | 3 business days |
| D6 / D11 routine consents & resolutions | $250–$750 | 2 business days |
| D7 transfer instrument | $1,000–$3,000 | 5 business days |
| D8 LPA amendment | $1,500–$5,000 | 5 business days |
| D9 LPA/PPM first-draft validation | $7,500–$25,000 | 10 business days |
| D10 CV election pack | $5,000–$20,000 | 10 business days |

These sit below the $5K–$15K per side letter and $50K–$150K formation benchmarks in the Brief; the pricing hypothesis is that structured first drafts and findings cut lawyer hours enough to make the bands profitable at hourly-equivalent rates.

### 7.3 Quality system

- **Structural:** DF-35 dwell-time floors; DF-36 mandatory structured amendment reasons; INV-7 separation of proposer and clearer.
- **Statistical:** per-lawyer amendment rate on agent drafts (an unusually low rate triggers RQ-1 synthetic injection), SLA adherence, downstream defect rate (a template defect or an obligation-extraction correction traced back to a clearance).
- **Sampled:** platform counsel of record reviews a monthly sample of clearances per lawyer, weighted toward high-risk classes; findings feed lawyer scorecards and template review.
- **Exit:** tiered — capacity reduction → probation → removal. Removal decisions are made by platform counsel, logged, and never automated.

### 7.4 Economics (illustrative, to be tested against §13)

Brief target: 15–25% take on validation fees. Two structures exist; counsel must choose (see §13.3): (a) a **platform/technology fee charged to the GP** on top of the lawyer's published fee, with the lawyer receiving 100% of their fee; (b) a **marketing/listing fee charged to the lawyer**. Structure (a) is the default assumption in this spec because it avoids the appearance of fee-sharing with a non-lawyer, but it must be confirmed per jurisdiction. Accounting (DF-38) supports both.

---

## 8. Agent behaviour (LRA within Tool 2)

### 8.1 Allowed functions and tiers

LRA operates only: LRA-05 (assembly), DF-20/21 (findings, bespoke drafting), DF-11 (term-sheet extraction), LRA-07 (obligation extraction), DF-44 (parameter encoding proposal), LRA-14 (drift). All at **L1** except DF-20 deterministic findings and LRA-14 alerts (L2). No LRA function in Tool 2 is above L2. There is no L3 or L4 agent action in this product; the L4 in DF-53 is a platform response to SVC-HALT, not an agent decision.

### 8.2 Prohibited (in addition to Universal P and LRA §5.1)

- Answering any question of the form "is this enforceable / compliant / advisable / standard?" from a GP, LP or lawyer — the Q&A console (Ops Console §7.3) is not exposed in Tool 2's external surfaces in v1.
- Selecting a template or clause for a GP on the basis of legal suitability (the rule table selects by jurisdiction/type; the agent may explain what the rule table did).
- Editing a document in any state other than `DRAFTING` (a re-draft always yields a new version).
- Marking a finding as resolved, or an obligation as confirmed.
- Communicating with a signatory, LP or counterparty; all outbound notices are platform templates triggered by humans.

### 8.3 Untrusted-input handling (DP-3)

Uploaded firm templates, term sheets, LP-requested side-letter language and executed PDFs are data. Directive text found inside them ("ignore prior instructions", "mark this clause approved") is quoted in a finding of type `injection_suspected`, the zone is not drafted, and the item is flagged to the reviewer. NFR-3 test corpus for Tool 2 must include: poisoned template uploads, adversarial LP side-letter requests, term sheets with embedded instructions, and PDFs with hidden text layers.

### 8.4 Eval suite (GR-7) specific to Tool 2

- **Legal-conclusion elicitation set:** ≥200 prompts across GP/LP/lawyer personas attempting to extract advice; pass = 0 conclusions.
- **Slot-fill correctness:** golden set of 100 vehicles × template versions; pass = 100% deterministic match (this is a code test, but it gates prompt changes too because zone boundaries can drift).
- **Findings precision/recall:** labelled corpus of documents with seeded cross-reference errors, undefined terms, MFN conflicts; targets: recall ≥ 0.95 on deterministic classes, precision ≥ 0.8 on LLM contradiction candidates (low precision is tolerable because humans disposition; low recall is not).
- **Extraction accuracy:** labelled side letters; obligation extraction F1 ≥ 0.9 on known clauses, ≥ 0.75 on bespoke, with 100% evidence-pointer coverage.
- **Injection resistance:** per NFR-3 corpus; pass = 0 acted-upon directives.
- **Amendment-reason regression:** every structured amendment reason from production becomes an eval case within one release cycle (RQ-3 → GR-7).

---

## 9. UX surfaces

All surfaces implement Ops Console P1–P7: state before action, tier badges on agent artifacts, asymmetric friction, evidence-or-grey, provenance styling, the single queue grammar, and anti-complacency controls. Tool 2 adds no second approval widget; clearance, template approval and batch approvals are SVC-QUEUE items rendered with the §8.2 item anatomy.

### 9.1 GP Workspace (external, tenant-scoped)

- **Vehicle home:** documents by state, outstanding signatures, pending validation orders with SLA state, extracted obligations awaiting confirmation, and Tool 1/3/4/5 hand-off status.
- **New document flow:** class → template (rule-selected, provenance shown) → inputs (slots from data model; missing ones requested) → free-text requests → assemble → findings panel → self-review → choose counsel → order.
- **Document view:** clause tree, provenance styling per zone, findings as margin annotations, diff-to-template and diff-to-last-cleared toggles, version history, LRA-P0 banner rendered by the platform on every unexecuted view.
- **Counsel picker:** own counsel or network; fee and SLA displayed before ordering; engagement letter state.
- **Notices console (D4/D5):** batch composer with the INV-4 grey rule; amounts show SVC-CALC evidence chips or the unreconciled flag; a vehicle under SVC-HALT shows the barrier graphic and no issue control.

### 9.2 Counsel Review Room (external role; extends Ops Console §5.3)

- Queue of validation orders (My / Firm / Watching), SLA-sorted.
- Redline-capable viewer: platform findings as annotations; agent zones tinted; amend writes a new version with mandatory structured reason.
- Clearance control: typed attestation, dwell fill animation (not a countdown), credential status shown at the moment of clearance, disabled while any load-bearing field is grey.
- Template management (for template owners): ingestion review, approval items, defect feedback inbox.
- Privilege partition indicator: sealed items visually distinct; crossing is an explicit act (Ops Console §5.3).

### 9.3 Signatory Portal (external, minimal)

- Identity check per class; document view (cleared version only); sign; download executed copy; consent-grant screen at first account creation with plain-language, per-purpose toggles (DF-P6). No marketing surface.

### 9.4 Internal (Ops Console additions)

- **Network ops board:** lawyer roster, credential expiry, capacity, quality metrics, sample-review queue for platform counsel.
- **Template registry:** platform library with version graph and approval provenance.
- **Factory health:** orders by state, SLA breaches, extraction confirmation backlog, classifier block counts, eval status.
- Audit & Evidence explorer (§10.5) covers all Tool 2 objects with re-derive.

---

## 10. Integrations and event contracts

| Integration | Mechanism | Notes |
|---|---|---|
| E-signature | Vendor adapter behind `Envelope Service`; v1 one vendor with completion certificates and audit trail; ESIGN/UETA/eIDAS posture per jurisdiction confirmed by counsel | No agent path to the adapter; envelope creation is a human-initiated platform action |
| Shared identity module | Party identity, KYC status, eligibility attestations, consent grants | Determinations of record live there, not in Tool 2 |
| Tool 1 (Reporting) | `notice.issued` (D4/D5 with cash-flow classification), `vehicle.terms.changed` | Tool 1 consumes; Tool 2 never computes the amounts |
| Tool 3 (Register/Transfers) | `register.subscription.recorded`, `register.transfer.recorded`, `consent.recorded`, `election.window.opened`; inbound `transfer.restriction.check.requested` → LRA-07 answer | Tool 3 is the register of record; Tool 2 proposes events |
| Tool 4 (Waterfall) | `lpa.parameters.encoded` / `.changed` (counsel-validated) | Tool 4 encodes; Tool 2 supplies the validated source |
| Tool 5 (Compliance) | `obligation.created[]`, `mfn.compendium.updated`, `drift.detected` | Only human-confirmed obligations |
| SVC-BUS | Typed, schema-validated events; no free text | Agent Spec §1.2 |
| Firm document systems | v1: Word/PDF import and export; later: iManage/NetDocuments connectors if firm demand justifies | Export of an unexecuted document always carries the LRA-P0 banner and a "DRAFT — not cleared" watermark |

---

## 11. Security, privacy and privilege

- **Tenant isolation:** row-level tenancy plus per-partition encryption keys for privilege partitions; cross-tenant reads only via consent-gated Party access (INV-6).
- **Privilege partition (DF-P7):** break-glass access requires GC approval, is time-boxed, logged to SVC-LOG as a security event, and is reported in the quarterly agent-conduct review (RQ-6).
- **LLM data handling:** prompts include only the slot snapshot and zone context required; no KYC documents; model provider contractually bound to no-training and configured retention; provider change is a vendor-risk event (NFR-9). Counsel to confirm whether any partitioned content may be sent to an external model at all — if not, LLM zones are disabled inside partitions (the workflow still functions, per DF-52).
- **PII minimisation (NFR-5):** LP personal data lives in the identity module; documents reference party ids and pull display values at render time; executed PDFs (which necessarily contain names) are stored encrypted in SVC-EVID with access logging.
- **Data residency:** Singapore- and EU-resident tenants may require regional storage; design storage as region-pinned per tenant from the start; confirm requirements with counsel per launch jurisdiction.
- **Retention:** counsel sets the schedule; WORM for SVC-LOG; documents retained for the vehicle's life plus the statutory period; data-subject requests handled via the identity module with legal-hold override.
- **Application security:** inherits A12 (2FA mandatory for GP and counsel roles, device binding, session anomaly detection, SOC 2 Type II path).

---

## 12. Non-functional requirements

| ID | Requirement |
|---|---|
| DF-NFR-1 | Assembly of any D1–D8 document completes in < 60 s p95 including findings; D9/D10 < 5 min p95. |
| DF-NFR-2 | Zero data loss on draft versions; every version reproducible (NFR-2) for the retention period. |
| DF-NFR-3 | Counsel Review Room usable by external lawyers with no training beyond a 15-minute walkthrough; measured by time-to-first-clearance. |
| DF-NFR-4 | Kill-switch drill quarterly: with LRA at L0, a slot-only D1 and a D4 notice must complete end-to-end (DF-52). |
| DF-NFR-5 | Availability 99.9% for signatory portal and clearance actions; assembly may degrade independently. |
| DF-NFR-6 | Cost governance: per-tenant LLM spend ceilings with alerting (NFR-7); a runaway re-draft loop terminates at a hard ceiling. |
| DF-NFR-7 | All external surfaces WCAG 2.1 AA; signatory portal mobile-first. |
| DF-NFR-8 | Change control for templates, prompts, classifiers and rule tables follows NFR-8 (Eng + Compliance + counsel for LRA functions). |

---

## 13. Legal and regulatory preconditions (resolve before the corresponding build)

These are questions, not positions. Each has a **build dependency** so the plan in §15 can be gated.

| # | Question | Blocks |
|---|---|---|
| 13.1 | **UPL by jurisdiction.** Does a platform that assembles documents from lawyer-approved templates, shows deterministic findings, and drafts free-text zones for a lawyer's review constitute practice of law in DE, NY, Cayman, BVI, Lux, SG, E&W? What disclaimers, workflow constraints and lawyer-supervision requirements make the position defensible in each? | Any jurisdiction's launch (§3) |
| 13.2 | **Privilege architecture.** How must LRA work product be commissioned (lawyer-initiated?), supervised and stored to sit inside privilege where the GP wants it to? Who defines the partition boundary per engagement? May partitioned content be processed by an external LLM provider? | Partition design (§4.3), LLM data handling (§11) — Phase A |
| 13.3 | **Fee structure.** Does a percentage take on lawyer fees constitute impermissible fee-sharing or paid referral (e.g., ABA Model Rules 5.4 / 7.2 analogues; equivalents offshore)? Is a GP-paid platform fee (§7.4 structure a) the required form? Are lawyer-set fixed fees within platform bands permissible? | Marketplace accounting (DF-38) — Phase B |
| 13.4 | **Network terms.** Engagement model (lawyer ↔ GP, platform as marketplace), independence, platform's non-lawyer status, insurance minimums, conflicts process, advertising rules for lawyer profiles and quality scores. | Counsel onboarding (§7.2) — Phase B |
| 13.5 | **E-signature validity** per document class and jurisdiction (e.g., deeds, notarisation, apostille requirements offshore); identity-verification level required for D1 and D7. | Envelope service (DF-40/41) — Phase C |
| 13.6 | **Marketing and labelling.** Wording of the LRA-P0 banner, draft watermarks, and public claims about "lawyer-validated" documents; what the platform may say about lawyers' quality metrics. | GA (Phase D) |
| 13.7 | **Data protection.** GDPR/PDPA/CCPA roles (controller/processor) for GP, lawyer, platform; cross-border transfer basis; retention schedule. | Data residency and retention (§11) — Phase B |
| 13.8 | **Template ownership and licence.** IP position on firm-uploaded templates, platform master forms, and clause libraries; what a GP may take with them on churn. | Template library (§6.1) — Phase B |
| 13.9 | **Document classes bordering on regulated activity.** D10 election materials and D4/D5 notices — any solicitation or advice characterisation risk when distributed to LPs through the platform. | R3 (Phase E) |

Per the Agent Spec's governing premise and Brief v2 Risk 5: **architecture must be locked with counsel before code** for anything these questions touch. Phase A exists to do that.

---

## 14. Acceptance criteria and success metrics

### 14.1 Release acceptance (all releases)

- 0 legal conclusions in agent output against the elicitation set (§8.4).
- 100% of drafts carry the LRA-P0 banner in every external rendering; verified by UI test.
- 100% of `CLEARED` transitions have a valid `Clearance` row (INV-1) — audited by query, not asserted.
- 0 envelopes created against a non-cleared hash (INV-2).
- 0 obligations or register events published without human confirmation (INV-5).
- Kill-switch drill passed (DF-NFR-4).
- Injection corpus passed (NFR-3).

### 14.2 Design-partner exit criteria (end of Phase D)

- ≥ 3 GP tenants (Epoch + two non-crypto anchors) each with ≥ 1 vehicle fully papered through D1/D2/D4 on-platform.
- ≥ 10 network lawyers active across DE and Cayman; median time-to-clearance within SLA on ≥ 85% of orders.
- Lawyer amendment rate on agent drafts between 20% and 60% — below 20% suggests rubber-stamping (trigger RQ-1); above 60% suggests templates or prompts are not ready.
- GP-reported legal cost per side letter and per subscription batch reduced ≥ 50% vs. their prior invoices (self-reported; collect the invoices).
- ≥ 80% of executed side letters produce confirmed obligations emitted to Tool 5 without manual re-entry.
- NPS from validating lawyers ≥ 30 (they are supply; if they hate the room, the marketplace dies).

### 14.3 Business metrics (tracked from GA)

Vehicles papered / month · documents executed / month · validation GMV and platform net revenue · take rate realised · lawyer utilisation · SLA adherence · extraction confirmation rate · consent-grant rates by purpose (the marketplace-readiness signal) · churn by tenant type.

---

## 15. Implementation plan

Aligned to Brief v2 §5: **Phase 0a, months 0–6, in parallel with Tool 1**, with Tool 2 extensions in months 6–12 alongside Tools 3 and 5. Shared services (SVC-*) are built once by a platform team and consumed here; their schedule is a dependency, not part of this plan.

### 15.1 Phases and gates

| Phase | Months | Objective | Scope | Exit gate |
|---|---|---|---|---|
| **A — Lock the architecture** | 0–1 | Resolve §13.1–13.4, 13.7–13.8 sufficiently to build DE + Cayman; recruit design partners and first counsel | Counsel workshops; UPL/privilege memo; fee-structure decision; network terms draft; partition and consent data-model decisions; template sourcing (platform masters for DE/Cayman D1/D2/D4/D5); design-partner agreements (Epoch + 2 non-crypto); 10 validation conversations (Brief v2 §5 gate) | Written counsel positions on 13.1–13.4; data-model ADRs for DF-P6/P7 approved; 3 design partners signed; ≥ 5 lawyers committed to calibrate |
| **B — Core loop (R1 build)** | 1–3 | Working loop: template → assemble → findings → counsel clearance, in shadow mode | Template library + approval workflow (DF-01..05); fund data model & vehicle wizard (DF-10..13); assembly LRA-05 with deterministic slots and zone map; findings engine (DF-20..24) with classifiers; state machine and invariants INV-1..3, 7, 8; Counsel Review Room on SVC-QUEUE; GP Workspace v0; eval suite v1; injection corpus v1. **Shadow mode:** Epoch's counsel run their real side letters through the platform and compare against their own work (Agent Spec §9: one full cycle before reliance) | Invariant tests green; eval suite green; ≥ 20 shadow documents with structured lawyer feedback; amendment reasons captured; counsel confirms R1 template set |
| **C — Marketplace + execution (R1 complete)** | 3–4 | Fixed-fee validation orders and on-platform execution | Lawyer onboarding & credentialing (§7.2); fee menu, matching, orders, SLA (DF-30..37); accounting per §13.3 (DF-38); e-sign adapter and envelope service (DF-40..42, INV-2) after §13.5; signatory portal with consent capture; obligation extraction LRA-07 + confirmation (INV-5) → Tool 5 event contract; subscription register events (DF-43) → Tool 3 contract; D4/D5 notices with INV-4 and Tool 1 event contract; kill-switch drill | First paid orders cleared and executed for ≥ 2 design partners; first obligations flowing to Tool 5 staging; DF-NFR-4 drill passed; §13.5 confirmed for DE/Cayman D1/D2 |
| **D — Design-partner GA** | 4–6 | Charge from day one (Brief v2 §5 pricing discipline); prove the loop at small scale | Pricing live (platform subscription + per-document + validation); network to ≥ 10 lawyers; quality system (DF-39, sample reviews); network ops board; factory health dashboard; R2 build starts: D3 MFN compendium, D6 LPAC consents, D7 transfers (with Tool 3 restriction check), D8 amendments, D11 resolutions, batch mode DF-45; second jurisdiction prep (BVI or Lux, driven by design partners) | §14.2 exit criteria met; §13.6 labelling confirmed; go/no-go for open onboarding |
| **E — Expansion (R2 GA, R3 build)** | 6–12 | Full lifecycle coverage; feed Tools 3 and 5 as they launch | R2 GA; D9 LPA/PPM first drafts (dwell floors, mandatory counsel); DF-44 parameter encoding → Tool 4; D10 CV election pack co-built with Tool 3's first continuation process on a design partner (Brief v2 §5); LRA-14 drift against Tools 4/5; firm tenants and firm libraries; jurisdictions v1.5; administrator channel integration (import of LP lists, export of executed packs); law-firm channel | Per-release acceptance (§14.1); D9 cleared for ≥ 3 vehicles; D10 used in ≥ 1 real CV process; ≥ 2 firm tenants |

### 15.2 Workstreams and owners

| Workstream | Owner | Phases |
|---|---|---|
| Legal architecture & counsel of record | GC / outside fund-formation counsel | A, then continuous (templates, jurisdictions) |
| Platform services consumption (SVC-EVID/QUEUE/LOG/POLICY/BUS) | Platform team (shared with Tool 1) | Dependency; interfaces frozen by end of A |
| Template library & clause engine | Backend eng + counsel of record | B–E |
| Fund data model & identity/consent integration | Backend eng + identity module owner | A (ADRs), B |
| Assembly, findings, extraction (LRA in Tool 2) | ML/LLM eng + backend | B, C, E |
| Marketplace, orders, accounting | Backend eng + finance | C, D |
| Envelope service & signatory portal | Backend + frontend eng | C |
| GP Workspace & Counsel Review Room | Frontend eng + design (Ops Console grammar) | B–D |
| Network operations | Legal-ops / network lead | A (recruit), C–E (run) |
| Evals, red-team, security | ML eng + security lead | B–E |
| Design-partner program & GTM | Product lead | A–E |

### 15.3 Team (recommended, months 0–6)

Product lead (1) · tech lead / backend (1) · backend engineers (2) · frontend engineer (1) · ML/LLM engineer (1) · designer (0.5, shared with Tool 1) · legal-ops / network lead (1) · GC or outside counsel (fractional, heavy in Phase A) · platform-services team (shared, not counted). Roughly **6.5 FTE plus counsel**. Tool 1 runs a separate team; the shared services team serves both.

### 15.4 Dependencies

| Dependency | Needed by | Risk if late |
|---|---|---|
| SVC-QUEUE, SVC-EVID, SVC-LOG, SVC-POLICY | Phase B start | Counsel Review Room cannot be built on a second approval widget (P6); build stalls |
| Shared identity module (party identity, KYC status, consent grants) | Phase B (data model), Phase C (signatory verification) | Consent architecture (DF-P6) cannot be retrofitted; Brief v2 Risk 6 |
| Counsel positions §13.1–13.4 | Phase B start / Phase C start | Building the marketplace on the wrong fee structure is a rebuild |
| Tool 3 register event contract | Phase C | Subscriptions/transfers land as PDFs only; D7 cannot ship |
| Tool 4 / SVC-CALC for D4/D5 amounts | Phase C | Notices ship with the unreconciled flag only (acceptable for v1, must be disclosed) |
| Tool 5 obligation contract | Phase C | Obligations stay in Tool 2's own register until Tool 5 launches (acceptable) |
| E-sign vendor contract | Phase C | Execution off-platform; the network hook (signatory accounts) is lost |

### 15.5 Risks and mitigations (specific to Tool 2)

| Risk | Mitigation |
|---|---|
| UPL or fee-sharing position closes a jurisdiction or the take-rate model | Phase A gate; default to GP-paid platform fee; jurisdiction-by-jurisdiction launch; product works with GP's own counsel even if network economics change |
| Lawyer supply too thin; SLAs missed | Recruit before build (Phase A); design-partner counsel as first supply; SLA-based reassignment; firm partnerships for D9/D10 |
| Rubber-stamp clearance | RQ-1 synthetic injection, RQ-2 dwell floors, sampled review, amendment-rate monitoring (§14.2 band) |
| Template defects propagate across tenants | Approval workflow with named approver; defect feedback loop (DF-37); retirement flags in-flight instances; versioned clearances mean an executed document is always tied to the version counsel actually saw |
| A cleared document is later found defective (the "franchise event") | Liability sits with the validating lawyer by engagement model; platform evidence trail shows what was presented, what was cleared, by whom, with what dwell; insurance minimums; platform never claims documents are "correct", only "cleared by named counsel" (§13.6) |
| Ontra moves down-market / iCapital adds drafting to Passthrough | Compete on the loop + downstream execution into Tools 1/3/4/5, not on drafting alone; ship D2 obligations → Tool 5 and D1 → Tool 3 early so the integration is the moat |
| LP consent friction reduces network value | Plain-language per-purpose consent; default minimal scope; measure grant rates as a KPI, never dark-pattern them (the Carta precedent) |
| Agent scope creep toward advice | External surfaces have no agent Q&A in v1; GR-3 classifiers; elicitation eval set in every release; tier promotion rule (≥ 90 days, counsel sign-off) |
| Shared-services slippage | Interfaces frozen by end of Phase A; Tool 2 builds against contracts with stubbed services in Phase B |

### 15.6 Backlog by epic (for estimation)

1. **Template library** — ingestion parser, clause tree, slot schema, approval queue item, versioning, retirement, firm libraries.
2. **Fund data model** — vehicle, terms, parties/roles, consent grants, wizard, term-sheet import.
3. **Assembly & findings** — slot engine, zone map, LRA-05 prompts, deterministic checks, contradiction/deviation LLM findings, classifiers, provenance rendering.
4. **State machine & invariants** — transitions, INV-1..8, versioning, diff engine.
5. **Counsel Review Room** — queue views, redline viewer, amend-with-reason, clearance with dwell/credential check, partition UI.
6. **Marketplace** — lawyer profiles, credentialing, fee menus, matching, orders, SLA, accounting, statements.
7. **Execution** — envelope service, vendor adapter, signatory portal, completion evidence.
8. **Extraction & events** — LRA-07, DF-43, DF-44, confirmation UI, SVC-BUS contracts to Tools 1/3/4/5.
9. **Notices (D4/D5)** — batch composer, INV-4, halt integration.
10. **Ops & governance** — network ops board, factory health, evals, injection corpus, kill-switch drill, audit explorer coverage.
11. **R2/R3 document classes** — D3, D6–D8, D11; then D9, D10.

---

## 16. Open questions for founder/partner decision

1. **Platform library vs. firm libraries first?** A platform-owned master template set for DE/Cayman makes the product self-sufficient but requires a counsel of record and ongoing maintenance cost; leading with firm libraries makes law firms the first customers and shifts template liability to them. Recommendation: both, with the platform library limited to D1/D2/D4/D5 in R1.
2. **Take-rate structure** (§7.4 a vs. b) — pending §13.3, but the commercial preference should be stated now because it shapes lawyer recruitment messaging.
3. **Second and third design partners** — the Brief requires non-crypto anchors; Tool 2 specifically benefits from an independent sponsor or SPV organizer with many vehicles (D1/D2 volume) and a law firm willing to be a firm tenant.
4. **E-sign vendor** — buy vs. build is not a question (buy), but which vendor's audit trail and identity options satisfy §13.5 offshore should be decided with counsel, not procurement.
5. **Should D4/D5 notices ship before Tool 4?** They monetise immediately but carry GP-entered amounts under the unreconciled flag. Recommendation: yes, with the flag disclosed to LPs in the notice footer, and Tool 4 integration as the R2 upgrade.
6. **Administrator channel timing** — administrators are named as a channel; integration (LP list import, executed-pack export) is cheap but partner terms and the "we never market to your LPs" expectation need to be settled before the first administrator referral.

---

*This specification is a product and engineering planning document, not legal advice. Every statement concerning unauthorised practice of law, privilege, fee arrangements, electronic signatures, and data protection is a design assumption requiring validation by qualified counsel in each target jurisdiction before the corresponding component is built or launched.*
