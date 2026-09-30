# AI drafting

**Build plan block:** B8  
**Milestone:** M4  
**Status:** Not started

## What goes here

Drafts only in zones a template marks as AI-draftable, from facts the sponsor uploads; screens every drafted section for legal conclusions, return promises and eligibility statements (GR-3); checks every factual statement against its source (GR-1).

## Rules this code must hold

- One internal model interface for drafting and for judging claims, so a judgment model (see the Jev proposal) can be added later.
- With the AI switched off, zones stay empty and the workflow still works (DF-52).
- Every call is logged with model and prompt versions (GR-6).

## References

Spec DF-21, DF-23, DF-52; Jev proposal §3; build plan B8
