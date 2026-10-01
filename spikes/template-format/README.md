# Spike: canonical template format

Milestone M0 spike (build plan §5, decision 0002). Throwaway code; the results and the recommendation are what matter. Run on 1 October 2026 against the nine first-pass templates.

**Question.** Should templates be stored as our own clause-tree JSON, or as Accord Project TemplateMark? Word stays the import and export format either way.

**Recommendation: our own clause tree.** It passed every test. TemplateMark cannot express the first-pass templates without embedding executable code in them. See decision 0008 (proposed).

## Pass criteria

1. Expresses everything the templates use: nested fields, conditions (boolean and enum), filtered loops, a field inside a condition, AI zones, the locked designation, counsel notes.
2. Gives every clause a stable id that survives the edits counsel makes in Word.
3. Imports the Word masters without losing structure, and the same file always gives the same content hash.
4. Keeps templates as data, never code (DP-3: uploaded documents are data, never instructions).

## Results

### TemplateMark (`@accordproject/markdown-template` 1.1, `concerto-core` 5.0)

`src/templatemark-probe.ts` and `src/templatemark-probe2.ts` try each feature on its own. 6 of the 14 probes parsed.

| Feature | Result |
|---|---|
| Nested field `{{umbrella.legal_name}}` | Parses, but as plain text. No variable is created and no error is raised, so a mistyped field goes unnoticed. Nested fields work only inside `{{#with umbrella}}…{{/with}}`. |
| Field inside a condition (`hurdle_rate` under `has_hurdle`) | **Fails** ("Unknown property") in both block and inline form. The first-pass templates do this 41 times, with 24 different fields. |
| Boolean condition with else, as a block | Works. |
| Enum condition (`acquisition_source = gp_sourced`) | **Fails.** Needs a TypeScript formula. The templates use 11. |
| Loop | Works as a bulleted list or an inline join. |
| Loop filter (`WHERE director.is_interested`) | **Fails.** Needs a TypeScript formula. |
| Clause ids | Only for `{{#clause x}}`, and `x` must be a property in the data model. There is no general way to give every clause an id. |
| AI zone, locked designation | Only by convention (a clause for the zone, a formula for the designation). Nothing stops the locked text being edited. |
| Counsel note | Survives as an HTML comment. |
| Our entity name `Asset` | Clashes with a Concerto built-in type. |

Other findings:

- The workarounds are TypeScript formulas embedded in the template, which `@accordproject/template-engine` compiles at run time (it depends on the TypeScript compiler). Templates arrive from outside counsel, so that would make untrusted documents executable.
- Installing the Accord packages, with four small libraries alongside, added 344 packages. They include the Google and OpenRouter AI SDKs, pulled in through `cicero-core`, whose install scripts pnpm blocked. That is a large supply-chain surface for a parser.

**TemplateMark fails criteria 1, 2 and 4.**

### Own clause tree

The format is in `src/tree.ts`:

- blocks (heading, clause, paragraph, table, zone, locked, note) each carry an id
- `if` and `each` wrap blocks, inline text, or table rows
- the hash is SHA-256 over RFC 8785 JSON (decision 0005)

| Test | Script | Result |
|---|---|---|
| Import all 9 first-pass Word files. Every field, condition, list, zone, locked designation and placeholder comes back with the same nesting the generator wrote (487 records). | `check-import.ts` | 9 of 9 pass |
| Importing the same file twice gives the same hash | `check-import.ts` | 9 of 9 pass |
| Tree → Word → tree gives the identical hash | `check-ids.ts` | 9 of 9 pass |
| Ids travel as Word bookmarks, not recomputed from text: arbitrary ids survive the trip | `check-ids.ts` | 9 of 9 pass |
| Counsel rewords a clause: it keeps its id, and no other id changes | `check-ids.ts` | pass |
| Counsel inserts a clause: one new id, none lost | `check-ids.ts` | pass |
| Counsel pastes a copy (duplicate bookmark): no duplicate ids | `check-ids.ts` | pass |
| Copy pasted *above* the original: on import alone the copy takes the id; matching against the previous version gives it back | `check-ids.ts` | pass (needs the previous version) |
| Counsel deletes, moves or renumbers clauses: the other ids are unchanged | `check-ids.ts` | pass |
| Bookmark lost and the clause reworded: matching against the previous version recovers the id | `check-ids.ts` | pass |
| Clause rewritten beyond recognition: treated as a deletion plus an insertion | `check-ids.ts` | pass |

**The clause tree passes all four criteria** on the first-pass templates.

How ids work:

- Every block's id is written into Word as a hidden bookmark (`dsc_<id>`) and read back on import.
- A block with no bookmark gets an id derived from its content.
- After import, the new version is matched against the previous one:
  - Where a pasted copy carries a duplicate bookmark, the block closest to the previous text keeps the id.
  - A block that lost its bookmark takes the id of a vanished block whose text is close enough (word overlap ≥ 0.6).

## Limits of this spike

These are the things to test next. None of them favours TemplateMark.

- **The edits were simulated** by changing the Word XML, not made in Word. There's no LibreOffice or Word here. Real Word may treat bookmarks differently on cut and paste, and may split or merge them. The importer joins all runs in a paragraph before reading tokens, so Word splitting `{{…}}` across runs is handled.
- **Tracked changes are not handled.** Text inside `w:ins` and `w:del` is ignored. Counsel's masters must have changes accepted before import, or the importer must learn to read them.
- **Only our own generated files were imported.** A firm's Word master will differ:
  - Clause numbers are usually Word automatic numbering, not typed text as in the first-pass templates.
  - Headings use Word styles rather than direct formatting.

  The importer needs both before the design partner's masters arrive. It is worth changing the generator to use Word heading styles and automatic numbering now, so the first-pass templates exercise that path.
- **The paragraph styles are coarse** (title, subtitle, body, bullet, check, signature). Emphasis such as a bold signature label is not kept in the canonical content, so the renderer's style sheet has to supply it.
- **The 0.6 similarity threshold was chosen by hand.** Tune it on real edits.

## Running it

The spike is kept out of the pnpm workspace so the Accord packages and their AI SDKs are not installed for everyone. It has its own install, with install scripts disabled:

```
pnpm install                          # at the repository root first (TypeScript, Node types)
cd spikes/template-format
npm install --ignore-scripts          # the spike's own dependencies
node src/templatemark-probe.ts    # TemplateMark feature probes
node src/templatemark-probe2.ts   # fairer retries of the failures
node src/check-import.ts          # Word → tree, against the generator's records
node src/check-ids.ts             # tree → Word → tree, and clause ids under counsel edits
../../node_modules/.bin/tsc -p .  # typecheck
```

The checks import the committed files in `templates/first-pass/` and load the generator from `templates/generator`, which needs its own `npm install` there.
