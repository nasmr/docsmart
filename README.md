# docsmart

The Singularity **Document Factory** (Tool 2): a counsel-in-the-loop workflow that assembles fund documents for sponsors running a BVI segregated portfolio company, routes every draft to a qualified lawyer for clearance, and turns executed documents into structured records.

> **Status:** Pre-build (milestone M0). The stack is decided (`docs/decisions/` 0002, 0005 to 0007) and the workspace is set up, but no application code has been written yet. The canonical template format is still open until the M0 spike.

## Where to start

| If you want to… | Read |
|---|---|
| Understand what the product is and why | [`docs/spec/document-factory-spec-and-plan.md`](docs/spec/document-factory-spec-and-plan.md) §0–§2 |
| See how the pieces fit | [`docs/spec/architecture-and-lifecycle.html`](docs/spec/architecture-and-lifecycle.html) (open in a browser) |
| Know what is being built first | [`docs/spec/build-plan-drafting-to-submission.md`](docs/spec/build-plan-drafting-to-submission.md) |
| Understand the BVI SPC structure the product supports | [`docs/spec/bvi-spc-addendum.md`](docs/spec/bvi-spc-addendum.md) |
| See the documents the product will produce | [`templates/`](templates/) |
| Check what has been decided and what hasn't | [`docs/decisions/`](docs/decisions/) |

The full reading order and an index of every document is in [`docs/README.md`](docs/README.md).

## Development

You need nvm, Docker with Compose, and corepack (it ships with Node).

```
nvm use                  # Node 24, from .nvmrc
corepack enable          # provides pnpm at the version in package.json
pnpm install
cp .env.example .env
pnpm db:up               # Postgres 18 and SeaweedFS (S3), waits until healthy
pnpm build               # tsc -b over all packages
pnpm typecheck           # packages and the web app
pnpm test                # Vitest
pnpm lint                # Biome
pnpm --filter @docsmart/web run dev
pnpm db:down
```

Workspace conventions:

- Each package exports its TypeScript source under the `development` condition, so tests and the web app use source directly; `pnpm build` writes `dist/`.
- A package that depends on another adds it to `dependencies` as `"workspace:*"` and to `references` in its `tsconfig.json`.
- pnpm refuses versions published in the last day. Don't add exemptions to `pnpm-workspace.yaml`; widen the version range instead.
- `templates/generator` is a separate npm project and is not part of the workspace.

## Repository layout

```
docs/          Specification, architecture, build plan, design notes, decisions
templates/     First-pass document templates (Word) and the script that generates them
apps/web/      Sponsor workspace, counsel review room, investor signing (not started)
services/api/  API and document state machine host (not started)
packages/      Shared building blocks: platform services, domain model, template
               library, assembly, checks, AI drafting, calculation, shared schemas
               (not started)
infra/         Configuration for local services
evals/         Test sets for checks and AI drafting
fixtures/      Test documents and records; real design-partner material stays out of git
```

Each folder under `apps/`, `services/` and `packages/` has a README that says which building block from the build plan it holds, which requirements it implements and which milestone it belongs to.

## Principles that apply to all code here

1. **Numbers come from code, never from a model** (Agent Spec DP-1).
2. **No document is cleared without a named, verified lawyer**, enforced by the state machine, not the UI (Spec DF-P1).
3. **A document version, once created, is never changed**; every edit creates a new version (Spec INV-3).
4. **The contracting-party wording is generated from records and locked** (Addendum DF-P10).
5. **Nothing in a portfolio's documents may refer to another portfolio** (Addendum DF-P11).
6. **The product never gives legal advice.** AI output is a draft or a flag for counsel.

## Not legal advice

Everything in this repository is product and engineering material. Statements about law and regulation, and every template, are drafts for review by qualified BVI counsel.
