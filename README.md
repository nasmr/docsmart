# docsmart

The Singularity **Document Factory** (Tool 2): a counsel-in-the-loop workflow that assembles fund documents for sponsors running a BVI segregated portfolio company, routes every draft to a qualified lawyer for clearance, and turns executed documents into structured records.

> **Status:** Pre-build. The repository currently holds the specification, architecture, build plan, portal design notes and first-pass document templates. No application code has been written yet; the first build milestone (M0) confirms the stack and template format.

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

## Repository layout

```
docs/          Specification, architecture, build plan, design notes, decisions
templates/     First-pass document templates (Word) and the script that generates them
apps/web/      Sponsor workspace, counsel review room, investor signing (not started)
services/api/  API and document state machine host (not started)
packages/      Shared building blocks: platform services, domain model, template
               library, assembly, checks, AI drafting (not started)
evals/         Test sets for checks and AI drafting (not started)
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
