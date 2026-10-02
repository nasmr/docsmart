# Field catalogue

Every field, condition flag, list and AI-drafted zone used by the first-pass templates, with its type, the entity it comes from and how it gets its value. It is the proposed input to the data model (build plan B2), the sponsor forms (B4) and the slot schema (B3).

| File | What it is |
|---|---|
| `catalogue.json` | The catalogue. Edited by hand. |
| `usage.md` | Which templates use each field, and under which condition. Generated; do not edit. |
| `usage.json` | The same records as data: every field, condition, list, zone and locked wording in each template, with the conditions and loops around it. Generated; the template importer's tests compare against it. |

## Keeping it in step with the templates

```
cd templates/generator
npm run fields        # check, and rewrite usage.md and usage.json
npm run fields:check  # check, and fail if either is out of date
```

The check fails if a template uses a field, list, zone or condition value the catalogue lacks, or if the catalogue lists something no template uses. It also reports template issues (below) without failing.

## Origins

Each field has one origin, which says who or what provides its value:

- **record**: typed on the sponsor forms and stored on an entity
- **document**: typed when the document is created
- **calculated**: from the calculation service, never typed and never from a model
- **derived**: worked out by a fixed rule
- **platform**: hashes, identity references and links to other documents
- **external**: a verified third-party record
- **execution**: known only at signing

`usage.md` has the counts.

## Gaps found

These came up while building the catalogue. Each needs a decision before the build step shown. G9 has since been resolved by decision 0005.

| # | Gap | Affects | Needs |
|---|---|---|---|
| G1 | `sponsor.legal_name` is used (D12-B), but the data model has no `Sponsor` entity. The addendum talks about the GP and affiliates without modelling them. The catalogue proposes a `Sponsor` entity with affiliates, which the `gp_sourced` seller also needs. | B2 | Engineering |
| G2 | Payment details (`payment.*`) come from the administrator's verified record, but no entity holds them. The catalogue proposes `SubscriptionAccount` per portfolio, plus a per-investor payment reference on `SubscriptionRequest`. | B2, B4 | Engineering; administrator |
| G3 | D1SP-C names the investor's earlier portfolio (`investor.existing_portfolio_name`). The cross-portfolio check (INV-10, DF-P11) blocks any other portfolio's name, so every D1SP-C would fail the gate. It needs either a narrow, explicit exception or a different wording. | B6, gate | Spec owner; BVI counsel |
| G4 | D12-B, D13-B and the D1-SP conflict acknowledgement refer to the conflict disclosure statement (D15) and its date. D15 is scheduled for R2, not this slice. | Slice scope | Founder |
| G5 | `company_signatory.*` is used without a loop, so something must choose which authorised signatory countersigns. The catalogue assumes the sponsor chooses when the document is created. | B4, B5 | Engineering |
| G6 | Five fields are known only at signing (`*.signed_date`, `subscription.accepted_date`, `meeting.minutes_signed_date`), and `resolution.date` may be too. The gate's condition 2, "every required slot is filled" (build plan §4), must exclude them, or no document could pass. | B6, B9 | Engineering |
| G7 | Fields that fit no entity in the addendum: `Offer.minimum_close_amount`, `Offer.funding_deadline`, the per-transaction director interests (held on the document, not the director), and `formed_for_investment` (held on the subscription, because it is specific to the portfolio). | B2 | Engineering |
| G8 | D12-A says the asset is bought "from `{{asset.seller_name}}`" even for a primary round, where the seller is the issuer. The fixtures set the seller to the issuer; counsel may prefer different wording. | Template | BVI counsel |
| G9 | Three values are calculated: `asset.total_consideration`, `asset.markup_pct` and `subscription.shares`. D12 needs `total_consideration` in M1. The build plan has no block for the calculation service (SVC-CALC), and CLAUDE.md says numbers come only from records or that service. **Resolved for this slice by decision 0005:** a `packages/calc` package. | Build plan | Engineering (done) |
| G10 | `subscription.allocated_amount` is a calculated value in the data model, but build plan B4 has it typed in for this slice. The catalogue records it as calculated and notes the exception. | B4 | None (noted) |
| G11 | D1-SP needs a frozen U3 (subscription terms version and hash), but U3 isn't drafted (decision 0004). This slice also ends at `READY_FOR_SUBMISSION`, not `CLEARED`, so the "required state" for referenced U3 and D13 versions (gate condition 8) needs defining. | B5, B9 | Founder; counsel |

## Template issues

`npm run fields` lists drafting problems in the templates at the end of `usage.md`. There are none at present. Three found earlier were fixed in the generator on 2 October 2026:

- **D12-C, declarations of interest:** it used `[[IF any director.is_interested]]` with `{{director.name}}` outside a loop. It now loops over `meeting.attendees` where a director is interested. A new derived field, `resolution.interest_declared`, chooses between the declarations and the confirmation that there are none.
- **D1SP-B, clause 6.3:** a `[[Counsel wording …]]` placeholder is now a counsel note.
- **D13, the issuer designation:** the label “Issuer” is now a separate paragraph above the locked wording, which holds exactly the designation (decision 0008).

`guide.js` still has its own copy of the field descriptions. It should read them from `catalogue.json` once the catalogue is agreed, so there is one source.
