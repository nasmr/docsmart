# 0010 Word import: libraries, and refusing tracked changes

Status: Accepted
Date: 2 October 2026
Decided by: nas

## Context

The template importer (build plan B3, decision 0008) reads counsel's Word masters. A Word file is a zip archive of XML parts, and decision 0005 lists no library for either. Build plan 0.2 also says the importer reads tracked changes, but not what it should do with them.

## Decision

- **Libraries.** `packages/template-library` reads Word files with jszip (3.10, used under its MIT licence) and fast-xml-parser (5.11, MIT). The template-format spike used both and read all nine first-pass templates correctly.
- **Tracked changes.** An import fails while the master has unresolved tracked insertions, deletions or moves, and the error names each place. Counsel accepts or rejects the changes in Word and uploads the master again. The platform never decides which version of counsel's text counts.

## Consequences

- Tracked formatting changes, which do not alter the text, do not block an import.
- `packages/template-library` depends on jszip and fast-xml-parser. Word export stays with the `docx` library (0006).

## Open points

None.
