# 0008 Canonical template format: our own clause tree

Status: Accepted
Date: 1 October 2026
Decided by: nas

## Context

0002 proposed our own clause-tree JSON as the canonical template format, with an M0 spike to test Accord Project TemplateMark instead. The spike is in `spikes/template-format/`; its README has the method and results.

The spike's first pass rejected TemplateMark mainly because it seemed unable to express the first-pass templates without executable code in them. A validation pass re-tested every finding by generating documents through the Accord template engine and by porting two templates end to end (`spikes/template-format/validation/RESULTS.md`). It showed that reason was wrong: D12-B and D13-B can be written in TemplateMark with no code, and the output matches. The decision is the same, but it now rests on the reasons below.

## Decision

- **Format.** Templates and draft versions are stored as our own clause tree:
  - blocks (heading, clause, paragraph, table, AI zone, locked designation, counsel note), each with a stable id
  - `if` and `each` wrapping blocks, inline text, or table rows
  - fields as named slots

  The content hash is SHA-256 over RFC 8785 JSON (0005).
- **Word import and export.** Word is the format for import and export only.
  - The renderer (0006) writes each block's id into Word as a hidden bookmark, and the importer reads it back.
  - Blocks without a bookmark are matched against the previous version by text, so ids survive counsel's edits.
- **No TemplateMark, no Concerto.** Slot types come from the field catalogue (`templates/fields/catalogue.json`) and are expressed as Zod schemas (0005). Concerto, which build plan §7 names as the candidate for slot types, is not adopted.
- **Templates are data, and the importer enforces it.** The format never contains executable code, and nothing evaluates a template beyond the rules here. An import fails unless all of these hold:
  - Every condition and every loop filter matches one closed form: a field path, optionally `= value` for an enum, optionally a leading `any` for a test over a list. `ELSE` gives the negative.
  - Every field path is in the field catalogue, and every enum value is one the catalogue lists for that field.
  - Every loop variable is used only inside the loop that binds it.
  - The text of a locked designation equals the wording generated from the umbrella and portfolio records (INV-9).

## Why

- **Stable ids on every block.** Checks, diffs, the cross-portfolio match and counsel's edits all depend on them. TemplateMark gives an id only to a `{{#clause x}}` whose name is a property of the data model, and such a clause can then reach no field outside that property. It rejects an id on a paragraph or heading. In the two ported templates, 2 of 46 and 3 of 67 blocks could carry one.
- **Word is our own code either way.** No maintained Accord package reads or writes Word. With TemplateMark we would also have to map Word onto a markdown form that has no conditions around several paragraphs and no loops over table rows, both of which the first-pass templates use.
- **TemplateMark's markdown form prints wrong text with no error.** For a legal document that is worse than failing. Each of these generated a document:
  - a condition spanning two paragraphs printed the excluded paragraph and the literal `{{/if}}`
  - a loop filter was ignored, so every director was recorded as having declared an interest
  - a dotted field name, right or misspelt, printed its braces
  - an inline list of records printed `[object Object]`
- **Counsel should see the rule they clear.** Without code, TemplateMark needs a field added by our code for each enum test, each filter and each condition that has a field inside it (5 for D12-B, 7 for D13-B). The test itself, such as `fund_category = private_investment_fund`, then lives in our code and not in the template counsel reviews. The clause tree keeps it in the template.
- **Code in a TemplateMark template is executed without a sandbox.** That conflicts with DP-3. It can be switched off and rejected by a check, so this is a cost and not a bar. With code allowed, this engine version also prints quote marks around every formula result.
- **Weight.** The engine brings 331 packages, including the TypeScript compiler and six AI SDKs. The parser alone is 72.
- **The clause tree met the first three criteria on all nine templates.** It imported them exactly, hashed deterministically, survived a full Word round trip, and kept clause ids through rewording, insertion, pasting, deletion, moving and renumbering.

What we give up: type checking of fields when a template is parsed, validation of data against a model, a maintained parser and engine, and an external standard. The first two are replaced by the import rules above and the Zod slot schemas.

Alternative not tested: storing TemplateMark's parsed JSON, not its markdown, with our own Word importer and the engine used only to render with code switched off. The engine does handle a field inside a condition when the JSON is built directly. It was not pursued because a paragraph or heading still could not carry an id, we would have to write the type checker that the markdown parser provides, and we would depend on engine behaviour we do not control. If working with other Accord tooling becomes a requirement, revisit it with a new decision.

## Consequences

- The importer has to handle what firms' Word masters contain and the first-pass templates don't: automatic numbering, heading styles and tracked changes. This is needed before the design partner's masters arrive.
- The template generator should move to Word heading styles and automatic numbering, so the first-pass templates exercise the same import path as a firm's master.
- The import rules in the decision are M1 work. The spike's importer applies none of them: conditions are free strings, and the locked text is read as written.
- D12-C will fail import until it is fixed. It uses `{{director.name}}` and `{{director.interest_description}}` under `[[IF any director.is_interested]]`, outside any loop.
- `packages/template-library` owns the format, the importer, the import rules and the id matching. `packages/assembly` owns the renderer.
- Resolves the template format open point in 0005. Build plan 0.2 is updated to match: B2, B3 and B5 in §3, the milestones in §5, the tests in §6, the choices in §7 and the risks in §9.

## Open points

- Test the importer on the design partner's real masters (build plan M0 fixture collection).
- Confirm with real Word (or LibreOffice) editing that bookmarks behave as the simulated edits assume.
- Tune the 0.6 text-similarity threshold for id matching on real edits.
