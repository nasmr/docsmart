# Check test sets

Test cases for the deterministic checks engine (build plan B6), written before the engine so counsel can agree what each check must and must not catch, and so M2 starts with its tests ready.

| File | What it is |
|---|---|
| `checks.json` | The eight checks, with proposed severities for agreement with counsel (an M0 task). Severities move into SVC-POLICY when it exists. |
| `cases/*.json` | Cases for each check: `must_trigger` and `must_not_trigger`. |
| `cases/baseline.json` | What each clean fixture document should produce with no changes. |

The cases are specifications. Nothing runs them yet. The harness comes with the checks engine in M2, once the canonical content format is settled by the M0 template spike.

## How a case works

Each case starts from a fixture document in `fixtures/meridian-horizon/documents.json`, applies changes, assembles the document, runs the checks, and compares the findings for the check under test with `expect`.

```json
{
  "id": "XP-06", "kind": "must_trigger",
  "title": "Near-duplicate portfolio name, exact form",
  "base": { "document": "doc_atlas_d13" },
  "changes": [{ "op": "insert_text", "at": "§10.1", "text": "Atlas II Segregated Portfolio may …" }],
  "expect": [{ "severity": "blocks", "at": "§10.1", "about": "Atlas II Segregated Portfolio", "refers_to": "pf_atlas2" }]
}
```

- **`base`:** a fixture document id. For the D1-SP batch, add `party`. `template` forces a variant instead of the one selection would pick, and `"*"` means every fixture document.
- **`expect`:** the findings the check under test must produce. For `must_not_trigger` it is empty, apart from the case ids listed in `except`. Findings from other checks are ignored unless listed in `also`.
- **`at`:** a section number from the template ("§10.1"), a heading or table row ("§1 Summary of terms: Minimum subscription"), `zone:<id>`, `locked:contracting_party`, `signature:company` or `Schedule 2`. These become clause IDs once the canonical format exists.
- **`status: pending_decision`:** the expected result depends on an open decision, named in `decision`.

### Changes

| `op` | Does |
|---|---|
| `set_record` | Changes a fixture record before assembly. `path` is `file#dotted.path` (parties by id). `value_from` copies another record. |
| `set_record_after_assembly` | Changes a record after the version was assembled (for example, a rename). |
| `set_input` | Changes an input entered when the document was created. |
| `insert_text`, `replace_text`, `remove` | Edits the assembled content. This stands in for text a person or the AI wrote, or a template edit. |
| `set_provenance` | Changes where a slot's value came from (for example, typed rather than from the calculation service). It never supplies a number. |
| `set_template` | Retires or supersedes a template version. |
| `set_document_state`, `new_version`, `set_reference` | Changes the state or version of a referenced document (U3, D13). |
| `render` | Renders to Word before checking, to show the check ignores rendering. |

No case contains a calculated figure. Calculated slots come from the calculation service or its test double.

## Coverage

| Check | Must trigger | Must not |
|---|---|---|
| required_slot | 12 | 5 |
| cross_reference | 5 | 5 |
| defined_terms | 8 | 4 |
| contracting_party | 7 | 4 |
| cross_portfolio | 13 | 9 |
| retired_template | 2 | 2 |
| reference_state | 5 | 2 |
| jurisdiction_flag | 2 | 1 |

## Findings in the templates as drafted

The defined-terms cases found five review findings in the first-pass templates. `baseline.json` expects them until the templates are revised.

- **DT-04:** D12-B defines “Sponsor” and never uses it.
- **DT-05:** D13-B defines “Conflict Disclosure” in §10.5 and never uses it.
- **DT-06:** D12-C defines “Supplement” twice.
- **DT-07:** D12-C, used for a sponsor-supplied asset, uses “Independent Directors” without defining it. D12-B defines it.
- **DT-08:** D1-SP uses “Offering Memorandum” and “Sponsor” without defining them. This may go away once U3 is drafted.

Separately, every D1-SP fails `reference_state` until U3 exists (RF-02), and every D1SP-C fails `cross_portfolio` until catalogue gap G3 is decided (XP-13).

## Open questions

The first seven are for counsel, alongside the proposed severities in `checks.json`. The last three are for the founder and engineering.

| # | Question | Cases |
|---|---|---|
| Q1 | INV-10 blocks another portfolio's monetary figures. Portfolios often share figures by coincidence (round minimums, prices). The cases block only figures that belong to another portfolio and not to this one. Is that the right rule? Should figure matches be review rather than blocking? | XP-11, XP-12, XP-N5 |
| Q2 | Some mentions of another portfolio's asset are innocent (the issuer's competitor). Should they still block? | XP-04 |
| Q3 | Which near-duplicate forms count as the same name? The cases propose: ignore case and punctuation, SP = Segregated Portfolio, II = 2. | XP-07, XP-N2 |
| Q4 | Catalogue gap G3: D1SP-C names the investor's earlier portfolio. | XP-13 |
| Q5 | DF-03 says a retired template is flagged, not blocked, but gate condition 1 requires one that is not retired. Should in-flight documents on a retired template be able to reach READY_FOR_SUBMISSION? | RT-01 |
| Q6 | Must every portfolio amount be in the portfolio's base currency? | RQ-03 |
| Q7 | Must the designation appear in every company execution block, not only the locked strip? | CP-06, CP-07 |
| Q8 | A blocking false positive has no way out in this slice. Build plan B6 lets blocking findings only be fixed, DF-63 lets counsel mark a false positive, and there is no counsel in this slice. Who can resolve one? | All `blocks` cases |
| Q9 | Where do the jurisdiction applicability lists come from? The cases use a placeholder. | JF-* |
| Q10 | A person who invests in another portfolio may appear in this portfolio's documents in another role (for example, as signatory for an investing entity). Is that a leak? | Not yet covered |

## Proposed detection rules

These rules are implied by the cases and are for review with engineering.

- **Defined terms:** a "use" is a capitalised phrase that matches a term defined in this document, in a document it incorporates, or in the platform's term list for the document family. Proper names that are not in any of these are ignored. The Offering Memorandum's terms come from the U2 import; until then, from `umbrella.offering_memorandum.defined_terms` in the fixture.
- **Cross-portfolio:** names are matched as whole names after normalising, never as single words. Figures are normalised before comparing (US$25,000 = USD 25,000.00; 3 million = 3,000,000). Umbrella-level records and this portfolio's own records are excluded, and so are investors in both portfolios.
- **Contracting party:** the designation is matched exactly against the current records, not the slot snapshot.
