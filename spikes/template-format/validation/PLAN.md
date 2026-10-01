# Validation plan: the TemplateMark failure claims

Purpose. The M0 spike (`../README.md`, decision 0008 proposed) rejects Accord TemplateMark as the canonical template format. This plan re-tests every claim behind that rejection, so decision 0008 rests on evidence that would survive a challenge from someone who knows TemplateMark well.

The question to answer at the end: **is our own clause-tree JSON still the more suitable format, once TemplateMark has been given its fairest possible test?**

## Why the original probes are not enough

Reading the two probe scripts and re-running them on 1 October 2026 shows these threats to validity.

1. **Parse-only.** The probes call `TemplateMarkTransformer.fromMarkdownTemplate` and never run `@accordproject/template-engine` with data. "Parsed" does not prove correct output, and "ERROR" does not prove the engine cannot do it.
2. **Probe bugs counted as TemplateMark failures.**
   - "F5 AI zone as a named clause" and "F8 clause with an explicit id" fail because the probe model has no such property. That tests the probe, not the feature.
   - "F4 loop over list" fails in probe 1 (`#ulist` inline, inside `#with`) but passes in probe 2 at block level. The first failure is a placement mistake.
   - "F3 enum equality condition" uses `{{#if condition="…"}}` with no property name and no `return`. The syntax may simply be wrong.
   - "optional block" is tried on a non-optional property, so it fails for a reason unrelated to the feature.
3. **Only the non-idiomatic form was tried.** TemplateMark's own idioms were not tested: `{{#optional x}}` over an optional concept, `{{#clause x}}` scoping, a `condition=` attribute on a named `#if`, and a prepared view model (derived booleans, pre-filtered lists).
4. **The count does not reconcile.** The README says "6 of the 14 probes parsed". The scripts hold 19 probes, and a re-run gives 9 parsed (5 of 12, then 4 of 7).
5. **Asymmetry.** Some criteria were applied to TemplateMark but not equally to the clause tree. Example: "nothing stops the locked text being edited" is also true of a JSON tree until our own code enforces it. The tree stores `cond` and `where` as free strings with no grammar yet.
6. **Criterion 3 was never tested for TemplateMark** (Word import, deterministic hash).
7. **Version and entry point.** Confirm the installed versions are the current stable line and that the transformer and template kind (`contract` vs `clause`) used are the intended API.

## Verdict vocabulary

Each claim gets exactly one verdict.

| Verdict | Meaning |
|---|---|
| CONFIRMED | True as stated, in the fairest form, and no workaround without code in the template. |
| CONFIRMED, DATA WORKAROUND | True as stated, but expressible with no code in the template by shaping the data or the model. State the cost. |
| CONFIRMED, CODE WORKAROUND ONLY | Expressible only with a TypeScript formula or condition in the template. |
| REFUTED | False. The feature works; the original probe was wrong. |
| OVERSTATED | Partly true; the README wording needs correcting. |
| UNVERIFIABLE | Could not be tested here. Say why. |

Evidence standard for every verdict: a script under `src/validation/`, its captured output, and where behaviour is surprising, the file and line in `node_modules/@accordproject/*` that causes it. Documentation is supporting evidence only; installed source and observed output decide.

## Claims and how to test each

Every test must do both steps: parse with `markdown-template`, then generate with `template-engine` against data and compare the output text with the expected text. Use both `contract` and `clause` template kinds where relevant.

| # | Claim in the README | Test |
|---|---|---|
| C0 | "6 of the 14 probes parsed." | Re-run both probes unchanged. Record the true counts. Classify each of the 19 probes: genuine TemplateMark result, or probe bug. |
| C1 | `{{umbrella.legal_name}}` parses as plain text with no variable and no error; nested fields work only inside `#with`. | Parse and inspect the DOM for a `VariableDefinition`. Generate and check whether the literal `{{…}}` text leaks into output. Try `#with`, `#clause`, nested `#with`. Look for any strict option, validator, or engine step that reports an unknown or unbound token. Check a misspelt plain variable (`{{legal_nmae}}`) as the control. |
| C2 | A field inside a condition fails with "Unknown property", block and inline. 41 uses, 24 fields. | Reproduce. Read the typing code to find why (what scope `#if` gives its body). Then try every alternative: field in the `else` branch, `#with` inside `#if`, `#if` inside `#clause`, `{{#optional hurdle}}…{{rate}}…{{/optional}}` over an optional concept, optional scalar with `{{this}}`, a formula. Recount the 41 and 24 from the generator's usage records, not by hand. |
| C3 | Boolean condition with else works as a block. | Confirm by generation, both branches. Test whether a branch can hold several paragraphs, a heading, a list, a nested `#if`, and a named clause. The templates wrap whole clauses in conditions, so block content matters. |
| C4 | Enum condition fails and needs a TypeScript formula. 11 uses. | Try all documented forms: `{{#if prop condition="return …"}}`, conditional clause, formula. Then the data workaround: a derived Boolean per enum test in a view model. Recount the 11 from the usage records. List each distinct enum test in the templates. Also test the aggregate `[[IF any director.is_interested]]`. |
| C5 | Loop works as a bulleted list or an inline join. | Confirm `ulist`, `olist`, `join` by generation. Test what the templates need: several paragraphs per item (signature blocks), nested field of the item, a loop inside a condition, a condition inside a loop item, a loop producing table rows, a list reached through a nested path (`umbrella.directors`, `investor.controllers`). |
| C6 | Loop filter (`WHERE`) fails and needs a TypeScript formula. | Try every attribute or helper the source supports. Then the data workaround: a pre-filtered list in the view model. |
| C7 | Clause ids exist only for `{{#clause x}}` and `x` must be a model property. No general way to id every clause. | Confirm the model-property rule. Then test alternatives: one concept per clause in the model, ids in HTML comments, heading text, Concerto decorators, extra attributes on DOM nodes (does serialisation or validation reject or drop them). For each: does the id survive parse, DOM serialise, DOM back to markdown, and generation? Can paragraphs, headings and tables carry an id, not only clauses? |
| C8 | AI zone and locked designation only by convention; nothing stops the locked text being edited. | Build the best convention for each. State what enforcement would be our own code in both formats, so the comparison is symmetric. |
| C9 | Counsel note survives as an HTML comment. | Confirm through parse, serialise and generate. Check whether it can be stripped reliably at assembly and whether it can carry an id. |
| C10 | The entity name `Asset` clashes with a Concerto built-in type. | Reproduce with `concept Asset`. Test the property name `asset`, a different namespace, and other names from our model (`Portfolio`, `Investor`, `Participant`, `Transaction`, `Event`). State the cost of renaming. |
| C11 | Workarounds are TypeScript formulas compiled at run time, so untrusted templates become executable. | Trace in the installed source how a formula or `condition=` is compiled and evaluated (TypeScript compile, `eval`, `new Function`, `vm`, worker, sandbox). Prove or disprove execution with a harmless side-effect formula (write a marker file in a temp directory). Check: does parsing alone ever execute code? Can evaluation be switched off? Can a static check over the parsed DOM reject every code-bearing node, and is that list of node types complete? |
| C12 | 344 packages added; Google and OpenRouter AI SDKs come in through `cicero-core`; pnpm blocked their install scripts. | Use `npm ls` and `package-lock.json`. Find which declared dependency pulls `cicero-core` and the AI SDKs. Measure three footprints in a scratch directory with `--ignore-scripts`: `markdown-template` + `concerto-core` only; plus `template-engine`; the spike as declared. Report package counts and whether the TypeScript compiler and the AI SDKs appear in each. |
| C13 | "TemplateMark fails criteria 1, 2 and 4." | Re-score all four criteria from the verdicts above. Criterion 3: check whether any maintained Accord package converts Word to and from TemplateMark or CiceroMark, and whether the serialised DOM is deterministic (same input, same canonical JSON hash). Time-box this to a short check. |
| C14 | Versions: `markdown-template` 1.1, `concerto-core` 5.0. | Record installed versions of every `@accordproject/*` package and compare with the latest published. Note anything deprecated or superseded. |

## The fairness test: port two real templates

Single-feature probes can mislead in both directions. So port two first-pass templates end to end, in the most idiomatic TemplateMark possible.

- **D12-B** (written resolution, sponsor asset): enum condition, loop with filter, fields inside conditions, locked contracting-party wording, counsel notes.
- **D13-B** (supplement, sponsor secondary): AI zones, the most fields, conflict disclosure condition, a table if the template has one.

Take the source wording from `templates/generator/` and data from `fixtures/meridian-horizon/` (invented data, safe to use).

Make two variants of each port.

1. **Data-only variant.** No formulas and no `condition=` code anywhere. Use a Concerto model plus a view model prepared by our code (derived booleans, pre-filtered lists, optional concepts). Add the static "no code nodes" check from C11 and show it passes.
2. **Code-allowed variant.** Use formulas wherever they make the template closer to the Word master.

For each variant record:

- every construct that could not be expressed, with the template line
- how many view-model fields had to be invented, and whether a lawyer reading the template could still tell what each condition means
- whether the generated text matches the text our renderer produces for the same data, ignoring layout
- whether every clause can be given a stable id (link to C7)
- what our own code would still have to supply (Word import and export, ids, zones, locked wording, id matching across counsel edits)

## Symmetric check of the clause tree

Keep this short. It is a sanity check, not a second spike.

- Re-run `check-import.ts` and `check-ids.ts` and confirm the 9 of 9 results.
- Confirm criterion 4 for the tree honestly: `cond` and `where` are free strings in `tree.ts`. State whether the spike parses or validates them, and what is needed for "no expressions beyond field names, `field = value`, and `WHERE`" to be enforced rather than assumed.
- List what TemplateMark would give us that the tree does not (typed model validation, an existing parser and engine, an external standard), so the final comparison counts benefits as well as failures.

## Rules for the run

- Work only inside `spikes/template-format/`. New scripts go in `src/validation/`. Results go in `validation/RESULTS.md`.
- Do not edit `README.md`, decision 0008, the existing probes, or anything outside the spike folder. Do not commit.
- No new dependencies in the spike's `package.json` or the pnpm workspace. Anything extra (footprint measurements, a docx converter check) is installed in the session scratch directory with `npm install --ignore-scripts`.
- Never run package install scripts. The formula side-effect test in C11 must be harmless and confined to a temp directory.
- Use only invented fixture data. Nothing from `fixtures/private/`.
- Report failures of the validation itself honestly. If a test could not be run, say so; do not infer the result.

## Deliverable

`validation/RESULTS.md` containing:

1. A claims table: claim, verdict, one-line evidence, script name.
2. Corrections the README needs, quoted line by line.
3. The two ports: what worked, what did not, in each variant.
4. A re-scored criteria table for both formats.
5. A recommendation on decision 0008, with the strongest argument against it stated fairly.
