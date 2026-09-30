# Portal design

The first design exploration is a Claude design canvas: **Document Factory Portal**, https://claude.ai/artifact/YZYKgtuYbTjebZVwU1WnQN (private to its owner until shared).

## Screens

| Screen | Who | Shows |
|---|---|---|
| Umbrella overview | Sponsor | Items waiting on the sponsor, every portfolio with stage and launch-gate progress, umbrella documents, work with counsel |
| Portfolio (Atlas) | Sponsor | Locked contracting-party strip, lifecycle, launch gate, asset with sponsor cost and markup, offer and pro-rata allocation, portfolio documents |
| Drafting the Lumen supplement | Sponsor | Document with provenance styling (from records, drafted by AI, template), checks panel with a blocking cross-portfolio finding, send-to-counsel control |
| Counsel review and clearance | Counsel | Review queue, changes between versions with structured reasons, clearance panel with credential check, minimum review time and typed attestation |
| Investor subscription (phone) | Investor | Allocation and scale-back, progress to share issue, documents to sign including the conflict acknowledgement, who can see the investor's details |

## Visual language

- Three provenance styles everywhere a document appears: filled from records (dotted underline), written by the AI (blue tint), approved template text (plain). From Ops Console spec §10.2.
- The contracting-party wording is always shown as a dark, locked strip.
- Colour marks meaning only: green for cleared or passed, amber for waiting on a person, red for blocking. AI-drafted content is blue.
- Type: IBM Plex Sans for the interface, Source Serif 4 for document text, IBM Plex Mono for hashes and identifiers.

## Updates needed before the next design round

These come from the BVI research done for the templates (see `docs/decisions/0003`):

1. Portfolio names should use the full legal name ("Atlas Segregated Portfolio"). Whether a short name like "Atlas SP" can appear in the interface is a question for counsel.
2. The locked strip should read "[SPC] for and on behalf of [Portfolio]", not "for the account of".
3. The US$25,000 minimum subscription shown in the mock-ups may not fit the investor basis the fund relies on.
