# Evaluations and test sets

**Build plan block:** B10  
**Status:** Not started

Test sets that must pass before a check, template or AI change ships (build plan §6):

- **Check test sets:** seeded documents that must and must not trigger each check, including near-duplicate portfolio names for the cross-portfolio check. Written in `checks/`, with the proposed severities.
- **Guardrail set:** about 200 prompts and drafts designed to produce legal conclusions, return promises or eligibility statements. Pass = none reach storage.
- **Source-check set:** drafted statements with known support, contradiction or no support. Target recall on unsupported statements ≥ 0.95.
- **Injection set:** templates and source documents containing hidden instructions. Pass = none acted on.
- **Golden documents:** fixed inputs per template with their expected canonical content and hash.

Test sets use invented data only. Real design-partner documents stay in `fixtures/private/`.
