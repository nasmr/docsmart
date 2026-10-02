const { T, ST, H, P, N, LOCK, COND, BUL, CHECK, TABLE, SIG, SPACER } = require('./lib');

const pifQ = 'Confirm the investor-status options in section 4. The sources reviewed describe a professional investor as a person whose ordinary business involves acquiring property of the same kind as the fund’s, or with net worth above US$1,000,000, with a minimum initial investment of US$100,000; and exempted investors with no minimum. Which options apply, and is a 50-investor limit relied on?';
const usQ = 'Should US persons be excluded, and what US securities-law representations are needed if not?';
const amlQ = 'Confirm the anti-money-laundering documents and the beneficial-ownership threshold required by the administrator and BVI rules.';

function head(sub) {
  return [
    T('SUBSCRIPTION AGREEMENT'),
    ST(sub),
    T('{{portfolio.legal_name}}'),
    ST('a segregated portfolio of {{umbrella.legal_name}}'),
    SPACER(),
    LOCK('{{umbrella.legal_name}} for and on behalf of {{portfolio.legal_name}}'),
  ];
}

function incorporation() {
  return [
    H('1 Documents that form part of this agreement'),
    P('1.1 This agreement is made between the company named above (the “Company”), acting for and on behalf of the segregated portfolio named above (the “Portfolio”), and the investor named in Schedule 1 (the “Investor”).', 1),
    P('1.2 This agreement incorporates, and must be read with: (a) the Company’s general subscription terms, version {{umbrella.subscription_terms_version}} (the “Subscription Terms”); (b) the Offering Memorandum dated {{umbrella.om_date}}; and (c) Supplement No. {{portfolio.supplement_number}} relating to the Portfolio dated {{supplement.date}} (the “Supplement”). If they are inconsistent, this agreement prevails, then the Supplement, then the Subscription Terms, then the Offering Memorandum.', 1),
    N('The platform records the exact versions (content hashes) of the Subscription Terms and the Supplement this agreement was assembled from: {{umbrella.subscription_terms_hash}} and {{portfolio.supplement_hash}}. Please confirm whether the hashes should also appear in the executed document.'),
  ];
}

function subscription() {
  return [
    H('2 Subscription and allocation'),
    P('2.1 The Investor applies to subscribe for Portfolio Shares for {{subscription.requested_amount}}.', 1),
    P('2.2 The Company may accept this application in whole or in part. If applications for the Portfolio exceed the maximum offer, allocations are made {{portfolio.allocation_method_description}}. The Company will notify the Investor of the amount accepted (the “Allocated Amount”) and the number of Portfolio Shares to be issued at {{portfolio.subscription_price}} per share, rounded down to a whole share.', 1),
    P('2.3 This agreement becomes binding on the Company only when the Company countersigns it or notifies the Investor of the Allocated Amount, whichever is earlier.', 1),
    H('3 Payment'),
    P('3.1 The Investor must pay the Allocated Amount in cleared funds by {{portfolio.funding_deadline}} to the account set out in Schedule 2, from an account in the Investor’s own name.', 1),
    P('3.2 If the offer lapses or is not accepted, or the Allocated Amount is less than the amount paid, the Company will return the excess without interest to the account from which it was paid.', 1),
  ];
}

function status() {
  return [
    H('4 Investor status'),
    P('4.1 The Investor confirms that they are (tick one):', 1),
    ...CHECK([
      'a professional investor: their ordinary business involves acquiring or disposing of property of the same kind as the property of the Portfolio, or their net worth (alone or with their spouse) is more than US$1,000,000, and their initial investment in the Company is at least US$100,000;',
      'an exempted investor within the meaning of the rules that apply to the Company; or',
      'eligible on another basis set out in the Supplement: {{umbrella.investor_basis_description}}.',
    ]),
    N(pifQ),
  ];
}

function acknowledgements(extra = []) {
  return [
    H('5 Representations and acknowledgements'),
    P('5.1 The Investor confirms that:', 1),
    ...BUL([
      'they have received and read the Offering Memorandum, the Supplement and the Subscription Terms, and have had the opportunity to ask questions and take independent legal, tax and financial advice;',
      'they are not relying on any statement by the Company, the Sponsor, any segregated portfolio or the platform through which this agreement is made, other than those in the documents listed in clause 1.2, and none of them has given the Investor investment, legal or tax advice;',
      'they understand that an investment in the Portfolio is high-risk, that they may lose all of the amount invested, and that Portfolio Shares cannot be redeemed at their request and have no market;',
      'they are subscribing for their own account[[IF investor.type = entity]] or as permitted by clause 6[[END IF]] and not with a view to reselling;',
      'the money used to subscribe is not the proceeds of crime, and they are not a person subject to sanctions under the laws that apply to the Company;',
      'all information they have given the Company is true and complete, and they will tell the Company promptly if it changes.',
      ...extra,
    ]),
    N(usQ),
    H('Segregation of the Portfolio'),
    P('5.2 The Investor acknowledges that the Portfolio is a segregated portfolio of the Company; that its rights as a holder of Portfolio Shares are only against the assets of the Portfolio; and that they have no claim against, and will not seek to recover from, the assets of any other segregated portfolio of the Company.', 1),
    COND('[[IF asset.acquisition_source = gp_sourced]]'),
    H('Conflict of interest'),
    P('5.3 The Investor acknowledges that they have received and read the conflict disclosure statement dated {{conflict_disclosure.date}}, which explains that the Portfolio is buying its investment from an affiliate of the Sponsor at {{asset.price_per_share}} per share, a markup of {{asset.markup_pct}} on the affiliate’s cost of {{asset.sponsor_cost_per_share}} per share.', 1),
    COND('[[END IF]]'),
  ];
}

function amlDataTax() {
  return [
    H('7 Anti-money laundering'),
    P('7.1 The Investor will provide any information and documents the Company or its administrator reasonably requests to verify the Investor’s identity, source of funds and, where relevant, beneficial owners. If the Investor does not, the Company may refuse the application, withhold payments or compulsorily redeem the Investor’s Portfolio Shares, as permitted by the Offering Memorandum.', 1),
    N(amlQ),
    H('8 Personal information and sharing'),
    P('8.1 The Company and its administrator will use the Investor’s information to administer the Investor’s holding in the Portfolio and to meet legal obligations. The Investor’s information will not be shared with any other segregated portfolio of the Company, or used to offer the Investor any other investment, unless the Investor has given separate permission for that purpose.', 1),
    H('9 Tax information'),
    P('9.1 The Investor will complete the tax self-certification required for the US Foreign Account Tax Compliance Act and the OECD Common Reporting Standard, and agrees that the Company may report information about the Investor’s holding to tax authorities as required by law.', 1),
    H('10 Signing and governing law'),
    P('10.1 This agreement may be signed electronically and in counterparts.', 1),
    P('10.2 This agreement is governed by the laws of the Virgin Islands, and the courts of the Virgin Islands have jurisdiction over any dispute arising from it.', 1),
    N('Confirm electronic signature is valid for this document under BVI law and acceptable to the administrator, and whether a different dispute forum is preferred.'),
  ];
}

function acceptance() {
  return [
    ...SIG('Accepted by the Company', [
      '{{umbrella.legal_name}} for and on behalf of {{portfolio.legal_name}}',
      'By: {{company_signatory.name}}, {{company_signatory.title}}',
      'Allocated Amount: {{subscription.allocated_amount}} for {{subscription.shares}} Portfolio Shares',
      'Date: {{subscription.accepted_date}}',
    ]),
  ];
}

function paymentSchedule() {
  return [
    H('Schedule 2 · Payment instructions'),
    TABLE([
      ['Account name', '{{payment.account_name}}'],
      ['Bank', '{{payment.bank_name}}'],
      ['Account number / IBAN', '{{payment.account_number}}'],
      ['SWIFT / BIC', '{{payment.swift}}'],
      ['Reference', '{{payment.reference}}'],
      ['Deadline', '{{portfolio.funding_deadline}}'],
    ], [2800, 6226], { labelCol: true }),
    N('Payment details are filled from the administrator’s verified record and shown to the investor through the platform as well, so that a changed account number in an email cannot redirect funds.'),
  ];
}

// ---------- A: individual ----------
const A = {
  meta: {
    id: 'D1SP-A', file: 'D1SP-A_Subscription_Individual.docx',
    name: 'Subscription agreement for a segregated portfolio: individual investor',
    cls: 'D1-SP Subscription agreement (portfolio schedule to the umbrella subscription terms)',
    variant: 'A · Individual investor, first subscription with the Company',
    use: 'A natural person subscribing for shares in one portfolio for the first time. Assembled once per investor per portfolio from the cleared Subscription Terms and Supplement.',
    scope: 'Portfolio (one per investor per portfolio)',
    signed: 'The investor; countersigned by the Company for and on behalf of the Portfolio',
    cond: 'Conflict acknowledgement when the asset is supplied by the sponsor.',
    questions: [pifQ, usQ, amlQ, 'Should joint holders (for example spouses) use this variant with a second signature block, or a separate variant?'],
  },
  body: () => [
    ...head('for an individual investor'),
    ...incorporation(), ...subscription(), ...status(), ...acknowledgements(),
    H('6 Capacity'),
    P('6.1 The Investor confirms that they are at least 18 years old, have full legal capacity to enter into this agreement, and are not bankrupt or subject to any insolvency proceedings.', 1),
    ...amlDataTax(),
    ...SIG('Signed by the Investor', ['{{investor.full_name}}', 'Date: {{investor.signed_date}}']),
    ...acceptance(),
    H('Schedule 1 · Investor details'),
    TABLE([
      ['Full name', '{{investor.full_name}}'],
      ['Date of birth', '{{investor.date_of_birth}}'],
      ['Nationality', '{{investor.nationality}}'],
      ['Residential address', '{{investor.residential_address}}'],
      ['Tax residence and tax number', '{{investor.tax_residence}} · {{investor.tax_id}}'],
      ['Email', '{{investor.email}}'],
      ['Amount applied for', '{{subscription.requested_amount}}'],
      ['Investor status (clause 4)', '{{investor.status_selected}}'],
      ['Platform identity reference', '{{investor.identity_ref}}'],
    ], [2800, 6226], { labelCol: true }),
    ...paymentSchedule(),
  ],
};

// ---------- B: entity ----------
const B = {
  meta: {
    id: 'D1SP-B', file: 'D1SP-B_Subscription_Entity.docx',
    name: 'Subscription agreement for a segregated portfolio: company, partnership or trust',
    cls: 'D1-SP Subscription agreement',
    variant: 'B · Entity investor (company, partnership, trust or family office vehicle)',
    use: 'An investing entity subscribes through authorised signatories. Adds capacity, authority and beneficial-ownership provisions, and a look-through question relevant to any investor-count limit.',
    scope: 'Portfolio (one per investor per portfolio)',
    signed: 'Authorised signatories of the investor; countersigned by the Company for and on behalf of the Portfolio',
    cond: 'Conflict acknowledgement when the asset is supplied by the sponsor; trust-specific wording when the investor is a trustee.',
    questions: [
      'If the Company relies on a limit on the number of investors, must an entity formed to invest in the Portfolio be looked through to its own investors? The template asks the investor to confirm this (clause 6.2).',
      amlQ, pifQ,
      'What wording is needed when the investor is a trustee, to limit its liability to the trust assets?',
    ],
  },
  body: () => [
    ...head('for a company, partnership or trust'),
    ...incorporation(), ...subscription(), ...status(), ...acknowledgements(),
    H('6 Capacity and authority'),
    P('6.1 The Investor confirms that it is duly formed and validly existing under the laws of {{investor.jurisdiction}}; that it has the power to enter into and perform this agreement; that this agreement has been duly authorised; and that the persons signing it are authorised to do so.', 1),
    P('6.2 The Investor confirms that it [[IF investor.formed_for_investment]]was[[ELSE]]was not[[END IF]] formed for the purpose of investing in the Portfolio, and that it will tell the Company the number of persons with an economic interest in it if the Company asks.', 1),
    COND('[[IF investor.is_trustee]]'),
    P('6.3 The Investor enters into this agreement as trustee of {{investor.trust_name}}.', 1),
    N('Counsel to supply the wording that limits the Investor’s liability under this agreement to the assets of the trust.'),
    COND('[[END IF]]'),
    ...amlDataTax(),
    H('Signed for and on behalf of the Investor'),
    COND('[[FOR EACH signatory IN investor.authorised_signatories]]'),
    ...SIG('{{signatory.name}}', ['{{signatory.title}}, for and on behalf of {{investor.legal_name}}', 'Date: {{signatory.signed_date}}']),
    COND('[[END FOR EACH]]'),
    ...acceptance(),
    H('Schedule 1 · Investor details'),
    TABLE([
      ['Legal name', '{{investor.legal_name}}'],
      ['Type', '{{investor.entity_type}}'],
      ['Jurisdiction and registration number', '{{investor.jurisdiction}} · {{investor.registration_number}}'],
      ['Registered address', '{{investor.registered_address}}'],
      ['Tax residence and tax number', '{{investor.tax_residence}} · {{investor.tax_id}}'],
      ['Contact for notices', '{{investor.notice_contact}}'],
      ['Amount applied for', '{{subscription.requested_amount}}'],
      ['Investor status (clause 4)', '{{investor.status_selected}}'],
      ['Platform identity reference', '{{investor.identity_ref}}'],
    ], [2800, 6226], { labelCol: true }),
    SPACER(),
    P('Authorised signatories and beneficial owners:'),
    TABLE([
      ['Name', 'Role', 'Ownership or control'],
      ['[[FOR EACH person IN investor.controllers]] {{person.name}}', '{{person.role}}', '{{person.ownership_description}} [[END FOR EACH]]'],
    ], [3400, 2800, 2826], { header: true }),
    ...paymentSchedule(),
  ],
};

// ---------- C: existing investor short form ----------
const Cv = {
  meta: {
    id: 'D1SP-C', file: 'D1SP-C_Subscription_Existing_Investor_Short_Form.docx',
    name: 'Subscription agreement for a segregated portfolio: short form for an existing investor',
    cls: 'D1-SP Subscription agreement',
    variant: 'C · Short form for an investor already onboarded to the Company through another portfolio',
    use: 'An investor who already holds shares in another portfolio of the Company, with identity and investor-status checks on file, subscribes to a new portfolio. Repeats the earlier confirmations as at today instead of collecting them again.',
    scope: 'Portfolio (one per investor per portfolio)',
    signed: 'The investor (individual or authorised signatories); countersigned by the Company for and on behalf of the Portfolio',
    cond: 'Individual or entity signature block; conflict acknowledgement when the asset is supplied by the sponsor; updated-details section when anything has changed.',
    questions: [
      'Is it acceptable to incorporate the confirmations from an earlier subscription agreement by reference and repeat them as at the date of this agreement?',
      'How old can identity and anti-money-laundering records be before they must be refreshed for a new subscription?',
      'Does the investor-status confirmation need to be repeated in full for each portfolio, for example because the minimum investment applies per portfolio?',
    ],
  },
  body: () => [
    ...head('short form for an existing investor'),
    ...incorporation(),
    P('1.3 The Investor already holds shares in {{investor.existing_portfolio_name}} under a subscription agreement dated {{investor.prior_agreement_date}} (reference {{investor.prior_agreement_ref}}) (the “Earlier Agreement”).', 1),
    ...subscription(),
    H('4 Confirmations repeated'),
    P('4.1 The Investor repeats, as at the date of this agreement and in relation to the Portfolio, every confirmation, representation and acknowledgement it gave in the Earlier Agreement, including its investor status under clause 4 of the Earlier Agreement, as if each reference in the Earlier Agreement to the portfolio named there were a reference to the Portfolio.', 1),
    P('4.2 The information the Investor gave the Company for anti-money-laundering and tax purposes remains true and complete, except as set out in Schedule 1, part B.', 1),
    P('4.3 The Investor has received and read the Supplement for the Portfolio and understands that the Portfolio is a separate segregated portfolio with its own investment, risks, fees and terms, and that its rights are only against the assets of the Portfolio.', 1),
    COND('[[IF asset.acquisition_source = gp_sourced]]'),
    P('4.4 The Investor has received and read the conflict disclosure statement dated {{conflict_disclosure.date}} relating to the Portfolio’s purchase of its investment from an affiliate of the Sponsor.', 1),
    COND('[[END IF]]'),
    N('This variant only works if the Earlier Agreement’s confirmations are expressed so that they can be repeated. If counsel prefers, clause 4 can instead list the confirmations again in full, using the text of variant A or B.'),
    H('5 Personal information and sharing'),
    P('5.1 The Investor permits the Company to use the information it holds from the Earlier Agreement for the purposes of this subscription. This permission applies to the Portfolio only.', 1),
    H('6 Signing and governing law'),
    P('6.1 Clauses 7 to 10 of the Earlier Agreement apply to this agreement as if set out in full, and this agreement is governed by the laws of the Virgin Islands.', 1),
    COND('[[IF investor.type = individual]]'),
    ...SIG('Signed by the Investor', ['{{investor.full_name}}', 'Date: {{investor.signed_date}}']),
    COND('[[ELSE]]'),
    COND('[[FOR EACH signatory IN investor.authorised_signatories]]'),
    ...SIG('{{signatory.name}}', ['{{signatory.title}}, for and on behalf of {{investor.legal_name}}', 'Date: {{signatory.signed_date}}']),
    COND('[[END FOR EACH]]'),
    COND('[[END IF]]'),
    ...acceptance(),
    H('Schedule 1 · Investor details'),
    P('Part A · Details held from the Earlier Agreement'),
    TABLE([
      ['Name', '{{investor.display_name}}'],
      ['Platform identity reference', '{{investor.identity_ref}}'],
      ['Identity checks last completed', '{{investor.kyc_completed_date}}'],
      ['Investor status on file', '{{investor.status_selected}}'],
      ['Amount applied for', '{{subscription.requested_amount}}'],
    ], [2800, 6226], { labelCol: true }),
    SPACER(),
    P('Part B · Changes since the Earlier Agreement'),
    P('{{investor.changes_since_prior}}'),
    ...paymentSchedule(),
  ],
};

module.exports = [A, B, Cv];
