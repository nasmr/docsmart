# Calculation service

**Decision:** 0005 item 7
**Milestone:** M1
**Status:** Built for this slice: the three calculated fields in the field catalogue

## What goes here

Pure functions that compute the figures documents need: total consideration, markup, shares to issue. They work on decimal strings with decimal.js, and every result carries an evidence record (function, version, inputs). That record is what the `calculated` origin in `templates/fields/catalogue.json` points to.

## Calculations

| Catalogue field | Function | Rule | Rounding |
|---|---|---|---|
| `asset.total_consideration` | `totalConsideration` | quantity × price per share | None: exact, keeping the price's decimal places |
| `asset.markup_pct` | `markup` | (price − cost) ÷ cost, as a fraction | Six decimal places, half away from zero. Negative when the price is below cost. |
| `subscription.shares` | `sharesToIssue` | allocated amount ÷ subscription price | Down to a whole share (D13 §6.3: fractions are not issued) |

`calculatedFields` maps each field to its function and to the catalogue fields that feed it. `subscription.allocated_amount` is calculated in the data model but typed in during this slice (gap G10), so it is listed in `notYetCalculated` instead.

Every result is `{ value, evidence }`. The evidence names the calculation and its version, copies the inputs and the output, and records any rounding. It has no timestamp, so the same inputs always give the same evidence.

Inputs are checked strictly, and a bad input throws a `CalcError` naming it:

- Amounts are plain decimal strings: no exponent, separators or JavaScript numbers.
- Currencies are ISO 4217 codes, and amounts in different currencies are never combined.
- Share counts are positive safe integers.
- Dividing by zero is refused.

The package uses its own decimal.js configuration, so changes to decimal.js's global settings elsewhere cannot affect a result.

## Tests

`pnpm test` runs 78 tests:

- Exact values for each calculation. They were checked independently with Python's decimal module, and include the cases where floating point gets it wrong.
- Every rejected input form.
- Catalogue checks: every calculated field has a calculation, and every input has the type the calculation expects.
- The calculations run on the Meridian Horizon fixtures.
- 6,000 seeded random cases compared with a separate BigInt implementation.

## Rules this code must hold

- No floating-point arithmetic on money, rates or share counts.
- Every result carries its evidence record; a calculated slot without one is a blocking finding (check case RQ-11).
- No model is ever called from here.

## References

CLAUDE.md (numbers); field catalogue gap G9; decision 0005
