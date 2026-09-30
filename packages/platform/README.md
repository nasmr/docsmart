# Platform services

**Build plan block:** B1  
**Milestone:** M0 (thin), M1  
**Status:** Not started

## What goes here

Minimal versions of the shared services from the agent spec: audit log (SVC-LOG), evidence store (SVC-EVID), policy store (SVC-POLICY), and a stub of the shared identity module (parties and consent grants).

## Rules this code must hold

- Every other package writes audit rows through this one; nothing writes them directly.
- Evidence is content-addressed (SHA-256).
- Policy (template-selection rules, check severities) changes only through a reviewed change.

## References

Agent spec §1.2; build plan B1; spec DF-50
