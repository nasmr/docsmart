const { T, ST, H, P, N, LOCK, COND, BUL, TABLE, SIG, SPACER } = require('./lib');

const regulatoryQ = 'Is the Company a regulated fund (for example a private investment fund recognised under SIBA) or unregulated? The source reviewed says a regulated fund needs the FSC’s prior approval to create a new portfolio, while an unregulated SPC notifies the FSC in writing within 14 days (Segregated Portfolio Companies (BVI Business Company) Regulations, reg. 7). Please confirm which applies and the current form.';
const articlesQ = 'Which article permits directors to act by written resolution, and must every director sign?';
const nameQ = 'Confirm the portfolio naming convention. The source reviewed says each portfolio name must include the words “Segregated Portfolio”; is a shorter trading name (e.g. “Atlas SP”) acceptable in investor materials?';

// Operative resolutions shared by all three variants. `lead` is the text that introduces them.
function operative(lead, opts = {}) {
  const b = [];
  b.push(P(lead));
  b.push(H('2 Creation of the Portfolio'));
  b.push(P('2.1 A segregated portfolio of the Company be created and named {{portfolio.legal_name}} (the “Portfolio”), with effect from {{resolution.effective_date}} [[IF umbrella.is_regulated_fund]] or, if later, the date on which the Financial Services Commission approves the creation of the Portfolio [[END IF]].', 1));
  b.push(P('2.2 The assets and liabilities attributable to the Portfolio be held and recorded separately from the general assets of the Company and from the assets of every other segregated portfolio of the Company, and the directors establish and maintain procedures for that purpose.', 1));
  b.push(P('2.3 A class of shares linked to the Portfolio be designated as {{portfolio.share_class_name}}, each with a par value of {{portfolio.share_par_value}}, carrying the rights set out in the Company’s articles of association and the Supplement (the “Portfolio Shares”), and every Portfolio Share be recorded in the register of members as linked to the Portfolio.', 1));
  b.push(H('3 Regulatory approval or notification'));
  b.push(COND('[[IF umbrella.is_regulated_fund]]'));
  b.push(P('3.1 Any director, or the Company’s registered agent, be authorised to apply to the Financial Services Commission for approval of the creation of the Portfolio, and no Portfolio Shares be issued until that approval has been received.', 1));
  b.push(COND('[[ELSE]]'));
  b.push(P('3.1 The Company’s registered agent be instructed to notify the Financial Services Commission in writing of the creation of the Portfolio within 14 days of the date on which it is created.', 1));
  b.push(COND('[[END IF]]'));
  b.push(N(regulatoryQ));
  b.push(H('4 Offer of Portfolio Shares'));
  b.push(P('4.1 The supplement to the Company’s offering memorandum dated {{umbrella.om_date}} relating to the Portfolio, in the form tabled (the “Supplement”), be approved, subject to its clearance by the Company’s legal counsel.', 1));
  b.push(P('4.2 Portfolio Shares be offered at {{portfolio.subscription_price}} per share, with a minimum subscription of {{portfolio.min_subscription}} per investor and a maximum aggregate offer of {{portfolio.max_offer}}.', 1));
  b.push(P('4.3 The offer open on {{portfolio.offer_open_date}} and close on {{portfolio.offer_close_date}}, unless the directors resolve to extend or close it early.', 1));
  b.push(P('4.4 If subscriptions received exceed the maximum aggregate offer, allocations be made {{portfolio.allocation_method_description}}, and the allocation for each investor be recorded in the Company’s records.', 1));
  b.push(N('The minimum subscription must be consistent with the investor category the Company relies on. For a private investment fund issuing only to professional investors, the sources reviewed give a minimum initial investment of US$100,000. Please confirm the category and minimum.'));
  if (opts.investment) b.push(...opts.investment);
  b.push(H((opts.investment ? '6' : '5') + ' Contracting for the Portfolio'));
  b.push(P((opts.investment ? '6' : '5') + '.1 Every agreement, instrument and notice entered into or given in connection with the Portfolio state on its face that it is executed by the Company for and on behalf of the Portfolio, using the following wording:', 1));
  b.push(LOCK('{{umbrella.legal_name}} for and on behalf of {{portfolio.legal_name}}'));
  const a = opts.investment ? '7' : '6';
  b.push(H(a + ' Authority'));
  b.push(P(a + '.1 Any director be authorised to sign, for and on behalf of the Company acting for the Portfolio, the Supplement, subscription agreements, share certificates (if issued) and any other document needed to give effect to these resolutions.', 1));
  b.push(P(a + '.2 The registered agent be instructed to update the register of members and any other statutory records to reflect these resolutions.', 1));
  return b;
}

function investmentFromIssuerOrThirdParty() {
  return [
    H('5 Investment'),
    P('5.1 The Company, for and on behalf of the Portfolio, be authorised to acquire up to {{asset.max_quantity}} {{asset.instrument}} of {{asset.issuer_name}}, a company incorporated in {{asset.issuer_jurisdiction}}, for a total consideration not exceeding {{asset.total_consideration}}, from {{asset.seller_name}}.', 1),
    P('5.2 Completion of the acquisition be conditional on (a) the offer of Portfolio Shares closing with cleared subscription monies of at least {{portfolio.minimum_close_amount}}, and (b) any consent, waiver or right of first refusal required under the constitutional documents or shareholder agreements of {{asset.issuer_name}} having been obtained or having lapsed.', 1),
  ];
}

function header(kind) {
  return [
    T(kind),
    T('OF {{umbrella.legal_name}}'),
    ST('(the “Company”), a BVI business company registered as a segregated portfolio company, company number {{umbrella.company_number}}'),
    SPACER(),
  ];
}

function directorSigs() {
  return [
    P('These resolutions are passed by the directors signing below and take effect when the last director signs [[IF resolution.effective_date_differs]] or on {{resolution.effective_date}} if later [[END IF]].'),
    COND('[[FOR EACH director IN umbrella.directors]]'),
    ...SIG('{{director.name}}', ['Director', 'Date: {{director.signed_date}}']),
    COND('[[END FOR EACH]]'),
    N(articlesQ),
  ];
}

// ---------- D12-A ----------
const A = {
  meta: {
    id: 'D12-A', file: 'D12-A_Creation_Resolution_Written_Standard.docx',
    name: 'Creation of a segregated portfolio: directors’ written resolutions',
    cls: 'D12 Creation resolution and share-class designation',
    variant: 'A · Written resolutions, asset bought from the issuer or an unrelated seller',
    use: 'Creating a new portfolio for a project where no director or sponsor affiliate is on the other side of the acquisition, and the directors act in writing rather than at a meeting.',
    scope: 'Portfolio (one per new segregated portfolio)',
    signed: 'All directors of the Company',
    cond: 'Regulated fund (FSC prior approval) or unregulated (FSC notification within 14 days); effective date later than signing.',
    questions: [articlesQ, regulatoryQ, nameQ, 'Should the resolution also approve the specific acquisition (section 5), or should the investment be approved separately once the offer closes?'],
  },
  body: () => [
    ...header('WRITTEN RESOLUTIONS OF THE DIRECTORS'),
    P('Passed in writing on {{resolution.date}} in accordance with the Company’s articles of association and the BVI Business Companies Act (Revised Edition 2020) (the “Act”).'),
    H('1 Background'),
    P('1.1 The Company is a segregated portfolio company [[IF umbrella.is_regulated_fund]] and is recognised as a {{umbrella.fund_category}} under the Securities and Investment Business Act (Revised Edition 2020) [[END IF]].', 1),
    P('1.2 The directors propose to create a new segregated portfolio to hold the Company’s investment in {{asset.issuer_name}} (the “Project”), and to offer shares linked to that portfolio to eligible investors on the terms of the Company’s offering memorandum and a supplement to it.', 1),
    P('1.3 Each director confirms that they have no interest in the Project or in the acquisition described in section 5 that must be disclosed under the Company’s articles of association or the Act.', 1),
    ...operative('IT IS RESOLVED THAT:', { investment: investmentFromIssuerOrThirdParty() }),
    ...directorSigs(),
  ],
};

// ---------- D12-B ----------
const B = {
  meta: {
    id: 'D12-B', file: 'D12-B_Creation_Resolution_Written_Sponsor_Asset.docx',
    name: 'Creation of a segregated portfolio and approval of an acquisition from a sponsor affiliate: directors’ written resolutions',
    cls: 'D12 Creation resolution and share-class designation',
    variant: 'B · Written resolutions, asset supplied by the sponsor or an affiliate',
    use: 'The portfolio will buy an asset the sponsor or an affiliate already owns, so the sponsor is on both sides. Records the conflict, the sponsor’s cost, the independent valuation and approval by the directors who are not interested.',
    scope: 'Portfolio',
    signed: 'All directors, with interested directors identified',
    cond: 'Regulated fund or unregulated; whether the offering memorandum requires investor or advisory-committee consent to related-party acquisitions; whether an interested director may count in the quorum or vote.',
    questions: [
      'Do the articles allow an interested director to sign written resolutions approving a transaction in which they are interested, once the interest is declared? If not, use variant C (minutes of a meeting) with the interested director abstaining.',
      'Is an independent valuation required for every sponsor-supplied asset, or only above a threshold? Who may act as valuer?',
      'Does the offering memorandum require consent from investors or an advisory committee for related-party acquisitions?',
      regulatoryQ,
    ],
  },
  body: () => [
    ...header('WRITTEN RESOLUTIONS OF THE DIRECTORS'),
    P('Passed in writing on {{resolution.date}} in accordance with the Company’s articles of association and the BVI Business Companies Act (Revised Edition 2020) (the “Act”).'),
    H('1 Background'),
    P('1.1 The Company is a segregated portfolio company [[IF umbrella.is_regulated_fund]] and is recognised as a {{umbrella.fund_category}} under the Securities and Investment Business Act (Revised Edition 2020) [[END IF]].', 1),
    P('1.2 The directors propose to create a new segregated portfolio to acquire {{asset.instrument}} of {{asset.issuer_name}} (the “Project Shares”) from {{asset.seller_name}} (the “Seller”), which is an affiliate of {{sponsor.legal_name}} (the “Sponsor”).', 1),
    P('1.3 The Seller acquired the Project Shares on {{asset.sponsor_acquisition_date}} at {{asset.sponsor_cost_per_share}} per share. The proposed transfer price is {{asset.price_per_share}} per share (the “Transfer Price”), a markup of {{asset.markup_pct}} on the Seller’s cost.', 1),
    P('1.4 {{asset.valuer_name}} has provided an independent valuation of the Project Shares dated {{asset.valuation_date}} (the “Valuation”), which was tabled with these resolutions.', 1),
    H('Declarations of interest'),
    COND('[[FOR EACH director IN umbrella.directors WHERE director.is_interested]]'),
    P('{{director.name}} has declared to the other directors that they are interested in the acquisition as {{director.interest_description}}.', 1),
    COND('[[END FOR EACH]]'),
    P('The directors who have not declared an interest (the “Independent Directors”) have considered the Valuation, the Transfer Price and the Seller’s cost before passing the resolutions in section 5.', 1),
    N('The markup is calculated by the platform from the recorded cost and Transfer Price, not typed in. Please confirm the declaration wording and whether the Independent Directors alone must pass section 5.'),
    ...operative('IT IS RESOLVED THAT:', { investment: [
      H('5 Acquisition from the Seller (Independent Directors)'),
      P('5.1 Having considered the Valuation, the Transfer Price and the Seller’s cost, the Independent Directors approve the acquisition by the Company, for and on behalf of the Portfolio, of up to {{asset.max_quantity}} Project Shares from the Seller at the Transfer Price, for a total consideration not exceeding {{asset.total_consideration}}.', 1),
      P('5.2 Completion be conditional on (a) the offer of Portfolio Shares closing with cleared subscription monies of at least {{portfolio.minimum_close_amount}}, and (b) any consent, waiver or right of first refusal required by {{asset.issuer_name}} having been obtained or having lapsed.', 1),
      P('5.3 The conflict disclosure statement in the form tabled (the “Conflict Disclosure”), which sets out the Seller’s cost, the Transfer Price, the markup and the Valuation, be approved subject to its clearance by the Company’s legal counsel, and be given to every prospective investor before they subscribe.', 1),
      P('5.4 Every subscription agreement for Portfolio Shares include the investor’s written acknowledgement that they have received and read the Conflict Disclosure.', 1),
      COND('[[IF umbrella.om_requires_related_party_consent]]'),
      P('5.5 Completion also be conditional on the consent required by {{umbrella.related_party_consent_clause}} of the offering memorandum having been obtained.', 1),
      COND('[[END IF]]'),
    ] }),
    ...directorSigs(),
  ],
};

// ---------- D12-C ----------
const Cv = {
  meta: {
    id: 'D12-C', file: 'D12-C_Creation_Resolution_Board_Minutes.docx',
    name: 'Creation of a segregated portfolio: minutes of a meeting of the directors',
    cls: 'D12 Creation resolution and share-class designation',
    variant: 'C · Minutes of a board meeting',
    use: 'The directors meet (in person or by video) instead of signing in writing: for example when an interested director must abstain, when not every director will sign, or when the Company’s practice is to hold meetings.',
    scope: 'Portfolio',
    signed: 'Chair of the meeting',
    cond: 'Regulated fund or unregulated; declarations of interest recorded when any director is interested; asset supplied by the sponsor (adds the Independent Directors’ approval).',
    questions: [
      'Confirm the quorum and notice requirements in the articles, and whether meetings by video are permitted.',
      'Must the meeting be held outside a particular jurisdiction for tax-residence reasons?',
      regulatoryQ,
    ],
  },
  body: () => [
    ...header('MINUTES OF A MEETING OF THE DIRECTORS'),
    TABLE([
      ['Date and time', '{{meeting.date}} at {{meeting.time}}'],
      ['Place', '{{meeting.place}}'],
      ['Present', '[[FOR EACH director IN meeting.attendees]] {{director.name}} [[END FOR EACH]]'],
      ['In attendance', '{{meeting.in_attendance}}'],
      ['Chair', '{{meeting.chair_name}}'],
    ], [2400, 6626], { labelCol: true }),
    SPACER(),
    H('1 Quorum and notice'),
    P('1.1 The chair noted that notice of the meeting had been given in accordance with the Company’s articles of association and that a quorum was present. The chair declared the meeting open.', 1),
    H('Declarations of interest'),
    COND('[[IF any director.is_interested]]'),
    P('{{director.name}} declared that they are interested in the matters to be considered as {{director.interest_description}}, and [[IF director.abstains]] did not vote on the resolutions in section 5 [[END IF]].', 1),
    COND('[[ELSE]]'),
    P('Each director present confirmed that they have no interest in the matters to be considered that must be disclosed under the Company’s articles of association or the BVI Business Companies Act (Revised Edition 2020).', 1),
    COND('[[END IF]]'),
    H('Documents tabled'),
    ...BUL([
      'The draft supplement to the offering memorandum dated {{umbrella.om_date}} relating to the proposed portfolio (the “Supplement”).',
      'The summary of the proposed acquisition of {{asset.instrument}} of {{asset.issuer_name}}.',
      '[[IF asset.acquisition_source = gp_sourced]] The independent valuation by {{asset.valuer_name}} dated {{asset.valuation_date}} and the draft conflict disclosure statement. [[END IF]]',
    ]),
    H('Discussion'),
    P('The directors discussed the proposed portfolio, the terms of the offer, the proposed acquisition and the matters in the documents tabled.'),
    N('Keep the discussion record factual and short. Counsel may wish to add the specific factors the directors considered.'),
    ...operative('After discussion, IT WAS RESOLVED THAT:', { investment: [
      H('5 Investment'),
      P('5.1 The Company, for and on behalf of the Portfolio, be authorised to acquire up to {{asset.max_quantity}} {{asset.instrument}} of {{asset.issuer_name}} for a total consideration not exceeding {{asset.total_consideration}} from {{asset.seller_name}}, conditional on the offer closing with cleared subscription monies of at least {{portfolio.minimum_close_amount}} and on any required issuer consent having been obtained or having lapsed.', 1),
      COND('[[IF asset.acquisition_source = gp_sourced]]'),
      P('5.2 The Independent Directors, having considered the valuation, the transfer price of {{asset.price_per_share}} per share and the seller’s cost of {{asset.sponsor_cost_per_share}} per share, approved the acquisition, and approved the conflict disclosure statement subject to its clearance by the Company’s legal counsel.', 1),
      COND('[[END IF]]'),
    ] }),
    H('Close'),
    P('There being no further business, the chair declared the meeting closed.'),
    ...SIG('{{meeting.chair_name}}', ['Chair', 'Date: {{meeting.minutes_signed_date}}']),
  ],
};

module.exports = [A, B, Cv];
