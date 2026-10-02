# Assembly engine

**Build plan block:** B5  
**Milestone:** M1, M3  
**Status:** Built for this slice: assembly, house formatting and Word rendering  
**Decisions:** 0006 (Word rendering), 0008 (format, ids as bookmarks), 0011 (house formatting)  

## What goes here

Deterministic slot filling, the locked contracting-party wording, composition of D1-SP from frozen U3 and D13 versions, batch assembly per portfolio, canonical content plus Word and PDF rendering.

## What's here

| Module | Holds |
|---|---|
| `resolve.ts` | Field values from the records, by the field catalogue's `source` paths. Simple paths are read generically. Joins (director interests), selections (the countersigning signatory, the cost rule in force), derived values, calculations (through `@docsmart/calc`, with evidence) and other documents' values (U3, D13, D15, the earlier agreement) are listed explicitly. Fields filled at signing are left blank. |
| `assemble.ts` | Template + records → assembled document. Refuses a template that breaks the import rules. Decides conditions and loops with the closed grammar, fills fields, removes counsel notes, generates the contracting-party wording (DF-62), leaves AI zones empty (DF-52), drops paragraphs a condition empties, and renumbers. A value it cannot find is marked and reported, never guessed; a condition it cannot decide leaves both branches out. Returns the content hash, every value used (DF-51), the calculation evidence and the hashes of the documents it was built on. |
| `assembled.ts` | The assembled form: every piece of text says whether it is template text, a value (with its origin), a signing blank or a missing value (B7 provenance). The hash is SHA-256 over RFC 8785. |
| `format.ts` | Decision 0011: dates, times, money (never rounded), entered and calculated rates, counts, enums and lists, in one fixed format. |
| `render-word.ts` | Assembled document → Word, with each block id as a bookmark, the “not legal advice” banner, signing lines for blanks and a visible marker for missing values. The template importer reads the ids back. |

## Tests

`pnpm exec vitest run packages/assembly` runs 226 tests:

- The M1 demo: Lumen's creation resolution assembles with nothing missing, and the same inputs give the same hash.
- Every fixture document, and all 41 Atlas subscription agreements, assemble with nothing missing. Each has no stray spaces and no empty paragraphs.
- Conditions, loops, joins, calculations, references and renumbering, document by document.
- Missing values and undecided conditions are reported, not guessed.
- Every rule in decision 0011.
- Every catalogue field and list has a lookup.
- Rendering: deterministic body; bookmarks for every block; the importer reads the ids back.

Twelve deliberately planted bugs were each caught.

## Rules this code must hold

- Same inputs always produce the same canonical content and hash.
- The contracting-party wording is generated from records and read-only (DF-P10, DF-62).
- No model output is used for any slot.

## References

Spec LRA-05; addendum §4.2 and DF-62; build plan B5
