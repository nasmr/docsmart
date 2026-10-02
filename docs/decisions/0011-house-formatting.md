# 0011 House formatting for assembled documents

Status: Accepted
Date: 2 October 2026
Decided by: nas

## Context

Assembly (build plan B5) prints values from records and the calculation service into documents. Every document needs one way of writing dates, money, percentages and counts. Formatting is part of the content hash, so it must not depend on the machine or its locale. These are proposed defaults for the first slice. Counsel or the design partner's house style may replace any of them with a later decision.

## Decision

One fixed format, applied by `packages/assembly`, whatever the machine's locale. Records keep their stored form (decision 0005, field catalogue `types`); only printed text follows these rules.

| Type | Printed as | Examples |
|---|---|---|
| Date | Day without a leading zero, month in full, four-digit year | 1 October 2026 · 18 June 2024 |
| Time | 24-hour clock, with the UTC offset | 15:00 (UTC+04:00) |
| Money | ISO 4217 code, a space, then the amount with commas for thousands and a full stop for decimals. At least the currency's minor unit (two places for USD, none for JPY); more only when the record holds more. Never rounded. | USD 3,000,000.00 · USD 12.50 · USD 0.0125 · JPY 1,500 |
| Money range | Both ends in full, joined by “to” | USD 11.80 to USD 13.10 |
| Rate entered in the records | A percentage with no space before “%”, exactly as stored, trailing zeros dropped | 2% · 1.5% · 0.125% · 20% |
| Rate from the calculation service | A percentage to two decimal places, rounded half away from zero | 32.98% · 25.00% |
| Share count and other whole numbers | Commas for thousands | 400,000 · 7 · 45 |
| Enum value | The label in the field catalogue; without one, the value with underscores as spaces | semi-annually · private investment fund |
| Text, names, addresses, identifiers, countries | Exactly as recorded | Meridian Horizon SPC Limited |
| Content hash | Full lower-case hexadecimal | — |
| Boolean | Never printed; booleans only drive conditions | — |
| Items of an inline loop | A list: commas between items, “and” before the last | Amara Okafor, Henrik Solberg and Priya Raman |

A value that is missing is never printed as a blank. Assembly reports it as a missing slot (build plan B6).

## Why

- A fixed format keeps the hash stable: the same records always give the same text on any machine.
- ISO codes avoid the ambiguity of “$”, which several currencies use.
- Money comes exactly from records or the calculation service (CLAUDE.md), so formatting never rounds it.
- Rates in the records, such as fees, are legal terms and are printed as entered. A calculated rate, such as the markup on a sponsor-supplied asset (addendum §5), is shown to two places, the precision of `calc`'s rounding rule. This answers the open question on how the markup is displayed.

## Consequences

- `templates/fields/catalogue.json` gains display labels for enum values that underscores-as-spaces would print wrongly.
- The markup is printed to two decimal places; `calc` keeps six (0.329787 prints as 32.98%).
- Changing any rule changes the text, and so the hash, of every document assembled afterwards. Earlier versions are unaffected (INV-3).

## Open points

- Counsel or the design partner may prefer another style: “US$”, amounts without “.00”, or numbers also in words. Each would be a later decision.
