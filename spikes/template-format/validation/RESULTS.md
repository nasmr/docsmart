# Validation results: the TemplateMark failure claims

Run on 1 October 2026 against the installed packages in `spikes/template-format/node_modules` (Node 22.21.1). The plan is `PLAN.md`. Every test parses with `@accordproject/markdown-template` and then generates through `@accordproject/template-engine` with data. Outputs are compared with expected text after collapsing whitespace. Scripts are in `src/validation/`. Captured output is in `validation/out/`.

Unless a test says "clause kind", it uses the `contract` template kind. The C1 to C6 scripts also run every case in `clause` kind. In clause kind, `{{#clause x}}` does not change the typing scope but does change the data scope (`markdown-template/lib/TypeVisitor.js:185-193`), so many clause-kind cases fail for that reason alone. Clause kind is not a usable mode for whole documents.

The corrections in section 2 were applied to `../README.md`, and decision 0008 was rewritten on the reasons in section 5, on 1 October 2026. Quotations from the README below are from the version before that correction.

## 1. Claims table

| # | Claim (README) | Verdict | Evidence (one line) | Script |
|---|---|---|---|---|
| C0 | "6 of the 14 probes parsed." | REFUTED | The probes hold 19 cases. 9 parse (5 of 12, then 4 of 7). Six of the 10 errors are probe mistakes. No probe ever generated output. | `templatemark-probe.ts`, `templatemark-probe2.ts` (re-run unchanged), `out/c0-probe*.txt` |
| C1 | `{{umbrella.legal_name}}` parses as plain text, no error; nested fields only inside `#with`. | CONFIRMED | The DOM has no variable, and the literal `{{umbrella.legal_name}}` appears in the generated text. A misspelt dotted path (`{{umbrela.legal_name}}`) and a one-letter name (`{{x}}`) also leak silently. No strict option exists. Wording fix: `{{#clause umbrella}}` also scopes fields. | `c1-nested-fields.ts` |
| C2 | A field inside a condition fails ("Unknown property"), block and inline. 41 uses, 24 fields. | CONFIRMED, DATA WORKAROUND | Fails in every `#if` form: inline, block, else branch, inside `#clause`, and with `condition=`. `#with` inside `#if` fails with `currentModel.getOwnProperty is not a function`. Works without code via `{{#optional x}}` over an optional concept or scalar, or `{{#clause x}}` over an optional concept. Counts confirmed from usage records: 41 uses, 24 fields. | `c2-field-in-condition.ts`, `usage-counts.ts` |
| C3 | Boolean condition with else works as a block. | OVERSTATED | It works only when the whole conditional is one paragraph. With a blank line inside, the later paragraphs are output even when the condition is false, and `{{/if}}` leaks into the text. There is no error. A heading or list inside behaves the same way. A nested `#if` does not parse. | `c3-block-condition.ts` |
| C4 | Enum condition fails and needs a TypeScript formula. 11 uses. | CONFIRMED, DATA WORKAROUND | No code-free enum test exists. The probe's syntax was wrong. The idiomatic code form `{{#if asset condition="return …"}}` works, as does `{{#clause asset condition="…"}}`. A derived Boolean or optional concept works without code. Counts confirmed: 11 uses, 4 distinct tests. The aggregate `any director.is_interested` works as a derived Boolean. | `c4-enum-condition.ts`, `usage-counts.ts` |
| C5 | Loop works as a bulleted list or an inline join. | OVERSTATED | `ulist` and `olist` work. `join` over a list of concepts prints `[object Object]`. Multi-paragraph items work only with list markers. Without markers, every paragraph after the first is silently dropped. A loop cannot produce table rows. `#foreach` is not available. | `c5-c6-loops.ts` |
| C6 | Loop filter (WHERE) fails and needs a TypeScript formula. | CONFIRMED, DATA WORKAROUND | `where="is_interested"` is accepted and silently ignored, so every director is printed as "declared an interest". A condition inside an item cannot drop the item. A pre-filtered list in the view model works, including the empty case. | `c5-c6-loops.ts` |
| C7 | Clause ids only via `{{#clause x}}`, `x` a model property; no general way to id every clause. | CONFIRMED | In contract kind the name must be a property. In clause kind any name parses, but the clause then silently disappears from the output. One concept per clause works and survives every step, but then the clause body cannot reach any other field. An `id` property on a paragraph or heading is rejected by the serialiser. HTML-comment ids survive every step, but only as sibling nodes. | `c7-c9-ids-zones-notes.ts` |
| C8 | AI zone and locked designation only by convention; nothing stops the locked text being edited. | OVERSTATED | True, but equally true of the clause tree until our code enforces it. In TemplateMark the locked wording can be held as data (`contracting_party.designation`), so it is not template text at all. | `c7-c9-ids-zones-notes.ts`, `fairness-ports.ts` |
| C9 | Counsel note survives as an HTML comment. | CONFIRMED | It survives parse, DOM serialisation, DOM to markdown and back, and generation. Removing `HtmlBlock` and `HtmlInline` nodes from the output strips it reliably. An id can only live inside the comment text. | `c7-c9-ids-zones-notes.ts` |
| C10 | `Asset` clashes with a Concerto built-in type. | CONFIRMED | `Type 'Asset' clashes with an imported type with the same name.` The same happens with `Participant`, `Transaction`, `Event` and `Concept`, in any namespace. The property name `asset` is fine. Renaming the type (for example to `ProjectAsset`) is the whole cost. | `c10-names.ts` |
| C11 | Workarounds are TS formulas compiled at run time, so untrusted templates become executable. | OVERSTATED | The mechanism is confirmed: TypeScript compile, then `new Function`, with no sandbox in either mode. The marker file was written both in process and from the child process. But the workarounds need not be code (C2, C4, C6). `disableJavaScriptEvaluation` blocks execution, data-only templates still generate with it set, and a static check over the four `Code` fields is complete. | `c11-code-execution.ts` |
| C12 | 344 packages; Google and OpenRouter AI SDKs via `cicero-core`; pnpm blocked install scripts. | OVERSTATED | The spike installs 348 packages. Six AI SDKs come from `template-engine`'s `optionalDependencies`, not from `cicero-core`. The parser alone is 72 packages with no TypeScript and no AI SDKs. The pnpm statement could not be checked. | `c12-footprint.sh` |
| C13 | "TemplateMark fails criteria 1, 2 and 4." | OVERSTATED | Re-scored in section 4. Criterion 1 is met for both ports in data-only form. Criterion 4 can be met if we enforce it. Criteria 2 and 3 fail. | all, `c13-criterion3.ts`, `fairness-ports.ts` |
| C14 | Versions: `markdown-template` 1.1, `concerto-core` 5.0. | CONFIRMED | Every installed `@accordproject/*` package is the latest published version. `markdown-docx` and `markdown-pdf` are deprecated with "Not maintained". | `npm view` (see C14 below) |

### Detail per claim

**C0. Classification of the 19 probes** (`out/c0-probe1.txt`, `out/c0-probe2.txt`):

| Probe | Result | Genuine result or probe bug |
|---|---|---|
| F1 dotted path | parsed | Genuine. Parses as text with no variable (C1). |
| F1 with block | parsed | Genuine. Works (C1.3). |
| F2 boolean inline (`fund_category` inside `#if`) | ERROR `Unknown property: fund_category` | Genuine (C2). |
| F2 boolean with else, "block" | parsed | Genuine, but the body is one paragraph. A real multi-paragraph block fails silently (C3.2). |
| F3 enum | ERROR `Unknown property: condition` | Probe bug. `{{#if condition="…"}}` has no property name, so the regex takes `condition` as the name (`markdown-it-template/lib/template_re.js:28-33`). The idiomatic form works (C4.2). |
| F4 loop over list | ERROR `Unknown property: name` | Probe bug. `ulist` is block-only (`markdown-it-template/lib/names.json`) and was placed inline inside `#with`. It works at block level (C5.1). |
| F4 loop with filter | ERROR `Unknown property: name` | Probe bug (same placement). The real behaviour is worse: `where=` is silently ignored (C6.1). |
| F4 several paragraphs per item | ERROR `Unknown property: directors` | Probe bug. The block list sat outside the inline `#with` scope. The correct form works with list markers (C5.4a). |
| F5 AI zone | ERROR `Unknown property: issuer_description` | Probe bug. The model had no such property. It works when the model has one (C8.1). |
| F6 formula | parsed | Genuine. Generation wraps the result in JSON quotes (C8.4). |
| F7 HTML comment | parsed | Genuine (C9.1). |
| F8 clause with explicit id | ERROR `Unknown property: c_2_1` | Genuine demonstration of the model-property rule (C7.1). |
| P2 dotted path | parsed | Genuine (no variable). |
| P2 variable inside condition, block | ERROR `Unknown property: hurdle_rate` | Genuine (C2). |
| P2 variable inside condition, inline | ERROR `Unknown property: hurdle_rate` | Genuine (C2). |
| P2 ulist at block level | parsed | Genuine. Generates correctly (C5.1). |
| P2 join | parsed | The parse-only result misled. Over concepts, generation prints `[object Object]` (C5.3). |
| P2 clause typed by a concept property | parsed | Genuine. Generates correctly (C8.1). |
| P2 optional block | ERROR `Optional template not on an optional property: legal_name` | Probe bug. The property was not optional. It works on an optional property (C2.8). |

Probe 1 also prints `[xmldom fatalError] missing root element`. That is noise from parsing HTML comments, not an error.

**C1.** In `c1-nested-fields.ts`, cases C1.1, C1.2, C1.10 and C1.11 put the literal `{{…}}` text into the generated output. The cause is that the variable regex allows no dots and needs at least two characters (`markdown-it-template/lib/template_re.js:25-30`, `identifier = '([a-zA-Z_][a-zA-Z0-9_]+)'`). Nested `#with`, two `#with` blocks in one sentence, `#clause umbrella` and nested `#clause` all generate correctly (C1.3 to C1.7). A misspelt plain variable is caught: `Unknown property: legal_nmae` (C1.8, C1.9). No option, validator or engine step reports unbound `{{…}}` text. A scan of the output for `{{` would be our own code.

**C2.** The cause is in `markdown-template/lib/TypeVisitor.js:247-268`. The `#if` body is typed against the Boolean property itself (`whenTrue`) or against nothing (`whenFalse`), so no variable can be typed in either branch. The engine itself has no such limit. In C2.11 a variable moved by hand into `whenTrue` of a parsed DOM generates correctly for both branches. So the limit sits in the markdown typer, not in the TemplateMark DOM or the engine. Data-only alternatives all generate correctly (C2.7a to C2.9b): `{{#optional hurdle}}…{{rate}}…{{/optional}}`, the same with else, inside `#with`, an optional scalar with `{{this}}`, and a block `{{#clause hurdle}}`. The formula workaround is broken in the engine:
- A formula inside `#if` or `#optional` fails with `Generated invalid agreement: ValidationException: The instance "org.accordproject.ciceromark@0.6.0.Formula" is missing the required field "value".` (C2.10, C2.10c). The cause: the engine copies `whenTrue` into `nodes`, while formula results are keyed by traversal path (`TemplateMarkInterpreter.js:165` stores the result, `:348` looks it up, `:473` makes the copy). I confirmed the key mismatch by instrumenting a copy of that file and then restoring it; the md5 matches a fresh install.
- A string formula result is JSON-encoded twice, so the text gets quote marks: `"8%"` (C2.10b; `TemplateMarkInterpreter.js:165` then `:352`). `CiceroMarkTransformer.toMarkdown` also fails on formula output with `URI malformed`.

The cost of the data workaround is one invented optional concept or scalar per condition that has fields inside. Fields inside an else branch need a second concept. Inside a `#clause`, only that concept's fields are reachable (C3.9: `Unknown property: has_hurdle`), so fields from other entities must be copied into it.

**C3.** C3.1a and C3.1b (one paragraph, both branches) match. C3.2b is the dangerous case: with `is_regulated_fund = false`, the output is `No shares are issued until approval. {{/if}}`. The inline `#if` closes at the end of the first paragraph. The rest is ordinary text. `#if` is an inline rule only: `names.json` lists blocks `["clause","ulist","olist"]` and inlines `["if","optional","with","join"]`. A nested `#if` fails with `currentModel.getOwnProperty is not a function` (C3.5). The block form that works is a `#clause` per branch over an optional concept, without code (C3.7a, C3.7b), or `#clause … condition=` with code (C3.8a). A `#clause` can hold headings, several paragraphs, lists and an inline `#if`.

**C4.** The upstream test template (`accordproject/template-engine` `test/templates/good/full/template.md`) shows the idiomatic form: `{{#if lastName condition="return lastName.startsWith('S')"}}`. A property name is required before `condition=`. With that form, C4.2a to C4.2d and C4.3a/b match, both branches, inside `#with` too. A field in the body of a code condition still fails typing (C4.2e: `Unknown property: valuer_name`), so it needs a `#clause … condition=` block or a formula. A formula returning text gets JSON quotes (C4.4). Data-only: a derived Boolean (C4.5a/b) or an optional concept (C4.6a/b). The four distinct enum tests in the templates are: `asset.acquisition_source = gp_sourced` (5 uses), `umbrella.fund_category = private_investment_fund` (3), `investor.type = entity` (2) and `investor.type = individual` (1). Aggregate: `{{#if directors condition="return directors.some(d => d.is_interested)"}}` works with code (C4.8a), and a derived `any_director_interested` works without (C4.8b). One trap: a list inside a `#clause` over an absent optional concept throws `No values found for path '$['interests']['interested']'` (C4.8d). The list blocks are evaluated before the clause is dropped.

**C5.** Results:
- `join` over concepts prints `[object Object], …` (C5.3, C5.9c; `TemplateMarkInterpreter.js:373-399` uses a drafter for primitives and ignores the body). Over strings with `{{this}}` it works (C5.3b).
- Multi-paragraph items (signature blocks) work only with list markers, and so render as list items (C5.4a). Without markers, only the first paragraph is repeated and the rest are dropped with no error: the output is `Signature line Signature line Signature line` (C5.4c; `TemplateMarkInterpreter.js:268-276`).
- A line of underscores (the Word signature rule) becomes a thematic break unless escaped (C5.4). Legal text in markdown needs escaping.
- Fields of the item, `#with` inside the item, a list inside a `#clause`, an inline `#if` with no field, and `#optional` with a field all work (C5.5, C5.6, C5.7a, C5.7c).
- A loop producing table rows is not possible. The table ends and the loop yields a bullet list whose text contains literal `|` characters: `TableRow nodes 1, List nodes 1, Item nodes 2` (C5.8). D1SP-B uses such a row loop, and D12-C uses a loop inside a table cell.
- `{{#ulist umbrella.directors}}` fails (`ListBlockDefinition template not on an array property: umbrella`). `#clause umbrella` around `#ulist directors` works (C5.9b).
- `#foreach` is not in the grammar (C5.10). A hand-built `ForeachDefinition` fails with `Type "ForeachDefinition" is not defined in namespace "org.accordproject.templatemark@0.5.0"` (C5.11). The upstream test is skipped with the comment `// currently broken!!` (`test/TemplateMarkInterpreter.test.ts:54`).

**C6.** C6.1 prints all three directors as having "declared an interest". The `ulist` rule reads only `name` (`markdown-template/lib/templaterules.js:212-222`). A filter by `#if` inside the item fails typing (C6.3). `condition=` inside the item fails TypeScript compilation: `Property 'is_interested' does not exist on type 'ID'` (C6.5), because the code is typed against the template concept while the runtime `data` is the list item. With a cast, it runs but cannot drop the item (C6.5b). A formula over the list works but gets quotes (C6.6). A pre-filtered list in the view model works, including empty (C6.7a/b).

**C7.** For each carrier, `c7-c9-ids-zones-notes.ts` checks whether the id survives the DOM, DOM → markdown → DOM (canonical hash equal), and generation:
- One concept per clause (C7.2): survives every step. But inside it the body cannot reach `umbrella` (C7.2b: `Unknown property: umbrella`). Every clause would need its own copy of the fields it uses.
- In clause kind, `{{#clause c_9_9}}` parses and the round trip is stable, but the generated text is empty (C7.1). The clause is dropped by the implicit null check (`TemplateMarkInterpreter.js:510`).
- An HTML comment before the paragraph, or inline in it (C7.3, C7.3b): survives every step, as a separate node.
- Heading attribute syntax `{#c_2}`: not supported; it leaks as text (C7.4).
- Decorators: on the property they do not reach the node; on the concept, `@Id("c_2_1")` reaches the node and the output (C7.5). This is still one model property per clause.
- An extra `id` on a Paragraph or Heading: `Unexpected properties for type org.accordproject.commonmark@0.5.0.Heading: id` from the serialiser, `toMarkdownTemplate` and the engine (C7.6).

**C8.** A zone as `{{#clause issuer_description}}{{text}}{{/clause}}` over a `Zone` concept works (C8.1). The locked designation works as a `#clause` over data (C8.2), or as two `#with` blocks (C8.3). As a formula it gets quotes, and DOM → markdown turns it into `{{%Resource {id=org.accordproject.templatemark@0.5.0.Code}%}}`, which loses the code (C8.4). Editing the locked wording in the template is accepted and generated (C8.5). The symmetric view:
- In the clause tree, `locked` is a block type, but the spike's importer reads whatever text counsel left in the locked box. Nothing stops an edit until our code compares it with the generated wording.
- In TemplateMark, the strongest convention keeps the wording out of the template (`{{designation}}`, built by our code). Counsel can then delete or move it, but cannot reword it.

Enforcement is our own code in both formats.

**C9.** Notes survive every step (C9.1 to C9.3). They are not in the plain text. They are present as `HtmlBlock`/`HtmlInline` nodes in the AgreementMark output, and filtering those nodes removes them (C9.4).

**C10.** See the table. No other clashing name appears in `docs/spec/` (`Asset` 5 times; `Event`, `Transaction`, `Participant` and `Concept` 0).

**C11.** The mechanism, from installed source:
- **Parse** only stores the code string (`markdown-template/lib/templaterules.js:52-68` for formulas, `:69-88` for `#if condition=`, `:189-205` for `#clause condition=`). Parsing alone did not write the marker.
- **Generate** compiles TypeScript to JavaScript with the TypeScript compiler through `@typescript/twoslash` (`template-engine/lib/TemplateMarkToJavaScriptCompiler.js:26-30` lists the code nodes; `TypeScriptToJavaScriptCompiler.js:119` and `:164`). It wraps the code in a function that destructures every top-level property of the template concept (`utils.js:89-101`).
- **Run.** `evaluateUserCode` (`TemplateMarkInterpreter.js:153-181`) calls `evaluateJavaScript` (`:60-98`). The default is `evalDangerously`, which is `new Function(...)` in the host process (`JavaScriptEvaluator.js:59-70`). With `childProcessJavaScriptEvaluation: true`, it forks `worker.js`, which again runs `new Function` (`JavaScriptEvaluator.js:181-238`, `worker.js:27-44`). The child gets `env: {}` but full Node globals. It is not a sandbox.
- **Proof.** The formula `(globalThis as any).process.getBuiltinModule('fs').writeFileSync(<scratch>/c11-markers/*.txt, …)` wrote its marker:
  - in process (pid equal to the host pid);
  - from the child process (a different pid);
  - from `#if condition=` and `#clause condition=`;
  - from a formula inside a `#clause` whose condition is false, because every code node is evaluated before branches are chosen.
- **Switch off.** `disableJavaScriptEvaluation: true` makes any code node fail with `JavaScript evaluation is disabled.` (`TemplateMarkInterpreter.js:61-63`), and the marker is not written. A data-only template generates normally with the flag set.
- **Static check.** The only code-bearing type in the TemplateMark model is `Code`. It is used by exactly four fields: `FormulaDefinition.code`, `ClauseDefinition.condition`, `ConditionalDefinition.condition` and `ConditionalBlockDefinition.condition` (listed from the model text). The serialiser rejects properties not in the model (C7.6). So a scan that rejects any `…Code` or `FormulaDefinition` node is complete for code in a DOM that passes validation. It passed the data-only template and rejected the formula, `#if condition=` and `#clause condition=` templates.
- **Names.** Node names also reach `jsonpath`, which evaluates script expressions with `static-eval` (`jsonpath/lib/handlers.js:3`, `:388-392`). The engine only rejects names containing `.` (`TemplateMarkInterpreter.js:117-120`). A crafted name `name'][(@['length']>0 ? 'x' : 'y')]['z` was passed to jsonpath and failed inside it (`obj needs to be an object`). I did not prove that it evaluates anything. The static check therefore also enforces the identifier syntax on every name.
- The TypeScript compiler and the AI SDKs are not loaded by `require('@accordproject/template-engine')`. Only `@typescript/vfs` and `@typescript/twoslash` are loaded at require time. `typescript` is loaded at the first generate.

**C12** (`out/c12-footprint.txt`; all in the scratch directory with `--ignore-scripts`):

| Configuration | Packages | On disk | TypeScript | AI SDKs |
|---|---|---|---|---|
| a. `markdown-template` + `concerto-core` | 72 | 30 MB | no | none |
| b. a + `template-engine` | 331 | 286 MB | yes (5.9.3, plus twoslash) | 6: `@google/genai`, `@openrouter/sdk`, `openai`, `@anthropic-ai/sdk`, `@mistralai/mistralai`, `groq-sdk` |
| b2. b with `--omit=optional` | 280 | 164 MB | yes | none installed |
| c. the spike as declared | 348 | 299 MB | yes | the same 6 |

`npm ls` shows all six SDKs, `typescript` and `cicero-core` as direct children of `@accordproject/template-engine@5.1.0`. `cicero-core`'s own dependencies contain no AI SDK. Packages with install scripts (not run): `@google/genai`, `@openrouter/sdk`, `core-js-pure`, `protobufjs`. For b2 that list comes from the lockfile; those packages were not installed. The spike's own install has 348 entries in `node_modules/.package-lock.json`, not 344.

**C13.** See section 4. The TemplateMark DOM is deterministic: the same markdown parsed twice gives the same canonical hash, and so does DOM → markdown → DOM (`c13-criterion3.ts`). `markdown-transform` 1.1 has no docx or pdf format (formats: templatemark, markdown, commonmark, ciceromark, plaintext, ciceroedit, html). The only Word converter is `@accordproject/markdown-docx` 0.16.26, deprecated "Not maintained". It converts one way, docx → CiceroMark, through mammoth. I installed it in scratch only. On D12-B and D13-B it was deterministic, but:
- it produced 0 tables (D13-B has its summary table and the cover table);
- it produced 0 template nodes, so the 38 and 72 `{{…}}` tokens and the `[[…]]` blocks stay literal text;
- it kept no bookmarks.

It is not a usable importer.

**C14.** `npm view` on 1 October 2026: template-engine 5.1.0; markdown-template, markdown-it-template, markdown-common, markdown-cicero, markdown-transform and markdown-html 1.1.0; concerto-core, concerto-cto, concerto-util and concerto-vocabulary 5.0.0; concerto-codegen 6.3.0; concerto-metamodel 3.17.0; cicero-core 2.2.0. All are the latest. markdown-docx 0.16.26 and markdown-pdf 0.16.25 are deprecated "Not maintained". `names.json` on the `markdown-transform` main branch is unchanged (no block `if`, no `foreach`). The transformer (`TemplateMarkTransformer.fromMarkdownTemplate`) and `TemplateMarkInterpreter.generate` are the documented API. `contract` is the kind for whole documents.

## 2. Corrections the README needs

| README line | Correction |
|---|---|
| "TemplateMark cannot express the first-pass templates without embedding executable code in them." | Wrong for the two templates ported. D12-B and D13-B were ported with no code nodes. Their output matches the clause-tree rendering exactly, for the fixture data and for a reversed-conditions variant. The cost is 5 and 7 invented view-model fields (section 3). |
| "`src/templatemark-probe.ts` and `src/templatemark-probe2.ts` try each feature on its own. 6 of the 14 probes parsed." | 19 probes; 9 parse. Six of the 10 errors are probe mistakes. The probes never generate output. |
| "Parses, but as plain text. No variable is created and no error is raised, so a mistyped field goes unnoticed. Nested fields work only inside `{{#with umbrella}}…{{/with}}`." | Add: "and the literal `{{umbrella.legal_name}}` is printed in the generated document." Change the last sentence to: "Nested fields work inside `{{#with}}` or `{{#clause}}`." |
| "**Fails** ("Unknown property") in both block and inline form. The first-pass templates do this 41 times, with 24 different fields." | Counts confirmed. It fails in every `#if` form, including the else branch and with `condition=`. It works without code through `{{#optional}}` or `{{#clause}}` over an optional value the view model supplies. The limit is in the markdown typer, not in the engine. |
| "Boolean condition with else, as a block — Works." | "Works only when the conditional fits in one paragraph. With more than one paragraph, the later paragraphs are always output and `{{/if}}` leaks into the text, with no error. A nested `#if` does not parse. Block conditions need `{{#clause}}`." |
| "Enum condition — **Fails.** Needs a TypeScript formula. The templates use 11." | "No code-free enum test exists. With code it works as `{{#if <property> condition="return …"}}` (a condition, not a formula). Without code it works as a derived Boolean per test (4 distinct tests, 11 uses)." |
| "Loop — Works as a bulleted list or an inline join." | "`ulist`/`olist` work. `join` works only over plain values (concepts print `[object Object]`). Multi-paragraph items need list markers, or the extra paragraphs are silently dropped. No loop can produce table rows. No `#foreach`." |
| "Loop filter — **Fails.** Needs a TypeScript formula." | "A `where=` attribute is accepted and silently ignored, so every item is printed. Works without code as a pre-filtered list in the view model." |
| "Clause ids — Only for `{{#clause x}}` … no general way to give every clause an id." | Confirmed. Add: "A per-clause concept cuts the clause off from every other field. In clause kind, an unknown clause name parses and the clause silently vanishes." |
| "AI zone, locked designation — Only by convention … Nothing stops the locked text being edited." | "Only by convention, in both formats: nothing in the clause tree stops the locked text being edited either, until our code checks it. In TemplateMark the wording can be supplied as data, so it is not template text." |
| "Our entity name `Asset` — Clashes with a Concerto built-in type." | Add: "Also `Participant`, `Transaction`, `Event` and `Concept`. The fix is renaming the type; the property `asset` is fine." |
| "The workarounds are TypeScript formulas embedded in the template, which `@accordproject/template-engine` compiles at run time (it depends on the TypeScript compiler). Templates arrive from outside counsel, so that would make untrusted documents executable." | "Code workarounds are compiled by the TypeScript compiler and run with `new Function`, in process or in a child process; neither is a sandbox. The workarounds need not be code, though. `disableJavaScriptEvaluation` blocks all code, and a static check can reject the four code-bearing fields." |
| "Installing the Accord packages, with four small libraries alongside, added 344 packages. They include the Google and OpenRouter AI SDKs, pulled in through `cicero-core`, whose install scripts pnpm blocked." | "348 packages (299 MB). Six AI SDKs (Google, OpenRouter, OpenAI, Anthropic, Mistral, Groq) and the TypeScript compiler come in through `template-engine`; the SDKs are its optional dependencies. The parser alone (`markdown-template` + `concerto-core`) is 72 packages with neither." I could not check the pnpm statement; the README's own install instructions use npm with `--ignore-scripts`. |
| "**TemplateMark fails criteria 1, 2 and 4.**" | "TemplateMark fails criteria 2 and 3. It meets criterion 1 for D12-B and D13-B only through a view model built by our code, and it cannot loop table rows. It meets criterion 4 only if we enforce data-only templates." |
| "**The clause tree passes all four criteria**" | "…passes criteria 1 to 3. Criterion 4 holds by construction (there is no evaluator), not by enforcement: `cond` and `where` are free strings, and the importer accepts `{{director.name}}` outside any loop (twice in D12-C)." |
| "It passed every test." | Keep, but add that the tests did not check `cond` and `where` text or alias binding. |

## 3. The two ports

Port sources are in `src/validation/ports/` and are copied to `validation/out/ports/*.tem.md` and `*.cto`. The runner is `fairness-ports.ts`. Values come from `fixtures/meridian-horizon` (Atlas) and are all strings taken from records. The two calculated fields are placeholders. Expected text is the clause tree imported from the committed Word file and rendered with the same values by `ports/atlas.ts`. The comparison ignores whitespace, table bars, bold markers and a space before punctuation.

There are two scenarios. "atlas" is the fixture as recorded. "flipped" is synthetic: every condition is reversed and a hurdle is added, so the else branches run. A negative control (atlas output against the flipped tree) gives 10 diff lines, so the comparison does detect a wrong branch.

| Port | Code nodes | Static check | Invented view-model fields | Text vs clause tree (atlas / flipped) | `#clause` ids vs id-bearing tree blocks |
|---|---|---|---|---|---|
| D12-B data-only | 0 | pass | 5 | match / match | 2 of 46 |
| D12-B code-allowed | 7 | reject | 0 | differs / differs (quotes only) | 2 of 46 |
| D13-B data-only | 0 | pass | 7 | match / match | 3 of 67 |
| D13-B code-allowed | 7 | reject | 2 | differs / differs (quotes only) | 5 of 67 |

**Invented fields, data-only.**
- D12-B:
  - `umbrella.regulated {fund_category}`
  - `umbrella.related_party_consent {clause}`
  - `resolution.later_effective_date`
  - `interested_directors` (the WHERE)
  - `contracting_party.designation`
- D13-B:
  - `portfolio.hurdle_rate_if_any`
  - `asset.retained_quantity`
  - optional `umbrella.related_party_consent_clause`
  - `umbrella.pif_investor_basis` (the enum test)
  - `contracting_party.designation`
  - `issuer_description` and `project_risk_factors` (zone holders)

**Can a lawyer still tell what each condition means?** Mostly, from the name: `{{#optional later_effective_date}}`, `{{#optional regulated}}` and `{{#ulist interested_directors}}` read well. They cannot see the rule itself. For example, `pif_investor_basis` is present when `fund_category = private_investment_fund`, and that test now lives in our view-model code, outside the template counsel reviews. The data-only templates also drop three of the master's conditions from view (`is_regulated_fund` in 1.1, `effective_date_differs`, `om_requires_related_party_consent`). `#if is_regulated_fund` stays visible where its body has no field (2.1, section 3).

**Code-allowed, what was needed.**
- A field inside an inline condition (D12-B 1.1, the signing paragraph; D13-B 5.2 and the performance-fee table cell) needs a whole-phrase formula. A formula inside `#if` gets no value (C2.10), and a field inside a code condition does not type (C4.2e).
- The WHERE loop became one formula producing all declarations as a single paragraph, so the per-director paragraphs were lost.
- Block conditions with fields (D12-B 5.5; D13-B 4.4, 10.6 and the enum in 11.1) work as `{{#clause … condition="…"}}`.

Every remaining text difference is the JSON quote marks the engine adds around formula strings. For example, `company"" .` when false and `" and is recognised as a …"` when true. With no interested directors, an extra paragraph containing only `""` appears. The code-allowed variants are therefore closer to the Word master in structure, but they produce wrong text with this engine version.

**What could not be expressed, in either variant** (template line → what happened):
- Every `{{…}}` written as in the master (`{{umbrella.legal_name}}`) had to become `{{#with umbrella}}{{legal_name}}{{/with}}`. A dotted path would print literally.
- Signature blocks (`[[FOR EACH director IN umbrella.directors]] SIG(...)`) become a bulleted list with three paragraphs per item. The underscore rule needs escaping as `\_`. The loop sits inside a `{{#clause umbrella}}` that exists only to reach `directors`.
- The interest declarations (`[[FOR EACH … WHERE director.is_interested]]`) become list items, not numbered paragraphs.
- The D13-B summary table: GFM needs a header row, so the first data row ("Portfolio") is the header. Text is equal; structure differs.
- AI zones: the instructions can only be an HTML comment, and the zone content is data held in an invented concept.
- Clause ids: only `#clause` blocks carry a name (2 of 46 and 3 of 67). Giving every clause an id would need one model property per clause, and each clause would then lose access to every other field (C7.2b).
- Counsel notes are HTML comments with no id.

**Not tested end to end, but shown by single-feature tests to fail:** D1SP-B's table-row loop (`[[FOR EACH person IN investor.controllers]]` in a table) and D12-C's loop inside a table cell (C5.8).

**What our own code would still have to supply with TemplateMark:**
- Word import (no maintained converter) and Word export;
- clause ids and id matching across counsel edits;
- zone and locked enforcement;
- the view-model builder, which holds the condition logic in data-only form;
- a check for leaked `{{` and `{{/if}}` text;
- the static no-code check, with `disableJavaScriptEvaluation` set.

The clause tree needs the same items except the view model and the leak check, and it has the importer, ids and matching already.

## 4. Re-scored criteria

| Criterion | TemplateMark (evidence) | Clause tree (evidence) |
|---|---|---|
| 1. Expresses everything the templates use | **Partly.** Data-only expresses all of D12-B and D13-B with exact text, at 5 and 7 invented fields. It cannot loop table rows (D1SP-B, D12-C). Several markdown forms fail silently: multi-paragraph `#if`, `where=`, `join` over concepts, dotted paths, multi-paragraph items without markers. | **Pass.** All 9 Word files import with every field, condition, list, zone, locked box and placeholder, 487 records (`check-import.ts`, re-run: 9 of 9). The importer does not check that a slot's alias is bound: it accepts `{{director.name}}` outside a loop in D12-C. |
| 2. Stable clause ids through counsel's Word edits | **Fail.** No general id: only `#clause` over a model property, and that cuts off field access. There is no Word round trip to carry ids. HTML-comment ids would be our own convention and code. | **Pass** on simulated edits (`check-ids.ts`, re-run: 32 ok lines, "all id checks pass"). Real Word editing is still untested. |
| 3. Imports Word masters, same file gives same hash | **Fail off the shelf.** The DOM hash is deterministic, but no maintained Accord package imports Word. The deprecated `markdown-docx` loses tables and all template structure. We would write the importer ourselves. | **Pass.** 9 of 9 import with a stable hash (`check-import.ts`). |
| 4. Templates are data, never code | **Pass only if enforced.** Data-only ports pass the static check. `disableJavaScriptEvaluation` blocks execution, and data-only templates still generate with it. Without that enforcement, code runs unsandboxed (C11). | **Pass by construction, not enforced.** Nothing evaluates `cond`/`where`, but they are free strings (`tree.ts`; `import-docx.ts:160,233` accept `/^IF\s+(.+)$/`). The proposed one-line grammar `^(any\s+)?path(\s*=\s*value)?$` accepts all 16 distinct conditions (`sym-tree-check.ts`), but it is not implemented. Enforcing it needs: the grammar check in the importer, field paths checked against `templates/fields/catalogue.json`, alias binding checked, and an evaluator that accepts nothing else. |

**What TemplateMark gives that the tree does not:**
- typed checking of plain variables at parse time (a misspelt `{{legal_nmae}}` is caught);
- Concerto validation of the data at generate time;
- a maintained parser, engine and DOM with deterministic serialisation;
- an external standard under the Linux Foundation;
- optional-guard checks;
- markdown and HTML renderers.

**What the tree has that TemplateMark lacks:** block conditions, filtered loops, table-row loops, ids on every block, a Word importer and exporter with bookmark ids, and matching across versions.

## 5. Recommendation on decision 0008

**Accept 0008 (own clause tree), but replace its reasoning.** The README's central reason is that TemplateMark cannot express the templates without executable code. That is false for the two templates ported: data-only TemplateMark reproduced D12-B and D13-B exactly. The reasons that do hold are these:

1. **No general clause ids (criterion 2).** This is the core requirement for clearance and counsel edits. TemplateMark offers ids only by making each clause a model property, and that cuts the clause off from every other field.
2. **No Word path (criterion 3).** We would write the importer and exporter either way. With TemplateMark, we would also map Word structures onto a markdown grammar that cannot express block conditions or table-row loops.
3. **Silent failure modes in the markdown surface.** A multi-paragraph `#if` prints the false branch. `where=` is ignored. `join` prints `[object Object]`. Dotted paths and misspelt dotted paths print literally. For legal text, wrong output with no error is worse than an error.
4. **The condition logic moves out of the template.** In data-only form, conditions become view-model fields built by our code. Counsel cannot see the rule they are clearing. Code-allowed form avoids that, but it executes code and, with this engine, prints quote marks around every formula result.
5. **Weight and surface of the engine.** 331 packages, TypeScript and six AI SDKs, against 72 for the parser alone.

**Strongest argument against.** Store the TemplateMark JSON DOM, not markdown, as the canonical format. Write our own Word importer into that DOM, as we must anyway. Give ids with HTML-comment siblings or a wrapper, and use the engine only as a renderer with `disableJavaScriptEvaluation` and the static check. C2.11 shows the engine itself handles a variable inside a conditional when the DOM is built directly. The model also defines a `ConditionalBlockDefinition`. That route would give typed validation, a maintained engine and an external standard, for roughly the same amount of our own code.

The counter: we would then own the typer (the markdown typer rejects these DOMs). We would also work around engine behaviour we do not control: scope rules, list evaluation before clause pruning, broken `foreach`, and formula value bugs. And we would still have no id on paragraphs, since the serialiser rejects extra properties. I did not test this DOM-first route beyond C2.11 and C5.11. It is the main open question.

**Confidence:** about 75% that the clause tree is the better choice for this product. I am highly confident in the individual findings above, because each is reproduced by a script. The remaining doubt is the untested DOM-first route.

## Appendix: what was not verified, and files

**Not verified or not run:**
- Real Word editing (both formats).
- Ports of D12-C and the D1-SP templates. Table-row loops are shown failing only in single-feature tests.
- The README's pnpm statement.
- Whether a crafted name actually evaluates code through jsonpath/static-eval. It reaches jsonpath; execution was not proven.
- The DOM-first TemplateMark route, beyond two hand-built DOM checks.
- `TemplateArchiveProcessor` and Cicero archives with `logic/` code, another code path not used here.
- Browser execution and performance.

The Word converter check was time-boxed to one run of `markdown-docx` on two files.

**One temporary change outside the new files.** To find the cause of C2.10, I added two `console.log` lines to `node_modules/@accordproject/template-engine/lib/TemplateMarkInterpreter.js`, ran one case, and restored the file from a copy. Its md5 (`a96cdbee373f1cc6f91bb877cf9954b7`) equals the same file in a fresh scratch install.

**Re-running.** Each script runs from `spikes/template-format/` as `node src/validation/<name>.ts`. The footprint script runs as `bash src/validation/c12-footprint.sh`. All scripts were re-run from scratch at the end, and the outputs were unchanged apart from process ids. `../../node_modules/.bin/tsc -p .` passes with the new files included.

**Scratch installs** (not in the repository) are in the session scratch directory: `c12/{a,b,b2,c}` for footprints, `c13` for `markdown-docx`, and `c11-markers` for the marker files.

**Files created:**
- `src/validation/harness.ts`
- `src/validation/usage-counts.ts`
- `src/validation/c1-nested-fields.ts`
- `src/validation/c2-field-in-condition.ts`
- `src/validation/c3-block-condition.ts`
- `src/validation/c4-enum-condition.ts`
- `src/validation/c5-c6-loops.ts`
- `src/validation/c7-c9-ids-zones-notes.ts`
- `src/validation/c10-names.ts`
- `src/validation/c11-code-execution.ts`
- `src/validation/c12-footprint.sh`
- `src/validation/c13-criterion3.ts`
- `src/validation/sym-tree-check.ts`
- `src/validation/fairness-ports.ts`
- `src/validation/ports/atlas.ts`
- `src/validation/ports/d12b.ts`
- `src/validation/ports/d13b.ts`
- `validation/out/*` (captured `.txt` and `.json` per script, plus `ports/`)
- `validation/RESULTS.md`
