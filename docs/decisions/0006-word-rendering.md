# 0006 Render Word documents from the canonical content

Status: Accepted
Date: 1 October 2026
Decided by: nas
Supersedes: the Word rendering row of 0002

## Context

0002 left Word rendering open between docxtemplater core and a Python renderer, and 0005 listed it as an open point. Both of those options fill tags in a Word file. The content hash, the checks and the diffs all work on the canonical content (0005 item 5), not on the Word file.

## Decision

Word documents are rendered from the canonical content with the `docx` library (MIT; 9.8 at the time of this decision). This is the library the template generator in `templates/generator` already uses. The renderer is a pure function of a `DraftVersion`'s canonical content and a style sheet. It adds nothing that isn't in the canonical content, except platform-rendered furniture: the "not legal advice" banner, headers and footers, and page numbers.

PDF rendering stays deferred to M2.

## Why

- What people read is exactly what was checked and hashed. Filling tags in a separate Word file lets the two drift apart, for example through text in the Word file that the canonical content lacks.
- The generator already produces the target styling (clause numbering, the locked contracting-party box, counsel notes) with this library, so the rendering code has a working starting point.
- No paid modules. docxtemplater's HTML, image and several other modules are paid.
- It stays in TypeScript, with no Python service in this slice.

## Consequences

- Firm styling is reproduced through our style sheet, not taken from the firm's own Word file. If a firm insists on its exact formatting, revisit with a new decision.
- Rendering is deterministic, but the Word file is not what gets hashed. The canonical content is.
- Resolves the Word rendering open point in 0005.
- Word import (counsel's edited masters into the canonical format) is a separate question for the M0 spike.

## Open points

None.
