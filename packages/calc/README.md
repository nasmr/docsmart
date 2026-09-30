# Calculation service

**Decision:** 0005 item 7
**Milestone:** M1
**Status:** Not started

## What goes here

Pure functions that compute the figures documents need: total consideration, markup, shares to issue. They work on decimal strings with decimal.js, and every result carries an evidence record (function, version, inputs). That record is what the `calculated` origin in `templates/fields/catalogue.json` points to.

## Rules this code must hold

- No floating-point arithmetic on money, rates or share counts.
- Every result carries its evidence record; a calculated slot without one is a blocking finding (check case RQ-11).
- No model is ever called from here.

## References

CLAUDE.md (numbers); field catalogue gap G9; decision 0005
