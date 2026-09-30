# Meridian Horizon SPC (invented fixture)

An invented BVI segregated portfolio company with three portfolios, for development, golden documents and demos. **Every name, number, address and account here is made up.** Addresses use "Example Road", emails use example.com and example.org, and identifiers start with `TEST-`.

Field names follow the `source` paths in `templates/fields/catalogue.json`. For example, `asset.sponsor_cost_per_share` comes from `Asset.gp_cost_basis_per_share`, which is `asset.gp_cost_basis_per_share` in `portfolios/atlas.json`.

## Files

| File | Holds |
|---|---|
| `umbrella.json` | The SPC: directors, authorised signatory, offering memorandum facts, administrator, cost-allocation rule |
| `sponsor.json` | The sponsor and the affiliate that sells Atlas's asset (catalogue gap G1) |
| `portfolios/*.json` | For each portfolio: `portfolio`, `terms`, `offer`, `asset` and `subscription_account` (gap G2) |
| `parties.json` | 44 investors: 30 individuals, 11 entities (including 2 corporate trustees), 3 who invest only in Lumen |
| `subscriptions/*.json` | Subscription requests with typed-in allocations (build plan B4) |
| `documents.json` | Inputs entered when each document is created, the template variant selection should pick, and the earlier Lumen agreements that D1SP-C refers to |

## Scenarios

| Portfolio | Asset | Templates | What it exercises |
|---|---|---|---|
| Lumen Segregated Portfolio | Primary Series B round, Lumenfold Optics, Inc. | D12-A, D13-A | M1 demo. Hurdle; costs deducted if the round lapses; 8 investors |
| Atlas Segregated Portfolio | Bought from the sponsor's affiliate (`gp_sourced`), Kestrel Grid Systems Limited | D12-B, D13-B, D1-SP ×41 | M3 demo. Conflict wording, interested director, effective date later than signing, sponsor keeps some shares, no hurdle, 41 subscription agreements |
| Atlas II Segregated Portfolio | Secondary purchase from unrelated holders, Tessellate Bio, Inc. | D12-C, D13-C | Board minutes with an interested director who abstains; placement fee; a name that nearly duplicates Atlas, for the cross-portfolio check |

### D1-SP variants for Atlas

- **D1SP-A:** the 27 individuals with no earlier agreement.
- **D1SP-B:** the 9 entities with no earlier agreement. Two are trustees (`is_trustee`) and one was formed to invest in Atlas (`formed_for_investment`).
- **D1SP-C:** 5 investors (`pty_002`, `pty_009`, `pty_017`, `pty_033`, `pty_035`), 3 individuals and 2 entities, who hold Lumen shares under an earlier agreement listed in `documents.json` → `executed`.

### Cross-portfolio traps

These are for the INV-10 check:

- `pty_042`, `pty_043` and `pty_044` invest only in Lumen. Their names must never appear in an Atlas or Atlas II document.
- "Atlas II Segregated Portfolio" nearly duplicates "Atlas Segregated Portfolio". A check that looks only for "Atlas" gives false positives; one that matches only exact names misses real leaks.
- Investor "Kestrel Coinvest Vehicle One Limited" shares a word with Atlas's issuer, Kestrel Grid Systems Limited.
- Individual "Chen Oyelaran" shares a surname with the entity "Oyelaran Partners LP".

## What the fixtures don't cover

- The umbrella is a regulated private investment fund whose offering memorandum requires related-party consent, so the unregulated and no-consent branches aren't exercised. A second umbrella would cover them.
- There are no Atlas II subscriptions.
- Calculated values (`asset.total_consideration`, `asset.markup_pct`, `subscription.shares`) are deliberately absent. They come from the calculation service (catalogue gap G9).
- Signing dates are absent, because they are filled at execution (gap G6).
- The affiliate's cost evidence is a placeholder reference with no file behind it.
- Allocations equal the amounts applied for. There is no oversubscription case yet.
