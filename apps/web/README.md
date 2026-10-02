# Web app

**Build plan block:** B4 and B7  
**Milestone:** M1 onward  
**Status:** M1 sponsor workspace: record forms, document assembly, document view, submission gate

## What goes here

The sponsor workspace: data entry for the umbrella, portfolios, assets and investors; document view with provenance styling; checks panel; version history; submission gate. Counsel and investor surfaces come in later slices.

## Running it

`pnpm db:up && pnpm db:migrate && pnpm db:seed`, then `pnpm api` and `pnpm web` in two terminals, and open http://localhost:5173. The browser calls `/api` on the Vite server, which forwards to the API (no CORS), with the development token `VITE_DEV_TOKEN` from `.env`.

## Rules this code must hold

- The "not legal advice" banner is rendered by the platform on every unexecuted document view.
- The contracting-party strip is never editable.
- Follows Ops Console principles P1 to P7 and the portal design in docs/design.

## References

Spec §9.1; build plan B4 and B7; docs/design
