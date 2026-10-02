# Template library

**Build plan block:** B3  
**Milestone:** M1 (D12), M3 (D13, D1-SP)  
**Decisions:** 0008 (format), 0010 (Word libraries, tracked changes)  
**Status:** Built for this slice: format, Word import, import rules, clause ids, approval and selection

## What goes here

Imports a counsel Word master into a clause tree with stable clause IDs, a slot schema and a map of AI-draftable zones; records the approving lawyer; selects the approved template version by jurisdiction, entity type, document class and scope.

## What's here

| Module | Holds |
|---|---|
| `format.ts` | The clause tree (decision 0008): blocks with stable ids, `if` and `each` around blocks, text or table rows, fields as slots. A structural schema, and the content hash (SHA-256 over RFC 8785). |
| `conditions.ts` | The only expressions a template may contain: `field`, `field = value`, `any alias.field`. A flat evaluator for selection rules. |
| `rules.ts` | The import rules: closed-form conditions, fields and enum values in the field catalogue, loop variables only inside their loop, locked wording exactly the generated designation. Each problem names the block. |
| `word/` | Word → clause tree. Reads heading styles, automatic numbering (as Word shows it), bookmarks, and text inside hyperlinks, fields and content controls. Refuses tracked changes (decision 0010), nested tables, unbalanced markup and stray `[[…]]`, naming each place. |
| `ids.ts` | After a re-import, matches against the previous version: a pasted copy gives the id back to the original, and a block that lost its bookmark takes its old id when the text is close enough (word overlap ≥ 0.6). Reports what was kept, recovered, added and removed. |
| `approval.ts` | Approval by a verified lawyer admitted in every jurisdiction of the template, bound to the content hash and refused if any import rule fails. A later version supersedes, without retiring, the earlier one. |
| `selection.ts` | Selection rules (policy) pick exactly one current approved version, or refuse with a reason. |

Writing Word files, and the ids as bookmarks, belongs to `packages/assembly` (decision 0006).

The clause tree's `if` blocks have `then` and `else` branches. Biome's `noThenProperty` rule, which guards against objects being mistaken for promises, is switched off for this package and `packages/assembly` in `biome.json`. The branches are arrays, never functions, so `await` never treats a block as a promise.

## The first-pass templates

All nine import and pass the import rules. They use Word heading styles and automatic numbering, as a firm's master would (build plan M1).

The importer and rules first found three drafting problems, since fixed in the generator: D12-C's declarations of interest, D1SP-B's `[[…]]` placeholder, and the label inside D13's locked wording. See `templates/fields/README.md`.

Where a condition offers alternative clauses, Word numbers both (D12 section 3 shows 3.1 and 3.2). Assembly renumbers after it evaluates the conditions.

## Tests

`pnpm exec vitest run packages/template-library` runs 114 tests:

- All nine first-pass templates come back with every field, condition, loop, zone and locked wording, with the same nesting, compared with `templates/fields/usage.json`. Each also imports deterministically, and passes the import rules.
- Word features are tested on files built with the `docx` library: heading styles, multi-level numbering with letters and Roman numerals, restarts, bullets, hyperlinks, bookmarks and tracked changes.
- Each import rule is tested in both directions.
- Clause ids are tested under every kind of counsel edit.
- Approval refusals are tested.
- Selection is tested against the Meridian Horizon fixtures. Every document picks the variant `documents.json` expects, and the 41 Atlas subscription agreements split 27, 9 and 5.

Twelve deliberately planted bugs were each caught, or turned out to be guarded twice.

## Rules this code must hold

- Only approved, unretired template versions can be selected (DF-P2).
- Parses the markup conventions in templates/README.md.

## References

Spec §6.1 (DF-01 to DF-05); build plan B3; decision 0002 (template format)
