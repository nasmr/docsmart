# Singularity — Tool 2 Addendum: Using TypeSafe Jev in the Fund Document Factory
### Technical design proposal

**Version:** 0.1 · 23 September 2026 (draft for engineering and counsel review)
**Extends:** `Singularity_Tool2_Document_Factory_Spec_and_Plan.md` (§2 principles, §4.2 split, §6 requirements, §8 agent behaviour, §14 acceptance, §15 plan)
**Source reviewed:** docs.typesafe.ai — Introduction, Models, State, Confidence, How to build with TypeSafe, Jev 1.13 jaggedness, Legal, and the citation-check and LLM-guardrails cookbooks (read 23 Sep 2026; current model `jev-1.13.0`)
**Status:** Proposal. Nothing here changes the counsel gate (DF-P1) or any other human gate in the spec. Every use proposed below sorts, checks or prioritises work for a human; none of it replaces a decision the spec gives to a human.

---

## 1. What Jev is, in the terms of our spec

Jev is a non-generative "System One" model. One call sends a **state** (text or JSON) and many typed **questions**. Each question is evaluated separately and in parallel against that state, and the model returns typed answers, not prose:

| Primitive | Asks | Returns | Our use |
|---|---|---|---|
| **Choice** | Which of these options? | chosen option, probability per option, confidence | Closed lists: finding type, obligation type, how evidence relates to a claim |
| **Score** | Where on this ordered scale? | level, probability per level, confidence | Severity, how material a deviation is |
| **Noul** | Is this statement true? | probability 0–1 (no confidence field) | Hazard checks, "does clause X apply to transfer Y?" |

Properties that matter for us:

- **Calibrated uncertainty.** Every Choice and Score returns probabilities and a confidence figure derived from them. Our spec's GR-2 "confidence gating" currently depends on a generative LLM reporting its own confidence, which is the weakest part of that control. Jev makes confidence a measurable number.
- **Bounded output.** The model can only answer from the options we give it. It cannot write a legal conclusion, because it cannot write text at all.
- **Fast and cheap.** About 100 ms per request; $0.042 per million input tokens, with output free. A 30k-token clause state with 50 questions costs a fraction of a cent.
- **Self-consistent.** Designed to give stable answers when the same input is evaluated again, which helps DF-51 re-derivation.
- **Hard limits.** 64k tokens per request, of which **32k covers the state plus the longest single question**. Text only. Accuracy is best in English.
- **Documented weaknesses (jev-1.13):** literal reading, arithmetic and numbers, counting, date comparison, multi-step indirection, large state with irrelevant content, **adversarial content**, and text generation. Almost all of these land on work our spec already gives to code, which is why the fit is good.

## 2. The core design change: split the work three ways

The spec's §4.2 table divides work between **deterministic code** and **the LLM**. That leaves every judgment that isn't prose ("does this provision conflict with the MFN carve-out?", "is this an obligation, and of what type?") inside the generative model. The answer comes back as text that has to be parsed, and its confidence is unreliable.

Proposed new principle:

> **DF-P8 — Judgments are typed and calibrated.** Work is split three ways. **Code** computes and enforces. **A System One model** makes narrow judgments over unstructured text and returns probabilities. **A generative LLM** writes prose only inside mapped free-text zones. A judgment that can be expressed as a closed set of options is never given to the generative model. Confidence thresholds are policy held in SVC-POLICY, not in prompts.

Revised §4.2 (changed rows only):

| Concern | Code | System One (Jev) | Generative LLM | Human |
|---|---|---|---|---|
| Internal contradiction detection | Pairs candidate clauses by category; rule checks | Choice per pair: consistent / conflicts / unrelated, with confidence | — (previously the LLM) | Counsel dispositions |
| Deviation from standard | Clause diff | Score: cosmetic / drafting / substantive; Choice: which risk category | One-sentence plain-language summary of substantive deviations only | Counsel judges |
| Evidence-or-silence (GR-1) | Verbatim quote match | Choice: the section supports / contradicts / says nothing about the claim | — | Reviewer sees verdict and confidence |
| Prohibited content (GR-3) | Pattern pre-filter | A Noul per hazard plus a severity Score | — | Blocked items logged |
| Obligation extraction | Regex candidates for dates, amounts, parties; all date arithmetic | Choice over obligation types, triggers and frequencies; picks the right span among candidates | Only for bespoke clauses with no usable candidate | GP or counsel confirms (INV-5 unchanged) |
| Free-text drafting | — | Checks the draft afterwards | Drafts the zones | Counsel clears |
| Legal question typed by a user | — | Choice: product help / drafting instruction / request for a legal view | — | Requests for a legal view go to counsel as structured questions |

## 3. Where Jev fits in Tool 2

Each entry names the spec requirement it strengthens, the question design, and how results are gated. The question wording is illustrative; counsel reviews it before use (§5).

### 3.1 Findings engine: contradictions and MFN interaction (DF-20, DF-22)

**Today:** code finds cross-reference and defined-term errors; an LLM proposes contradiction candidates and reports its own confidence.

**Proposed:**
1. Code builds candidate pairs from the clause tree using category metadata (for example, every side-letter grant against every MFN carve-out; every transfer provision against the LPA transfer restrictions). **Code resolves defined terms and inlines them** before sending. Jev is weak at multi-step indirection, and following "Affiliate" through three definitions is exactly that.
2. One request per group of related clauses, with **one Choice per pair**. Dozens of pairs fit in one call:
   `relation: consistent | conflicts | unrelated`, with criteria that spell out what each option covers, what it does not, and examples.
3. Routing:
   - `conflicts` above a low floor becomes a finding; a companion Score sets severity.
   - `unrelated` at high confidence produces no finding, but the pair and its probabilities are logged.
   - Everything else becomes a finding marked "uncertain" and is shown to counsel with its probabilities.

**Rule:** Jev never suppresses a deterministic finding. It may only suppress the candidate findings the LLM would otherwise have raised, and only above a floor shown on our eval set to keep recall at or above 0.95 (the §14 target). The spec already accepts low precision here but not low recall, so the threshold is set against recall.

### 3.2 Checking every agent claim against its evidence (GR-1)

TypeSafe's citation-check cookbook is close to a ready implementation of GR-1. Apply it to:
- every factual statement in an LLM-drafted zone (recitals, cover notes, the conflicts narrative in D10),
- every evidence pointer on a finding,
- every evidence pointer on an extracted obligation.

Pipeline: (1) code looks for the quote in the source after normalising whitespace and quote marks; no match means `fabricated`, the claim is stripped, and no model call is made. (2) A Jev Choice decides whether the cited section `supports`, `contradicts` or `says_nothing` about the claim. (3) Below the threshold, the claim renders grey (P4) and goes to the reviewer instead of showing as evidenced. In TypeSafe's worked example, all four accurate citations were verified at confidence 0.93 or higher, and all four planted failures were either caught or sent to review. That was eight citations against a technical standard; we need to repeat the test on fund documents before relying on it.

This changes GR-1 from "the LLM was told to cite" to "every citation was checked by a second, independent model that cannot generate text."

### 3.3 Prohibited-content classifiers (GR-3, DF-23, LRA-P0)

Follow the guardrails cookbook: a set of Nouls plus a severity Score, one request per piece of text, routed by named policies in code.

**Output checks** (on every LLM zone before it is stored):
- `legal_conclusion`: says whether a provision is enforceable, valid, compliant, advisable or market-standard in a jurisdiction
- `return_assurance`: promises or implies returns, liquidity or distributions
- `eligibility_determination`: decides whether a person is accredited, qualified or eligible
- `recommendation_to_party`: tells a GP, LP or counterparty what to do
- `severity`: Score, 0–3

**Input checks** (on GP comments, LP side-letter requests and anything typed into the GP Workspace):
- `seeks_legal_view`: routed to counsel as a structured question, not blocked
- `instruction_to_system`: treated as a DP-3 injection signal
- `seeks_assurance`: routed to review

Named policies per document class (for example `strict` for D9 and D10, `standard` for D1–D8) live in SVC-POLICY. The roughly 200-prompt elicitation set in §8.4 becomes the calibration set for these thresholds.

**Limit:** TypeSafe's own documentation lists adversarial content as a known weakness: injected instructions, or text that argues for its own classification, can move the answer. So these checks are **one layer, not the control**. The structural controls (no agent Q&A surface, the platform-rendered LRA-P0 banner, the counsel gate) remain the real defence.

### 3.4 Obligation and register extraction (LRA-07, DF-43, DF-44)

Use the pattern TypeSafe documents for extraction: **code or an LLM proposes candidates, Jev picks, code computes.**

| Field | Candidate source | Jev question | Code |
|---|---|---|---|
| Is this clause an obligation at all? | Clause tree | Noul | — |
| Obligation type | Closed list (reporting / fee / MFN / co-invest / transfer / notice / other) | Choice | — |
| Obligor and obligee | The vehicle's parties in the Fund Data Model | Choice over those parties | — |
| Trigger and frequency | Closed lists (quarterly, annually, on an event…) | Choice with a `not_stated` option | — |
| Dates | Date parts (month, day, year, relative anchor) | Choice per part, each with `not_stated` | Builds and compares dates |
| Amounts, percentages, thresholds | Regex candidates | Choice: which candidate is the value asked for | Normalises, validates, reconciles |
| Bespoke clause with no clean candidate | Generative LLM proposes | Jev checks the proposal against the clause (3.2) | — |

Confidence shapes the confirmation screen, not the gate. High-confidence fields arrive pre-filled with an evidence chip; low-confidence fields arrive grey and at the top of the queue. **INV-5 does not change:** nothing is published to SVC-BUS until a human sets `confirmed_by`. The gain is shorter review time and a measured error rate, not automated confirmation.

### 3.5 Template ingestion and the clause library (DF-01, DF-04, DF-05, DF-21)

- **Ingestion (DF-01).** After code splits a firm's Word master into blocks, Jev labels each block (heading, operative clause, definition, schedule, signature block), assigns a clause category using a Choice over our category tree, and decides for each regex-found candidate whether it is a slot or fixed text. A lawyer still approves the parsed structure (DF-02); Jev shortens setup and puts its least confident parses in front of that lawyer first.
- **How material a deviation is (DF-05).** After the deterministic diff, a Score (`cosmetic / drafting / substantive`) orders the changes so counsel sees substantive ones first. Code still lists every deviation in words, as Ops Console §8.2 requires; Jev only sorts them.
- **Clause picker (DF-21).** When a GP describes a side-letter request in plain words, re-rank clause-library candidates with one Noul per candidate ("does clause X address request R?"). TypeSafe's re-ranking cookbook on a legal retrieval benchmark raised top-10 accuracy from 38% to 62%. Every request met from the approved library is one less piece of agent-drafted text for counsel to review, which makes this the largest indirect quality gain in this proposal.

### 3.6 Term-sheet import (DF-11)

Most fund economics are choices from short lists: waterfall type (European / American / hybrid), hurdle basis (simple / compounded), catch-up (full / partial / none), fee base (commitments / invested capital / NAV). Ask these as Choices with a `not_stated` option. Numbers come from regex candidates, with Jev picking the right one and code checking ranges. The GP still confirms every field.

### 3.7 Tool 3 transfer-restriction check and LRA-14 drift

- **Transfer check.** Code extracts the facts of the transfer (transferee type, affiliate status, and the percentage, which code computes). One Noul per restriction clause: "Does clause `restrictions[i]` apply to the transfer described in `transfer`?" Code combines the answers, and any clause that may apply becomes a finding for counsel. Jev never answers "is this transfer permitted?": that is a legal conclusion, and a combined result.
- **Drift (LRA-14).** Compare the executed clause text with Tool 4's encoding. Categorical terms (waterfall type, catch-up style) are asked as Choices on the clause and compared with the encoding in code. Numeric terms use regex candidates plus span selection, compared in code. A mismatch raises an alert.

### 3.8 Review-quality controls (RQ-3, DF-36, DF-39)

- **Amendment reasons.** Lawyers pick a reason from the list and may add free text. A Choice over the same list, run on the free text, flags mismatches ("reason: drafting error; text describes a missing provision"). This helps spot template defects (DF-37) and gives cleaner eval cases.
- **Sampled review.** A Score of how substantive each counsel amendment was lets platform counsel weight its monthly sample towards rubber-stamping patterns. This is a metric only; decisions about lawyers stay with people (§7.3).

## 4. Architecture changes

### 4.1 New shared service: SVC-JUDGE

Tool 2 components should not call Jev directly. Add a shared platform service that Tools 1, 3 and 5 and the other agents can also use:

```
 Findings · Extraction · GR-3 · Ingestion · Clause picker · Drift
                         │  typed judgment requests
                         ▼
 ┌────────────────────────────── SVC-JUDGE ──────────────────────────────┐
 │ Question Registry   versioned question families (instructions,        │
 │                     criteria), reviewed by counsel like templates     │
 │ State Builder       clause-scoped state; defined terms inlined;       │
 │                     32k-token budget enforced; privilege check        │
 │ Threshold Policy    per family × document class, read from SVC-POLICY │
 │ Calibration Store   labelled sets and reliability curves per family   │
 │ Provider Adapter    Jev (pinned version) · fallback: route to human   │
 └────────────────────────────────┬──────────────────────────────────────┘
                                  │ full probabilities + model ID + question version
                                  ▼
                             SVC-LOG (GR-6)
```

### 4.2 Versioning and change control (GR-6, NFR-8)

- **Pin model versions.** TypeSafe's aliases (`jev-latest`) move when a new release ships, so answers can change with no change on our side. SVC-JUDGE must request a versioned ID (`jev-1.13.0`) and log the versioned ID returned with every answer.
- **A model upgrade is a policy change.** Moving to a new version means re-running the calibration sets and re-approving thresholds under NFR-8 dual control (Engineering and Compliance, plus counsel sign-off for GR-3 and findings families).
- **Question families are controlled artefacts.** Changes to wording are versioned, reviewed and eval-gated like prompts and templates. The registry also keeps a **list of prohibited questions**: no family may ask about enforceability, compliance, suitability or eligibility, because the answer would function as a legal conclusion even though it is a number.
- **Log the full probability distributions**, not only the chosen option, so DF-51 re-derivation and later threshold changes can be replayed against history.

### 4.3 Rules for building state (from Jev's documented limits)

| Jev limit | Rule in the State Builder |
|---|---|
| 32k tokens for state plus the longest question | State is always scoped to the relevant clauses, never a whole document. An LPA (roughly 60–120k tokens) is never sent whole. |
| Accuracy drops as irrelevant content grows | Only the clauses the question family needs, selected by code from the clause tree. |
| Multi-step indirection | Code resolves and inlines defined terms and internal cross-references. |
| Numbers, dates, counting | All arithmetic, date comparison and counting happen in code; Jev only picks candidates or date parts. |
| Literal reading | Criteria state what each option covers, what it doesn't, and examples; negated questions are avoided. |
| Consistency between question forms is not guaranteed | Thresholds are tuned per question family and never carried from a Noul to a Choice. |
| English is strongest | Launch jurisdictions are English-language; any non-English source text is flagged for human review. |

### 4.4 When Jev is unavailable (DF-52, GR-8)

If SVC-JUDGE is down, rate-limited or switched off, every judgment returns "uncertain". Findings become "unscreened — review all", extraction fields arrive grey, and GR-3 falls back to pattern filters plus mandatory human review of every LLM zone. The workflow keeps running at L0, as §7.4 requires. TypeSafe says its rate limits are currently changing without notice, so this path will be used in production, not only in drills.

## 5. Legal, privilege and vendor points

1. **Privilege partition (§13.2).** Jev is an external processor. TypeSafe states it does not train on customer requests or responses, and offers zero data retention (ZDR) to enterprise customers under a Data Processing Agreement. Counsel must decide whether partitioned content may be sent at all; if not, SVC-JUDGE refuses partitioned state and those items go to people. ZDR should be a contract precondition, not an optional upgrade.
2. **Data residency.** The documentation I reviewed does not say where requests are processed. We need that answer before onboarding EU or Singapore tenants (§11).
3. **Unauthorised practice of law (§13.1).** Jev's outputs are findings and sorting signals shown to counsel. They must never be shown to GPs or LPs as statements about a document's legal effect. The prohibited-question list (§4.2) is how this is enforced technically.
4. **Vendor maturity.** Young vendor, a single model family, and rate limits that are still moving. Mitigations: the provider adapter, pinned versions, a tested route-to-human fallback, and an enterprise agreement with committed limits before Phase C.
5. **Calibration does not transfer.** Jev is calibrated on TypeSafe's training data. Every threshold we use must be set on our own labelled fund documents; the thresholds in TypeSafe's examples (0.5, 0.8, 0.9) are only starting points.

## 6. Proposed spec changes

| Spec section | Change |
|---|---|
| §2 | Add **DF-P8** (three-way split). |
| §4.1 | Add SVC-JUDGE to the shared platform services; the Findings Engine, extraction and GR-3 call it. |
| §4.2 | Replace the table with the three-column version in §2 of this addendum. |
| §6.3 DF-20 | Contradiction candidates via a Choice per clause pair; suppression only above a floor proven on the recall set; deterministic findings never suppressed. |
| §6.3 DF-23 | GR-3 implemented as per-hazard Nouls plus a severity Score, with named policies per document class; documented as one layer, not the control. |
| §6.5 LRA-07 | Candidates from code or LLM → Jev picks → code computes; confidence orders the confirmation queue. |
| §6.1 DF-01, DF-05, DF-21 | Jev-assisted ingestion labelling, deviation ordering and clause re-ranking. |
| §8.4 | Add calibration evals: reliability curve per question family, accuracy of pre-filled fields, recall at the suppression floor. |
| §11 | ZDR, residency, and refusal of partitioned state in SVC-JUDGE. |
| §12 | DF-NFR-9: judgment requests under 500 ms at p95; fall back to "uncertain" on provider failure. |
| §14.1 | New acceptance criteria (below). |

New acceptance criteria:
- 100% of factual statements in LLM zones go through evidence checking (§3.2); no `fabricated` citation is ever shown as evidenced.
- For each question family used to suppress findings or pre-fill fields: calibration measured on at least 200 labelled items, expected calibration error reported, and recall of 0.95 or better at the suppression floor.
- Pre-filling of obligation fields is enabled only once high-confidence fields are at least 98% accurate on the labelled set.
- No question family in the registry matches the prohibited list; registry changes pass the eval suite before deployment.

## 7. Changes to the implementation plan

| Phase (spec §15) | Addition |
|---|---|
| **A (months 0–1)** | Two-week spike: label about 50 real side letters and 10 LPAs from design partners (with their consent and counsel sign-off on data use). Test three families: the MFN-interaction Choice, evidence checking, and the obligation-type Choice. Go/no-go on measured recall and calibration. Start enterprise, ZDR and DPA discussions with TypeSafe and get the residency answer. |
| **B (months 1–3)** | Build SVC-JUDGE (registry, state builder, threshold policy, adapter, logging). Run findings (3.1), evidence checking (3.2) and GR-3 checks (3.3) in shadow mode alongside the existing design and compare on the shadow documents. |
| **C (months 3–4)** | Extraction pipeline (3.4) behind INV-5; transfer-restriction check for Tool 3 (3.7). Enterprise agreement with committed rate limits signed. |
| **D (months 4–6)** | Clause re-ranking in the side-letter picker (3.5); amendment-reason checks (3.8); calibration charts in the factory health dashboard. |
| **E (months 6–12)** | Template ingestion assistance (3.5), term-sheet import (3.6), LRA-14 drift (3.7); assess reuse of SVC-JUDGE by Tools 1, 3 and 5. |

Team impact: about 0.5 extra FTE of ML engineering through Phase B for SVC-JUDGE, calibration tooling and labelling. Labelling time from design-partner counsel is the scarcer input.

## 8. Recommendation

Adopt Jev as the **judgment layer** behind a vendor-neutral SVC-JUDGE. Start with the three places where it strengthens existing controls rather than adding new capability: evidence checking (GR-1), contradiction and MFN findings (DF-20/22), and the GR-3 content checks. Together these move the spec's weakest assumption — that a generative model's self-reported confidence can gate anything — onto calibrated probabilities that are logged and can be replayed. Make adoption conditional on a Phase A spike measured on our own documents, a ZDR/DPA agreement, and counsel's decision on privileged content. Do not use Jev to shorten or bypass any human gate.

---

*This proposal is a product and engineering planning document, not legal advice. Statements about privilege, unauthorised practice of law and data protection are design assumptions for qualified counsel to confirm. Vendor facts (pricing, limits, data handling, benchmark results) are as published on docs.typesafe.ai on 23 September 2026 and should be re-checked before contracting.*
