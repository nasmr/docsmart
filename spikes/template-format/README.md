# Spike: canonical template format

Milestone M0 spike (build plan §5, decision 0002). Throwaway code; the results and the recommendation are what matter. Run on 1 October 2026 against the nine first-pass templates.

The TemplateMark results below were re-tested the same day, and this README was corrected to match. The first pass only parsed templates and several of its probes were wrong. The plan and the full results are in `validation/PLAN.md` and `validation/RESULTS.md`.

**Question.** Should templates be stored as our own clause-tree JSON, or as Accord Project TemplateMark? Word stays the import and export format either way.

**Recommendation: our own clause tree.** TemplateMark can express the two templates we ported without any code in them. It still fails: it cannot give every clause a stable id, it has no Word path, and its markdown form prints wrong text with no error in several cases. See decision 0008 (accepted).

## Pass criteria

1. Expresses everything the templates use: nested fields, conditions (boolean and enum), filtered loops, a field inside a condition, AI zones, the locked designation, counsel notes.
2. Gives every clause a stable id that survives the edits counsel makes in Word.
3. Imports the Word masters without losing structure, and the same file always gives the same content hash.
4. Keeps templates as data, never code (DP-3: uploaded documents are data, never instructions).

## Results

### TemplateMark (`@accordproject/markdown-template` 1.1, `template-engine` 5.1, `concerto-core` 5.0)

These are the latest published versions.

**How it was tested.**

- First pass: `src/templatemark-probe.ts` and `src/templatemark-probe2.ts` hold 19 probes that only parse. 9 parsed. Six of the 10 errors were mistakes in the probes, not limits of TemplateMark. The two scripts are kept as the record of the first pass. Do not rely on their output.
- Validation: the scripts in `src/validation/` parse each case, generate it through the template engine with data, and compare the text with what was expected. The table below reports those results.

| Feature | Result |
|---|---|
| Nested field `{{umbrella.legal_name}}` | **Fails silently.** No variable is created and no error is raised. The literal `{{umbrella.legal_name}}` is printed in the generated document. A misspelt dotted path does the same. Nested fields work inside `{{#with umbrella}}` or `{{#clause umbrella}}`, and a misspelt plain field there is caught. |
| Field inside a condition (`hurdle_rate` under `has_hurdle`) | **Fails** ("Unknown property") in every `{{#if}}` form. The first-pass templates do this 41 times, with 24 different fields. It works without code through `{{#optional}}` or `{{#clause}}` over an optional value that our code supplies. |
| Boolean condition with else | Works only when the whole condition fits in one paragraph. With more than one paragraph, the later paragraphs are printed even when the condition is false, and `{{/if}}` appears in the text. No error is raised. A nested `{{#if}}` does not parse. A condition around several paragraphs needs `{{#clause}}` over an optional value. |
| Enum condition (`acquisition_source = gp_sourced`) | No form without code. With code it works as `{{#if asset condition="return …"}}`. Without code it works as a Boolean that our code derives for each test. The templates use 11, with 4 distinct tests. |
| Loop | `ulist` and `olist` work. `join` works only over plain values; over records it prints `[object Object]`. Items with several paragraphs (signature blocks) work only as list items; otherwise the extra paragraphs are dropped with no error. No loop can produce table rows, which D1SP-B and D12-C need. |
| Loop filter (`WHERE director.is_interested`) | **Fails silently.** `where=` is accepted and ignored, so every director is printed as having declared an interest. It works without code as a list our code filters first. |
| Clause ids | Only for `{{#clause x}}`, and `x` must be a property in the data model. A property per clause cuts the clause off from every other field. An `id` on a paragraph or heading is rejected. An id in an HTML comment survives, but only as a separate node beside the clause. There is no general way to give every clause an id. |
| AI zone, locked designation | Only by convention (a clause for the zone; the designation supplied as data). Nothing stops the locked text being edited. The same is true of the clause tree until our own code checks it. |
| Counsel note | Survives as an HTML comment and can be stripped reliably at assembly. |
| Our entity name `Asset` | Clashes with a Concerto built-in type, as do `Participant`, `Transaction`, `Event` and `Concept`. Renaming the type fixes it. |

**Two templates ported end to end** (`src/validation/fairness-ports.ts`). D12-B and D13-B were each written twice: once with no code, and once with code allowed. The output was compared with the clause tree rendered from the same fixture data, and again with every condition reversed.

| Port | Code in the template | Fields our code must add | Text against the clause tree | Clauses that can carry an id |
|---|---|---|---|---|
| D12-B, no code | none | 5 | matches | 2 of 46 |
| D12-B, code allowed | 7 places | 0 | differs | 2 of 46 |
| D13-B, no code | none | 7 | matches | 3 of 67 |
| D13-B, code allowed | 7 places | 2 | differs | 5 of 67 |

- **Without code, the text is right.** The cost is that each condition's rule moves out of the template into our code. Counsel sees a name such as `pif_investor_basis`, not the test `fund_category = private_investment_fund`.
- **With code, the text is wrong.** This engine version puts quote marks around every string a formula returns, and a formula inside a condition fails.

Other findings:

- **Code in a template is executed.** Formulas and `condition=` attributes are compiled with the TypeScript compiler and run with `new Function`, in the host process or in a child process. Neither is a sandbox. Parsing alone runs nothing. Setting `disableJavaScriptEvaluation` blocks all of it, and a check over the parsed template can reject the four places code can sit.
- **Dependencies.** The parser alone (`markdown-template` and `concerto-core`) is 72 packages. Adding `template-engine` makes 331, including the TypeScript compiler and six AI SDKs (Google, OpenRouter, OpenAI, Anthropic, Mistral, Groq), which are its optional dependencies. This spike as declared installs 348. Four packages carry install scripts, so the spike installs with scripts disabled.
- **Word.** No maintained Accord package reads or writes Word. The deprecated `markdown-docx` lost every table, field and condition on D12-B and D13-B.

**TemplateMark fails criteria 2 and 3.** It meets criterion 1 for D12-B and D13-B only with fields added by our code, and it cannot loop table rows. It meets criterion 4 only if we enforce templates without code.

What TemplateMark would give us that the clause tree does not: type checking of plain fields when a template is parsed, validation of the data against a model, a maintained parser and engine, and an external standard.

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

**The clause tree passes criteria 1 to 3** on the first-pass templates. Criterion 4 holds only because nothing evaluates a template. It is not yet enforced:

- `cond` and `where` are stored as free strings (`src/tree.ts`). A one-line grammar (a field path, an optional `= value`, an optional leading `any`) accepts all 16 distinct conditions the templates use, but the importer does not apply it (`src/validation/sym-tree-check.ts`).
- The importer does not check that a loop variable is bound. D12-C uses `{{director.name}}` and `{{director.interest_description}}` outside any `FOR EACH`, and the import accepts both. That is a mistake in the template which the importer should have reported.
- The importer reads whatever text is in the locked box. Nothing compares it with the generated wording.

How ids work:

- Every block's id is written into Word as a hidden bookmark (`dsc_<id>`) and read back on import.
- A block with no bookmark gets an id derived from its content.
- After import, the new version is matched against the previous one:
  - Where a pasted copy carries a duplicate bookmark, the block closest to the previous text keeps the id.
  - A block that lost its bookmark takes the id of a vanished block whose text is close enough (word overlap ≥ 0.6).

## Limits of this spike

These are the things to test next.

- **The edits were simulated** by changing the Word XML, not made in Word. There's no LibreOffice or Word here. Real Word may treat bookmarks differently on cut and paste, and may split or merge them. The importer joins all runs in a paragraph before reading tokens, so Word splitting `{{…}}` across runs is handled.
- **Tracked changes are not handled.** Text inside `w:ins` and `w:del` is ignored. Counsel's masters must have changes accepted before import, or the importer must learn to read them.
- **Only our own generated files were imported.** A firm's Word master will differ:
  - Clause numbers are usually Word automatic numbering, not typed text as in the first-pass templates.
  - Headings use Word styles rather than direct formatting.

  The importer needs both before the design partner's masters arrive. It is worth changing the generator to use Word heading styles and automatic numbering now, so the first-pass templates exercise that path.
- **The paragraph styles are coarse** (title, subtitle, body, bullet, check, signature). Emphasis such as a bold signature label is not kept in the canonical content, so the renderer's style sheet has to supply it.
- **The 0.6 similarity threshold was chosen by hand.** Tune it on real edits.
- **One TemplateMark route was not tested.** The parsed TemplateMark JSON, not the markdown, could be the stored format, with our own Word importer and the engine used only to render. The engine does handle a field inside a condition when the JSON is built directly. This route would still reject an id on a paragraph or heading, and we would have to write the type checker the markdown parser provides. See decision 0008.
- **Only D12-B and D13-B were ported to TemplateMark.** The table-row loops in D1SP-B and D12-C were shown to fail in single-feature tests only.

## Running it

The spike is kept out of the pnpm workspace so the Accord packages and their AI SDKs are not installed for everyone. It has its own install, with install scripts disabled:

```
pnpm install                          # at the repository root first (TypeScript, Node types)
cd spikes/template-format
npm install --ignore-scripts          # the spike's own dependencies
node src/templatemark-probe.ts    # first-pass TemplateMark probes (parse only; superseded)
node src/templatemark-probe2.ts   # first-pass retries (parse only; superseded)
node src/check-import.ts          # Word → tree, against the generator's records
node src/check-ids.ts             # tree → Word → tree, and clause ids under counsel edits
../../node_modules/.bin/tsc -p .  # typecheck
```

The validation scripts run the same way, one per claim. Their captured output is in `validation/out/`.

```
node src/validation/fairness-ports.ts        # D12-B and D13-B ported to TemplateMark, compared with the clause tree
node src/validation/c3-block-condition.ts    # one script per claim: c1 to c13, usage-counts, sym-tree-check
bash src/validation/c12-footprint.sh         # dependency footprints
```

Three scripts write outside the repository, into `$SPIKE_SCRATCH` (default: `docsmart-template-spike` in the system temp directory): the code-execution proof writes marker files there, and the footprint script installs packages there with install scripts disabled. The Word converter check in `c13-criterion3.ts` is skipped unless `@accordproject/markdown-docx` is installed in `$SPIKE_SCRATCH/c13`.

The checks import the committed files in `templates/first-pass/` and load the generator from `templates/generator`, which needs its own `npm install` there.
