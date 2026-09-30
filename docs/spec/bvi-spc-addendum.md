# Singularity — Tool 2 Addendum: BVI Segregated Portfolio Company Structure
### Data model, document catalogue and controls for an SPC with one segregated portfolio per project

**Version:** 0.1 · 24 September 2026 (draft for founder, engineering and BVI counsel review)
**Extends:** `Singularity_Tool2_Document_Factory_Spec_and_Plan.md` (§3 catalogue, §4.3 tenancy, §5 data model and invariants, §6 requirements, §13 legal preconditions, §15 plan). Read alongside `Singularity_Tool2_Jev_Integration_Proposal.md`.
**Status:** Design proposal. Statements about BVI law and regulation below are **assumptions to be confirmed by BVI counsel** before the corresponding component is built. They are marked **[confirm]**.

---

## 1. The structure being supported

The GP operates one BVI segregated portfolio company (the **SPC**) as the main entity. Each investment project is held in its own **segregated portfolio (SP)**, which works as a dedicated sub-fund for that project only. Investors choose project by project and subscribe for shares of the relevant SP.

```
BVI SPC  (the legal entity)
│  directors · registered agent · memorandum & articles · umbrella offering memorandum
│  management / voting shares held by the sponsor                           [confirm]
│
├── SP 1 — Project A    own asset · own terms · own share class · own investors
├── SP 2 — Project B    own asset · own terms · own share class · own investors
└── SP 3 — Project C    …
```

Three features of this structure drive the design:

1. **An SP is not a separate legal person.** The SPC acts for each SP. Every contract and document is therefore made by the SPC *for the account of* a named SP. **[confirm]**
2. **Ring-fencing depends on doing this correctly.** Each SP's assets are meant to answer only for that SP's liabilities. Documents that fail to identify the SP, or that mix one SP's terms or assets into another's, risk weakening that protection. **[confirm]**
3. **Regulation sits mainly at SPC level.** Registration as an SPC, the fund category it falls under, AML officers and FATCA/CRS reporting generally attach to the SPC as the legal entity, while investor-count or size limits may apply per SP or across the whole SPC depending on category. **[confirm]**

This is the "deal layer" gap identified earlier: the base spec models one fund with one set of terms and one investor list. This addendum adds a two-level model (umbrella and portfolio) and makes the portfolio the unit that documents, money and investor consent are scoped to.

## 2. Principles added

> **DF-P9 — The portfolio is the unit of record.** Every document, subscription, notice, obligation and register entry that relates to a project belongs to exactly one SP. Umbrella-level records (constitutional documents, the umbrella offering memorandum, SPC-wide service agreements) belong to the SPC and are marked as such. Nothing is scoped to "the fund" in the abstract.

> **DF-P10 — Designation is generated, never typed.** The contracting-party wording ("[SPC name] for and on behalf of [SP name]") is produced by code from the SPC and SP records. No person and no model writes or edits it. A document without a valid designation cannot be assembled, cleared or signed.

> **DF-P11 — No cross-portfolio contamination.** A document for one SP must not contain another SP's name, asset, terms, investors or figures. This is checked deterministically before clearance and again before signature.

## 3. Data model changes (spec §5.1)

### 3.1 Replace `Vehicle` with a two-level structure

| Entity | Key fields | Notes |
|---|---|---|
| `Umbrella` (the SPC) | id, tenant, legal name (must carry the required SPC suffix **[confirm]**), company number, registered agent, registered office, directors[], authorised signatories[], fund category and regulator registration refs, AML officer refs, FATCA/CRS classification, constitutional document refs, umbrella offering memorandum ref, service providers (administrator, auditor, custodian) | Replaces the fund-level fields of `Vehicle`. One per SPC. |
| `Portfolio` (the SP) | id, umbrella_id, SP name (with required SP suffix **[confirm]**), project reference, share class designation, status, terms ref, asset refs[], allocation policy, investor caps (from counsel, see §6), creation resolution ref, supplement ref, launch-gate state | The unit every project document is scoped to. |
| `PortfolioTerms` | portfolio_id, version, minimum subscription, subscription price per share, management fee basis and rate, carry and hurdle, fee payer (SP or investor), expense cap, term, distribution policy, exit / wind-up mechanics, transfer restrictions | Versioned. Slot source for every SP-level document; encoding source for Tool 4 per SP. |
| `Asset` | id, portfolio_id, issuer, instrument, quantity, **acquisition source** (`issuer_primary` / `market_secondary` / `gp_sourced`), acquisition price, acquisition document refs, issuer transfer restrictions (LRA-07 extraction), GP cost basis and acquisition date (required when `gp_sourced`) | `gp_sourced` triggers the conflict controls in §5. |
| `Offer` | id, portfolio_id, open and close dates, target size, hard cap, status | One per SP offering round. |
| `SubscriptionRequest` | offer_id, party_id, requested amount, eligibility snapshot ref, status (`requested` → `allocated` → `documented` → `signed` → `funded` → `issued`) | The investor's opt-in for this SP. |
| `Allocation` | offer_id, party_id, requested, allocated, shares to issue, method ref, computed_by (SVC-CALC) | Computed by code, never by a model. |
| `CostAllocationRule` | umbrella_id, cost category, basis (equal / by committed capital / by NAV / direct), effective dates, approved_by | Governs how SPC-level costs are split across SPs. |

`Party`, `Role`, `Engagement`, `DocumentInstance` and the rest of §5.1 are unchanged except for the scoping fields below.

### 3.2 Scoping fields added to existing entities

- `DocumentInstance.scope` = `umbrella` or `portfolio`; `DocumentInstance.portfolio_id` is required when scope is `portfolio`.
- `Role` gains `portfolio_id`: an investor is an investor *in an SP*, not in the SPC generally.
- `Obligation`, `RegisterEvent` and every SVC-BUS event carry `umbrella_id` and, where applicable, `portfolio_id`.
- `ConsentGrant.scope` defaults to the **portfolio** the party joined through, not the umbrella.

### 3.3 Portfolio lifecycle

```
PROPOSED ─▶ APPROVED ─▶ OPEN ─▶ CLOSED ─▶ INVESTED ─▶ DISTRIBUTING ─▶ WINDING_UP ─▶ TERMINATED
             │           │        │
             │           │        └ allocation run, closing notices, share issue
             │           └ subscriptions accepted (launch gate passed)
             └ creation resolution executed; supplement cleared; any regulator
               approval or notification recorded [confirm]
```

A portfolio cannot move to `OPEN` until the launch gate in INV-12 is satisfied.

## 4. Document catalogue (spec §3)

### 4.1 Two layers

**Umbrella layer: done once per SPC, amended rarely.**

| # | Document class | Template source | Clearance | Release |
|---|---|---|---|---|
| U1 | Memorandum & articles (SPC provisions, share classes, SP mechanics) | Firm library (BVI counsel) | Counsel, mandatory | Imported in R1; drafting R3 |
| U2 | Umbrella offering memorandum / PPM | Firm library | Counsel, mandatory, dwell floor | Imported in R1; drafting R3 (as D9) |
| U3 | Umbrella subscription terms (general terms that every SP subscription incorporates) | Platform or firm library | Counsel | R1 |
| U4 | SPC-level resolutions (directors, service providers, cost-allocation rules) | Platform template (as D11) | GP (L3) routine; counsel novel | R1 |

In R1 the existing U1 and U2 are **imported, not drafted**: the platform parses them into the clause library so SP-level documents can reference them correctly and the findings engine can check SP documents against them.

**Portfolio layer: repeated for every project.** This is where most of the time saving is.

| # | Document class | Structured inputs | Agent free-text zones | Clearance | Downstream events | Release |
|---|---|---|---|---|---|---|
| D12 | SP creation resolution and share-class designation | Umbrella, new SP name, share class, terms version | None | Counsel for the first SP on a template; GP (L3) thereafter if template unchanged | `portfolio.created` | R1 |
| D13 | SP supplement (project term sheet under the umbrella memorandum) | PortfolioTerms, Asset, risk facts supplied by GP | Project description and project-specific risk factors, from GP-supplied facts only | Counsel, per SP, dwell floor | `portfolio.terms.encoded` → Tool 4 | R1 |
| D1-SP | SP subscription agreement (U3 general terms + SP schedule) | Umbrella, Portfolio, Party, allocation | Cover note only | Counsel for the first SP on a template; batch-clearable per investor thereafter | `register.subscription.recorded` (with portfolio_id) → Tool 3 | R1 |
| D14 | Allocation and closing notice | Allocation rows (SVC-CALC), shares to issue, funding instructions | None | GP (L3) | `portfolio.allocation.issued` | R1 |
| D4 / D5 | Capital-call and distribution notices, per SP | SVC-CALC per SP, including allocated SPC-level costs | None | GP (L3) | `notice.issued` (with portfolio_id) → Tool 1 | R1 |
| D2 | Side letter, per investor per SP | As base spec | As base spec | Counsel | As base spec, with portfolio_id | R1 |
| D15 | GP-sourced asset conflict pack (see §5) | Asset (gp_sourced), cost basis, price basis, valuation ref | Conflict narrative from GP-supplied facts only | Counsel, mandatory, dwell floor | `conflict.disclosed` → Tool 5 | R2 |
| D7-SP | Transfer of SP shares | As D7, scoped to one SP | None | Counsel | `register.transfer.recorded` → Tool 3 | R2 |
| D16 | SP wind-up pack (final distribution, compulsory redemption notice, termination resolution) | SVC-CALC final waterfall, register | None | Counsel | `portfolio.terminated` | R2 |

Existing classes D3, D6, D8, D9, D10, D11 remain available; each is tagged `umbrella` or `portfolio` scope when instantiated.

### 4.2 How a subscription is assembled

```
U3 umbrella subscription terms  (cleared once, frozen hash)
        +
D13 SP supplement               (cleared per SP, frozen hash)
        +
SP schedule                     (code: party, allocation, shares, price, designation)
        =
D1-SP for this investor in this SP
```

Because U3 and D13 are already cleared and frozen, counsel's review of an individual D1-SP after the first one on a template is limited to the SP schedule and any cover note, which is what makes batch clearance per SP safe.

## 5. When the GP supplies the asset (conflict controls)

If `Asset.acquisition_source = gp_sourced` — the GP or an affiliate moves a stake it already owns into the SP — the GP is on both sides of the transaction and sets the price for its own asset. The system then requires, before the SP can open:

1. **Cost-basis disclosure.** The GP's acquisition date and cost, entered once and evidence-linked (purchase documents in SVC-EVID). Any markup is computed by code and shown in the supplement.
2. **Price-basis statement.** How the transfer price was set, with a reference to any independent valuation. Whether an independent valuation is mandatory, and above what size, is a counsel and board policy stored in SVC-POLICY.
3. **D15 conflict pack cleared by counsel** and delivered to every prospective investor before their subscription can be signed.
4. **Investor acknowledgement.** Each D1-SP for that portfolio carries a conflict acknowledgement slot; the envelope cannot complete without it.
5. **Separation of roles.** The person who entered the price basis cannot approve the SP launch (extends INV-7).

This mirrors the continuation-vehicle controls in D10 and connects to Tool 3 if the same stake is later offered to further investors.

## 6. Invariants added (spec §5.2)

- `INV-9` Every portfolio-scoped `DocumentInstance` has a `portfolio_id`; the contracting-party designation in the document equals the code-generated designation for that SP. Mismatch blocks assembly, clearance and envelope creation. (DF-P10)
- `INV-10` A portfolio-scoped document may not contain the name, share class, asset identifiers, investor names or monetary figures of any other SP under the same umbrella. Checked deterministically against the umbrella's other SP records before `CLEARED` and before `OUT_FOR_SIGNATURE`. (DF-P11)
- `INV-11` An allocation run cannot complete if it would exceed any investor-count, investor-type or size cap configured for the SP or the umbrella. Caps are set by counsel in SVC-POLICY; the check is code. **[confirm caps and their level]**
- `INV-12` Launch gate: a portfolio cannot move to `OPEN` until D12 is executed, D13 is cleared, U3 is cleared, required regulator approvals or notifications are recorded **[confirm]**, and, for `gp_sourced` assets, D15 is cleared. The gate has no override other than counsel (as LRA-06).
- `INV-13` Every SPC-level cost that appears in an SP notice carries a reference to the `CostAllocationRule` and the SVC-CALC computation that split it. No SP notice shows an allocated cost without both.
- `INV-14` An investor's party record is read by another portfolio's workflows only with a consent grant for that portfolio. (Narrows INV-6 from vehicle to portfolio.)

## 7. Functional requirements added (spec §6)

| ID | Requirement | Tier | Gate |
|---|---|---|---|
| DF-60 | Umbrella setup: import U1/U2 from firm documents into the clause library; capture directors, signatories, fund category, service providers | L1 parse + deterministic | BVI counsel approves parsed structure |
| DF-61 | Portfolio creation wizard: name (with suffix check), share class, terms, asset, acquisition source; generates D12 and D13 drafts | Deterministic + L1 zones | GP; counsel per §4.1 |
| DF-62 | Designation generator (DF-P10) used by every template; designation string is read-only in every editor | Deterministic | — |
| DF-63 | Cross-portfolio check (INV-10) as a blocking finding type, alongside the existing findings engine | Deterministic | Counsel dispositions only if a false positive |
| DF-64 | Offer management: open/close dates, target, hard cap; investor opt-in per SP from the investor portal | Deterministic | GP |
| DF-65 | Allocation run: pro rata, first-come, or GP discretion with recorded reasons; caps enforced (INV-11); outputs D14 | SVC-CALC | GP approves (L3) |
| DF-66 | Cost allocation: split SPC-level costs across SPs per rule; feeds D4/D5 per SP (INV-13) | SVC-CALC | GP approves rule changes; counsel for rule creation |
| DF-67 | GP-sourced asset controls (§5): cost-basis capture, price basis, valuation reference, D15, acknowledgement slot | Deterministic + L1 narrative | Counsel |
| DF-68 | Portfolio launch gate board (INV-12), in the same style as the offering readiness board in Ops Console §5.3 | Deterministic | Counsel clears |
| DF-69 | Portfolio wind-up: final waterfall (Tool 4), D16 pack, register close-out | SVC-CALC + deterministic | Counsel |

## 8. Money, reporting and other tools

- **Per-SP books.** Capital calls, distributions, waterfalls and reporting run per SP. Tool 4 encodes waterfall terms from each D13; Tool 1 reports per SP, with an umbrella roll-up for the GP only (never shown to one SP's investors with another SP's figures).
- **Umbrella costs.** Split by `CostAllocationRule` (DF-66); every allocated line is traceable (INV-13).
- **Register (Tool 3).** One register per SP; the umbrella register is the union. Transfers are within an SP only.
- **Compliance (Tool 5).** Filing calendar and AML obligations at umbrella level; side-letter obligations per SP.
- **Jev (if adopted).** The cross-portfolio check stays deterministic. Jev can add a supporting check for indirect references (for example, a risk factor describing another project's company without naming it), reported as a non-blocking finding for counsel.

## 9. Legal preconditions added (spec §13)

| # | Question for BVI counsel | Blocks |
|---|---|---|
| 13.10 | Confirm the SPC's registration and fund category, and what regulator approval or notification is needed to create each new SP. | INV-12 launch gate, DF-61 |
| 13.11 | Confirm the required naming conventions for the SPC and each SP, and the required wording for contracting on behalf of an SP. | DF-62 designation generator |
| 13.12 | Confirm investor-count, investor-type and size limits, and whether each applies per SP or across the SPC. | INV-11, DF-65 |
| 13.13 | Confirm who may sign for each SP (directors, authorised signatories) and whether each SP launch needs a board resolution in addition to D12. | DF-40 signing order, D12 |
| 13.14 | Confirm policy for GP-sourced assets: when an independent valuation is required, required disclosures, and whether investor or board consent is needed. | §5, D15 |
| 13.15 | Confirm treatment of SPC-level (general) assets and liabilities, and acceptable bases for allocating general costs across SPs. | DF-66, INV-13 |
| 13.16 | Confirm e-signature validity in BVI for each document class, and any documents requiring wet ink, seal or notarisation. | Envelope service for BVI |
| 13.17 | Confirm the unauthorised-practice and privilege positions (§13.1–13.2 of the base spec) for BVI and for any other jurisdiction where investors are located. | BVI launch |

## 10. Changes to the implementation plan (spec §15)

| Phase | Change |
|---|---|
| **A (months 0–1)** | Engage BVI counsel of record. Resolve 13.10–13.17 enough to build. Collect the existing U1/U2 and at least one executed SP set as templates. **Move BVI into release 1** (previously release 1.5). |
| **B (months 1–3)** | Build the two-level data model (§3) before assembly work begins; it underpins every template. Build designation generator (DF-62), cross-portfolio check (DF-63) and portfolio lifecycle. Import U1/U2. Templates: U3, D12, D13, D1-SP. |
| **C (months 3–4)** | Offer management and allocation (DF-64, DF-65), D14, per-SP D4/D5 with cost allocation (DF-66), launch gate board (DF-68). First live SP papered end to end. |
| **D (months 4–6)** | GP-sourced asset controls and D15 (DF-67); D7-SP transfers; investor portal opt-in across multiple SPs. |
| **E (months 6–12)** | D16 wind-up (DF-69); umbrella document drafting (U1/U2 via D9 path); additional jurisdictions if needed. |

Acceptance criteria added to §14.1:
- 0 portfolio-scoped documents cleared or sent for signature with a missing or mismatched SP designation (INV-9), audited by query.
- 0 cross-portfolio references in cleared documents on the seeded test set (INV-10), with a test set that includes near-duplicate SP names.
- 0 allocation runs exceeding a configured cap (INV-11).
- 100% of allocated SPC costs in notices traceable to a rule and computation (INV-13).

## 11. Open questions for the founders

1. **Where do project assets usually come from?** If most SPs acquire from issuers or the market, §5 is an edge case. If most are GP-sourced, D15 moves to release 1.
2. **Allocation policy.** Pro rata, first-come, or GP discretion? Discretion is allowed but must record reasons for every allocation, which investors may later ask about.
3. **Who pays umbrella costs?** Split across SPs, charged to the sponsor, or a mix. This needs deciding before the first notices go out.
4. **Existing documents.** How many SPs already exist, and should their executed documents be imported so the register and obligations start complete?
5. **Investor experience across SPs.** Should investors see all open SPs in one place (a deal list) or only SPs they are invited to? This affects offering rules as much as design, and needs counsel's view before the portal is built.

---

*This addendum is a product and engineering planning document, not legal advice. Every statement about BVI company law, fund regulation, electronic signature and data protection is an assumption for qualified BVI counsel to confirm before the corresponding component is built or launched.*
