# 0008 Canonical template format: our own clause tree

Status: Proposed
Date: 1 October 2026
Decided by: (nas)

## Context

0002 proposed our own clause-tree JSON as the canonical template format, with an M0 spike to test Accord Project TemplateMark instead. The spike is in `spikes/template-format/`; its README has the method and results.

## Decision (proposed)

- **Format.** Templates and draft versions are stored as our own clause tree:
  - blocks (heading, clause, paragraph, table, AI zone, locked designation, counsel note), each with a stable id
  - `if` and `each` wrapping blocks, inline text, or table rows
  - fields as named slots

  The content hash is SHA-256 over RFC 8785 JSON (0005).
- **Word import and export.** Word is the format for import and export only.
  - The renderer (0006) writes each block's id into Word as a hidden bookmark, and the importer reads it back.
  - Blocks without a bookmark are matched against the previous version by text, so ids survive counsel's edits.
- **No TemplateMark, no Concerto.** Slot types come from the field catalogue (`templates/fields/catalogue.json`) and are expressed as Zod schemas (0005). Concerto is not adopted for slot types, contrary to 0002's suggestion.
- **Templates are data.** The format has no expressions beyond field names, `field = value` conditions and `WHERE` filters on loops. It never contains executable code.

## Why

- TemplateMark could not express the first-pass templates:
  - no field inside a condition, which the templates do 41 times
  - no enum conditions or loop filters without embedded TypeScript formulas
  - no general clause ids
  - a mistyped nested field silently becomes plain text
- Its workarounds make templates executable, which conflicts with DP-3. Its engine also brings in a large dependency tree, including AI SDKs and the TypeScript compiler.
- The clause tree imported all nine first-pass templates exactly, hashed deterministically, survived a full Word round trip, and kept clause ids through rewording, insertion, pasting, deletion, moving and renumbering.

## Consequences

- The importer has to handle what firms' Word masters contain and the first-pass templates don't: automatic numbering, heading styles and tracked changes. This is needed before the design partner's masters arrive.
- The template generator should move to Word heading styles and automatic numbering, so the first-pass templates exercise the same import path as a firm's master.
- `packages/template-library` owns the format, the importer and the id matching. `packages/assembly` owns the renderer.

## Open points

- Test the importer on the design partner's real masters (build plan M0 fixture collection).
- Confirm with real Word (or LibreOffice) editing that bookmarks behave as the simulated edits assume.
