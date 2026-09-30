const fs = require('fs');
const { T, ST, H, P, N, BUL, TABLE, SPACER, build } = require('./lib');

const slots = JSON.parse(fs.readFileSync(process.argv[2] + '/_slots.json', 'utf8'));

// Where each field comes from, and what it means.
const src = {
  umbrella: 'Umbrella record', portfolio: 'Portfolio record', asset: 'Asset record', sponsor: 'Sponsor record',
  investor: 'Investor record (identity module)', subscription: 'Offer and allocation', payment: 'Administrator’s verified bank record',
  resolution: 'Entered when the document is created', meeting: 'Entered when the document is created', supplement: 'Document record',
  director: 'Umbrella record (directors)', signatory: 'Investor record (authorised signatories)', person: 'Investor record (controllers)',
  company_signatory: 'Umbrella record (authorised signatories)', conflict_disclosure: 'Document record',
};
const computed = new Set(['asset.markup_pct', 'subscription.allocated_amount', 'subscription.shares', 'asset.total_consideration',
  'portfolio.supplement_hash', 'umbrella.subscription_terms_hash']);
const d = {
  'asset.completion_window_days': 'Days after the offer closes to complete secondary purchases', 'asset.consent_status': 'Status of issuer consent / ROFR waiver',
  'asset.instrument': 'Class of shares bought, e.g. “Series B preferred shares”', 'asset.issuer_jurisdiction': 'Where the issuer is incorporated',
  'asset.issuer_name': 'Legal name of the company invested in', 'asset.long_stop_date': 'Date by which the financing round must close',
  'asset.markup_pct': 'Transfer price over sponsor’s cost, as a percentage', 'asset.max_quantity': 'Maximum number of shares to buy',
  'asset.placement_agent_name': 'Intermediary paid for sourcing shares', 'asset.placement_fee_description': 'Placement fee amount or basis',
  'asset.price_per_share': 'Price the portfolio pays per share', 'asset.round_name': 'Name of the financing round',
  'asset.seller_name': 'Seller of the shares', 'asset.sponsor_acquisition_date': 'Date the sponsor affiliate acquired the shares',
  'asset.sponsor_cost_per_share': 'Sponsor affiliate’s cost per share (evidence required)', 'asset.sponsor_retained_quantity': 'Shares the sponsor keeps directly',
  'asset.total_consideration': 'Maximum total price (quantity × price)', 'asset.transfer_restrictions': 'Issuer restrictions on transfer (ROFR, consent)',
  'asset.valuation_date': 'Date of the independent valuation', 'asset.valuation_range': 'Valuer’s value or range per share', 'asset.valuer_name': 'Independent valuer',
  'company_signatory.name': 'Director signing for the Company', 'company_signatory.title': 'Signatory’s title',
  'conflict_disclosure.date': 'Date of the conflict disclosure statement',
  'director.interest_description': 'Nature of a director’s interest', 'director.name': 'Director’s name', 'director.signed_date': 'Date the director signed',
  'investor.changes_since_prior': 'Changes to details since the earlier agreement', 'investor.date_of_birth': 'Date of birth',
  'investor.display_name': 'Investor name (individual or entity)', 'investor.email': 'Email for notices', 'investor.entity_type': 'Company, partnership, trust, etc.',
  'investor.existing_portfolio_name': 'Portfolio the investor already holds', 'investor.full_name': 'Individual’s full legal name',
  'investor.identity_ref': 'Platform identity reference', 'investor.jurisdiction': 'Entity’s place of formation', 'investor.kyc_completed_date': 'Date identity checks last completed',
  'investor.legal_name': 'Entity’s legal name', 'investor.nationality': 'Nationality', 'investor.notice_contact': 'Contact person for notices',
  'investor.prior_agreement_date': 'Date of the earlier subscription agreement', 'investor.prior_agreement_ref': 'Reference of the earlier agreement',
  'investor.registered_address': 'Entity’s registered address', 'investor.registration_number': 'Entity’s registration number',
  'investor.residential_address': 'Residential address', 'investor.signed_date': 'Date the investor signed', 'investor.status_selected': 'Investor-status option ticked',
  'investor.tax_id': 'Tax identification number', 'investor.tax_residence': 'Country of tax residence', 'investor.trust_name': 'Name of the trust (trustee investors)',
  'meeting.chair_name': 'Chair of the meeting', 'meeting.date': 'Meeting date', 'meeting.in_attendance': 'Non-directors attending', 'meeting.minutes_signed_date': 'Date minutes signed',
  'meeting.place': 'Place or video platform', 'meeting.time': 'Meeting time',
  'payment.account_name': 'Receiving account name', 'payment.account_number': 'Account number or IBAN', 'payment.bank_name': 'Receiving bank',
  'payment.reference': 'Payment reference for this investor', 'payment.swift': 'SWIFT/BIC',
  'person.name': 'Signatory or beneficial owner', 'person.ownership_description': 'Ownership or control held', 'person.role': 'Role',
  'portfolio.allocation_method_description': 'How oversubscription is allocated, in words', 'portfolio.base_currency': 'Portfolio currency',
  'portfolio.extension_years': 'Maximum extension of the term', 'portfolio.fee_basis': 'What the management fee is charged on', 'portfolio.fee_frequency': 'How often fees are paid',
  'portfolio.funding_deadline': 'Date cleared funds are due', 'portfolio.hurdle_rate': 'Annual hurdle before performance fee', 'portfolio.lapse_cost_cap': 'Cap on costs deducted if the offer lapses',
  'portfolio.legal_name': 'Portfolio’s full name, including “Segregated Portfolio”', 'portfolio.max_offer': 'Hard cap on subscriptions',
  'portfolio.mgmt_fee_rate': 'Management fee rate', 'portfolio.min_subscription': 'Minimum per investor', 'portfolio.minimum_close_amount': 'Minimum raised for the portfolio to proceed',
  'portfolio.offer_close_date': 'Offer close date', 'portfolio.offer_open_date': 'Offer open date', 'portfolio.org_expense_cap': 'Cap on organisational expenses',
  'portfolio.perf_fee_rate': 'Performance fee rate', 'portfolio.share_class_name': 'Name of the portfolio’s share class', 'portfolio.share_par_value': 'Par value per share',
  'portfolio.subscription_price': 'Issue price per portfolio share', 'portfolio.supplement_hash': 'Content hash of the cleared supplement',
  'portfolio.supplement_number': 'Supplement number under the offering memorandum', 'portfolio.term_years': 'Portfolio term in years',
  'resolution.date': 'Date of the resolutions', 'resolution.effective_date': 'Date the portfolio is created',
  'signatory.name': 'Investor’s authorised signatory', 'signatory.signed_date': 'Date signed', 'signatory.title': 'Signatory’s title',
  'sponsor.legal_name': 'Sponsor’s legal name',
  'subscription.accepted_date': 'Date the Company accepted', 'subscription.allocated_amount': 'Amount accepted after allocation',
  'subscription.requested_amount': 'Amount applied for', 'subscription.shares': 'Portfolio shares to issue',
  'supplement.date': 'Date of the supplement',
  'umbrella.administrator_name': 'Fund administrator', 'umbrella.company_number': 'BVI company number', 'umbrella.cost_rule_ref': 'Cost-allocation rule in force',
  'umbrella.fund_category': 'Regulatory category, e.g. private investment fund', 'umbrella.investor_basis_description': 'Investor basis relied on, in words',
  'umbrella.legal_name': 'SPC’s legal name, including “Segregated Portfolio Company” or “SPC”', 'umbrella.om_date': 'Date of the offering memorandum',
  'umbrella.related_party_consent_clause': 'Offering memorandum clause requiring related-party consent',
  'umbrella.subscription_terms_hash': 'Content hash of the cleared subscription terms', 'umbrella.subscription_terms_version': 'Version of the subscription terms',
};

const missing = Object.keys(slots).filter((k) => !d[k]);
if (missing.length) { console.error('Missing descriptions:', missing); process.exit(1); }

const templates = [
  ['D12-A', 'Creation resolution: directors’ written resolutions, asset from the issuer or an unrelated seller', 'Default choice for a new portfolio'],
  ['D12-B', 'Creation resolution: written resolutions with approval of an acquisition from a sponsor affiliate', 'Sponsor supplies the asset'],
  ['D12-C', 'Creation resolution: minutes of a board meeting', 'Directors meet instead of signing in writing, or an interested director must abstain'],
  ['D13-A', 'Portfolio supplement: investment in a company’s financing round', 'Portfolio buys newly issued shares'],
  ['D13-B', 'Portfolio supplement: purchase from a sponsor affiliate', 'Sponsor supplies the asset (use with D12-B or D12-C)'],
  ['D13-C', 'Portfolio supplement: purchase from unrelated existing shareholders', 'Secondary purchase subject to issuer consent'],
  ['D1SP-A', 'Subscription agreement: individual investor', 'First subscription by a person'],
  ['D1SP-B', 'Subscription agreement: company, partnership or trust', 'First subscription by an entity'],
  ['D1SP-C', 'Subscription agreement: short form for an existing investor', 'Investor already holds another portfolio'],
];

const flags = [
  ['umbrella.is_regulated_fund', 'FSC prior approval (true) or FSC notification within 14 days (false) when creating a portfolio', 'D12-A, B, C'],
  ['umbrella.fund_category', 'Includes the private-investment-fund eligibility clause when the category is private_investment_fund', 'D13-A, B, C'],
  ['umbrella.om_requires_related_party_consent', 'Adds a consent condition to sponsor-supplied acquisitions', 'D12-B, D13-B'],
  ['asset.acquisition_source', 'gp_sourced adds conflict wording and the investor’s conflict acknowledgement', 'D12-C, D1SP-A, B, C'],
  ['asset.sponsor_retains_shares', 'States the sponsor’s remaining direct holding', 'D13-B'],
  ['asset.has_placement_fee', 'Discloses a fee paid to an intermediary', 'D13-C'],
  ['portfolio.has_hurdle', 'Adds a hurdle to the performance fee', 'D13-A, B, C'],
  ['portfolio.costs_deducted_on_lapse', 'Deducts capped costs if the round never closes', 'D13-A'],
  ['director.is_interested / director.abstains', 'Declarations of interest and abstention', 'D12-B, D12-C'],
  ['investor.type', 'Individual or entity wording and signature blocks', 'D1SP-A, B, C'],
  ['investor.formed_for_investment / investor.is_trustee', 'Look-through confirmation; trustee limitation', 'D1SP-B'],
  ['resolution.effective_date_differs', 'Effective date later than signing', 'D12-A, B'],
];

const meta = { id: 'Guide', noCover: true, file: '00_Template_Pack_Guide.docx', name: 'Template pack guide' };
const body = [
  T('First-pass template pack'),
  ST('BVI segregated portfolio company · creation resolution, portfolio supplement, subscription agreement'),
  ST('Singularity Document Factory · version 0.1 · 30 September 2026'),
  SPACER(),
  P('These nine templates are first drafts written for the Document Factory, to be reviewed, corrected and approved by BVI counsel before any is used. They are not legal advice. They were written from the platform’s design documents and public guidance from BVI law firms, not from any law firm’s own precedents.'),
  P('Each template begins with a cover page stating when to use it and the specific questions for counsel. The markings are the same in every template: highlighted fields filled by code from records, conditional sections, blue boxes the AI may draft, the locked contracting-party wording, and amber notes for counsel that are removed when a document is assembled.'),
  H('1 The templates'),
  TABLE([['ID', 'Document', 'Use when'], ...templates], [1100, 4700, 3226], { header: true }),
  H('2 What the research changed'),
  P('Public guidance from BVI law firms and the FSC’s regulations turned up points that differ from the platform’s earlier design notes. All are for counsel to confirm.'),
  ...BUL([
    'Portfolio names. Each segregated portfolio’s name must include the words “Segregated Portfolio” (Harneys; Carey Olsen). The design so far has used short names like “Atlas SP”. The templates use the full name in the portfolio.legal_name field; whether a short name can appear in investor materials is a question for counsel.',
    'SPC name. The Company’s name must include “Segregated Portfolio Company” or “SPC” (Conyers).',
    'Contracting wording. A contract meant to bind a portfolio must state that it is executed by the SPC for and on behalf of that portfolio (Harneys). The templates use “[SPC] for and on behalf of [Portfolio]” rather than the “for the account of” wording in the earlier design notes. Failing to identify the portfolio risks the document being treated as the SPC’s own.',
    'Creating a portfolio. A regulated fund needs the FSC’s prior approval to create a new portfolio; an unregulated SPC notifies the FSC within 14 days (Harneys; FSC regulations, reg. 7). The resolutions handle both through a condition.',
    'Investor rules. A closed-ended, deal-by-deal fund is most likely a private investment fund. The sources describe limits of 50 investors, private invitation only, or professional and exempted investors only, with a US$100,000 minimum initial investment for professional investors (Carey Olsen). The portal design used a US$25,000 minimum, which only works under some of those options.',
    'No cross-portfolio recourse. Creditors of a portfolio have recourse only to that portfolio’s assets and, if those are insufficient, the general assets; certain terms are implied into contracts unless excluded (Ogier). The subscription agreements include an express acknowledgement.',
  ]),
  H('3 Condition flags'),
  P('These values decide which conditional sections are included. They come from the umbrella, portfolio, asset or investor records.'),
  TABLE([['Flag', 'Effect', 'Used in'], ...flags], [3000, 4226, 1800], { header: true }),
  H('4 Field dictionary'),
  P('Every field used across the nine templates, where it comes from and which templates use it. Fields marked “calculated” are computed by the calculation service or the platform, never entered by hand.'),
  TABLE([['Field', 'Meaning', 'Source', 'Used in'],
    ...Object.entries(slots).map(([k, v]) => [k, d[k], computed.has(k) ? 'Calculated' : (src[k.split('.')[0]] || 'Document record'), v.join(', ')])],
    [2700, 3000, 1726, 1600], { header: true, size: 16 }),
  H('5 Suggested order for counsel review'),
  ...BUL([
    'D12-A and D13-A first, together: they set the base wording for the other variants.',
    'D1SP-A next, with the Company’s general subscription terms (not included in this pack), since the subscription agreement incorporates them.',
    'Then the sponsor-supplied set (D12-B, D13-B) and the remaining variants.',
  ]),
  H('Sources'),
  ...BUL([
    'Harneys, “Segregated portfolio companies in the British Virgin Islands”: harneys.com/insights/segregated-portfolio-companies-in-the-british-virgin-islands/',
    'Harneys, “Contracting with segregated portfolio companies — what any lender should know”: harneys.com/insights/contracting-with-segregated-portfolio-companies-what-any-lender-should-know/',
    'BVI FSC, Segregated Portfolio Companies (BVI Business Company) Regulations: bvifsc.vg/sites/default/files/segregated_portfolio_companies_bvi_business_company_regulations_2018.pdf',
    'Conyers, “British Virgin Islands Segregated Portfolio Companies”: conyers.com/wp-content/uploads/2018/10/Segregated_Portfolio_Companies-BVI-2.pdf',
    'Ogier, “Segregated Portfolio Companies in the BVI”: ogier.com/news-and-insights/insights/segregated-portfolio-companies-in-the-bvi/',
    'Carey Olsen, “A guide to British Virgin Islands (BVI) investment funds”: careyolsen.com/insights/briefings/guide-investment-funds-british-virgin-islands-bvi',
  ]),
];

build(meta, body, process.argv[2]).then((f) => console.log('built', f));
