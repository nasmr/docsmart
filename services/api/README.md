# API service

**Build plan block:** B9 host (submission gate) and the API for all blocks  
**Milestone:** M1 onward  
**Status:** Not started

## What goes here

Hosts the document state machine and exposes the API the web app uses: umbrella and portfolio set-up, document creation, assembly, checks, dispositions, re-drafts, the submission gate and package download.

## Rules this code must hold

- The submission gate (build plan §4) is enforced here, not in the UI.
- All permissive transitions are logged with the actor and version hash.

## References

Build plan §4 and B9
