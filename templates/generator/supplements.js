const { T, ST, H, P, N, AI, LOCK, COND, BUL, TABLE, SPACER } = require('./lib');

const pifQ = 'Which investor basis does the Company rely on: fewer than 50 investors, private invitation only, or professional and exempted investors only (which the sources reviewed tie to a US$100,000 minimum initial investment)? The minimum subscription and section 11 must match.';
const sellingQ = 'Which selling restrictions and legends are needed for the jurisdictions where investors are located (for example Australia, Singapore, Hong Kong, the EU and the UK), and should US persons be excluded?';

function front(variantTitle) {
  return [
    T('SUPPLEMENT NO. {{portfolio.supplement_number}}'),
    ST('dated {{supplement.date}}'),
    ST('to the Offering Memorandum dated {{umbrella.om_date}} of'),
    T('{{umbrella.legal_name}}'),
    ST('a BVI business company registered as a segregated portfolio company'),
    ST('relating to'),
    T('{{portfolio.legal_name}}'),
    ST(variantTitle),
    SPACER(),
    ST('Issuer'),
    LOCK('{{umbrella.legal_name}} for and on behalf of {{portfolio.legal_name}}'),
    H('Important information'),
    P('This Supplement forms part of, and must be read together with, the Offering Memorandum of the Company dated {{umbrella.om_date}} (the “Offering Memorandum”). Words defined in the Offering Memorandum have the same meaning in this Supplement unless this Supplement says otherwise. If this Supplement and the Offering Memorandum are inconsistent, this Supplement prevails in relation to the Portfolio.'),
    P('{{portfolio.legal_name}} (the “Portfolio”) is a segregated portfolio of the Company. The assets of the Portfolio are available only to meet liabilities attributable to the Portfolio. Investors in the Portfolio have no interest in, and no recourse to, the assets of any other segregated portfolio of the Company.'),
    P('An investment in the Portfolio involves a high degree of risk, including the risk of losing all of the amount invested. Portfolio Shares cannot be redeemed at the investor’s request and there is no market for them. Investors should read section 9 (Risk factors) and take their own legal, tax and financial advice.'),
    N(sellingQ),
  ];
}

function summary(rows) {
  return [
    H('1 Summary of terms'),
    TABLE([
      ['Portfolio', '{{portfolio.legal_name}}'],
      ['Shares offered', '{{portfolio.share_class_name}}, par value {{portfolio.share_par_value}} (the “Portfolio Shares”)'],
      ['Subscription price', '{{portfolio.subscription_price}} per Portfolio Share'],
      ['Minimum subscription', '{{portfolio.min_subscription}}'],
      ['Maximum offer', '{{portfolio.max_offer}}'],
      ['Minimum to proceed', '{{portfolio.minimum_close_amount}}'],
      ['Offer period', '{{portfolio.offer_open_date}} to {{portfolio.offer_close_date}}, unless extended or closed early by the directors'],
      ...rows,
      ['Term', '{{portfolio.term_years}} years from the first issue of Portfolio Shares, extendable by the directors by up to {{portfolio.extension_years}} years'],
      ['Management fee', '{{portfolio.mgmt_fee_rate}} a year on {{portfolio.fee_basis}}'],
      ['Performance fee', '{{portfolio.perf_fee_rate}} of profits after investors have received back their subscribed capital[[IF portfolio.has_hurdle]] and a return of {{portfolio.hurdle_rate}} a year[[END IF]]'],
      ['Organisational expenses', 'Borne by the Portfolio up to {{portfolio.org_expense_cap}}; any excess borne by the Sponsor'],
      ['Umbrella costs', 'Allocated to the Portfolio under the Company’s cost-allocation rule {{umbrella.cost_rule_ref}}'],
      ['Base currency', '{{portfolio.base_currency}}'],
      ['Administrator', '{{umbrella.administrator_name}}'],
    ], [2600, 6426], { labelCol: true }),
    N('Every figure in this table is filled from the portfolio record. The management and performance fee basis should be confirmed against the Offering Memorandum’s general fee terms.'),
  ];
}

function common(conflictsExtra, risksExtra) {
  return [
    H('5 Fees and expenses'),
    P('5.1 Management fee. The Sponsor is entitled to a management fee of {{portfolio.mgmt_fee_rate}} a year on {{portfolio.fee_basis}}, calculated and paid {{portfolio.fee_frequency}} in arrears from the assets of the Portfolio.', 1),
    P('5.2 Performance fee. On each distribution, the Sponsor is entitled to {{portfolio.perf_fee_rate}} of the amount by which cumulative distributions exceed investors’ subscribed capital[[IF portfolio.has_hurdle]] plus a return of {{portfolio.hurdle_rate}} a year[[END IF]]. The calculation is made by the Company’s calculation service and shown on each distribution notice.', 1),
    P('5.3 Organisational expenses. The costs of establishing the Portfolio and offering the Portfolio Shares are borne by the Portfolio up to {{portfolio.org_expense_cap}}. Any excess is borne by the Sponsor.', 1),
    P('5.4 Umbrella costs. Costs of the Company that do not relate to a particular segregated portfolio are allocated to the Portfolio under the Company’s cost-allocation rule {{umbrella.cost_rule_ref}}. No cost of any other segregated portfolio is charged to the Portfolio.', 1),
    H('6 Subscriptions and allocation'),
    P('6.1 Investors apply by completing a subscription agreement for the Portfolio and giving the information required for anti-money laundering and tax purposes.', 1),
    P('6.2 If applications exceed the maximum offer, the directors allocate Portfolio Shares {{portfolio.allocation_method_description}}. Each investor is notified of their allocation, which may be less than the amount applied for.', 1),
    P('6.3 Allocated amounts must be received in cleared funds by {{portfolio.funding_deadline}}. Portfolio Shares are issued at the subscription price once cleared funds are received and the offer has closed. Fractions of Portfolio Shares are not issued; allocations are rounded down to a whole share.', 1),
    P('6.4 If cleared subscription monies of at least {{portfolio.minimum_close_amount}} are not received by the end of the offer period, the offer lapses and all subscription monies are returned without interest.', 1),
    H('7 Distributions and termination'),
    P('7.1 Distributions are paid only from the assets of the Portfolio, after the Portfolio’s liabilities and fees. The directors may distribute proceeds from a sale or other realisation of the Portfolio’s investment, or distribute securities in kind where the directors consider it in investors’ interests and permitted by the issuer’s transfer restrictions.', 1),
    P('7.2 After the Portfolio’s investment has been fully realised, or at the end of the term, the directors will wind up the Portfolio, make a final distribution and compulsorily redeem the Portfolio Shares.', 1),
    H('8 Transfers'),
    P('8.1 Portfolio Shares may be transferred only with the prior written consent of the directors, to a person who is eligible to invest under section 11 and who has completed the Company’s onboarding. Any transfer restrictions affecting the Portfolio’s investment may also apply.', 1),
    H('9 Risk factors'),
    P('In addition to the risks described in the Offering Memorandum, investors should consider the following.'),
    ...BUL([
      'Concentration: the Portfolio holds a single investment. Its value depends entirely on the performance of that investment.',
      'Illiquidity: Portfolio Shares cannot be redeemed at the investor’s request, and there is no market for them. Investors may not receive any return until the investment is realised, which may take longer than the term.',
      'Valuation: the investment is not listed. Any valuation is an estimate and may not reflect the price achievable on a sale.',
      'Loss of capital: investors may lose all of the amount invested.',
      'Limited information and control: the Portfolio is a minority holder and relies on information provided by the issuer.',
      'Fees and expenses reduce returns, including the Portfolio’s share of umbrella costs.',
      'Currency: where the investment is valued or realised in a currency other than {{portfolio.base_currency}}, exchange rates will affect returns.',
      ...risksExtra,
    ]),
    AI('project_risk_factors', 'Risks specific to this investment and this issuer, drafted only from the sponsor’s facts and the issuer’s materials uploaded for this portfolio. Each statement must be supported by an uploaded source. No statements about expected returns, liquidity or the likelihood of an exit. Maximum 250 words.'),
    H('10 Conflicts of interest'),
    P('10.1 The Sponsor and its affiliates act for other segregated portfolios of the Company and other clients, and may have interests that conflict with those of the Portfolio, including in allocating investment opportunities and time. The Offering Memorandum describes how the Sponsor manages these conflicts.', 1),
    ...conflictsExtra,
    H('11 Eligible investors'),
    COND('[[IF umbrella.fund_category = private_investment_fund]]'),
    P('11.1 Portfolio Shares may be issued only to investors who meet the basis on which the Company operates as a private investment fund: {{umbrella.investor_basis_description}}.', 1),
    COND('[[END IF]]'),
    P('11.2 Each investor must meet the eligibility requirements in the Offering Memorandum and the subscription agreement, including the requirements of their own jurisdiction.', 1),
    N(pifQ),
  ];
}

// ---------- D13-A: primary investment ----------
const A = {
  meta: {
    id: 'D13-A', file: 'D13-A_Supplement_Primary_Round.docx',
    name: 'Portfolio supplement: investment in a company’s financing round',
    cls: 'D13 Portfolio supplement (project term sheet under the Offering Memorandum)',
    variant: 'A · Primary investment: the portfolio subscribes for new shares issued by the company',
    use: 'The portfolio invests directly in a new issue of shares by the company, for example a Series B round. No sponsor affiliate sells to the portfolio.',
    scope: 'Portfolio',
    signed: 'Not signed. Approved by directors (D12) and cleared by counsel.',
    ai: 'Section 3 (the company) and the project-specific risk factors in section 9. Drafted only from uploaded sources; every statement is checked against them.',
    cond: 'Hurdle rate; private investment fund basis; long-stop date for the round.',
    questions: [pifQ, sellingQ, 'What should happen to subscription monies if the round does not close by the long-stop date: full refund, or refund less costs incurred?', 'Is a summary of the Portfolio’s rights under the financing documents (information rights, pre-emption, drag and tag) required in the Supplement, or is “available on request” acceptable?'],
  },
  body: () => [
    ...front('Primary investment in {{asset.issuer_name}}'),
    ...summary([
      ['Investment', 'Up to {{asset.total_consideration}} of {{asset.instrument}} issued by {{asset.issuer_name}} in its {{asset.round_name}} financing'],
      ['Price', '{{asset.price_per_share}} per share'],
      ['Long-stop date', '{{asset.long_stop_date}}'],
    ]),
    H('2 The Portfolio'),
    P('2.1 The sole purpose of the Portfolio is to subscribe for and hold {{asset.instrument}} of {{asset.issuer_name}} (the “Company Shares”) and to distribute the proceeds when the investment is realised. The Portfolio will not make any other investment, except holding cash pending investment or distribution.', 1),
    H('3 The company'),
    P('3.1 {{asset.issuer_name}} (the “Issuer”) is a company incorporated in {{asset.issuer_jurisdiction}}.', 1),
    AI('issuer_description', 'A factual description of the Issuer’s business, products and stage, drafted from the sponsor’s facts and the Issuer’s materials uploaded for this portfolio. Every statement must be supported by an uploaded source. No projections, valuations or statements about future performance. Maximum 200 words.'),
    H('4 The investment'),
    P('4.1 The Company, for and on behalf of the Portfolio, will subscribe for up to {{asset.total_consideration}} of Company Shares at {{asset.price_per_share}} per share in the Issuer’s {{asset.round_name}} financing, on or before the date on which the Issuer first issues shares in that financing (the “Round Closing”).', 1),
    P('4.2 If the Round Closing has not occurred by {{asset.long_stop_date}}, the offer of Portfolio Shares lapses and all subscription monies are returned to investors without interest[[IF portfolio.costs_deducted_on_lapse]] less their share of costs incurred, up to {{portfolio.lapse_cost_cap}}[[END IF]].', 1),
    P('4.3 The Portfolio’s rights as a shareholder of the Issuer are set out in the Issuer’s constitutional documents and financing documents. A summary is available to investors on request.', 1),
    ...common([], ['Financing risk: the Issuer may need further funding, which may dilute the Portfolio’s holding or be on less favourable terms.']),
  ],
};

// ---------- D13-B: GP-sourced secondary ----------
const B = {
  meta: {
    id: 'D13-B', file: 'D13-B_Supplement_Sponsor_Secondary.docx',
    name: 'Portfolio supplement: purchase of existing shares from a sponsor affiliate',
    cls: 'D13 Portfolio supplement',
    variant: 'B · Secondary purchase from the sponsor or an affiliate (conflict disclosure required)',
    use: 'The portfolio buys shares the sponsor or an affiliate already owns. Must be used with creation resolution D12-B or D12-C, and with the separate conflict disclosure statement.',
    scope: 'Portfolio',
    signed: 'Not signed. Approved by the Independent Directors and cleared by counsel.',
    ai: 'Section 3 (the company) and the project-specific risk factors in section 9.',
    cond: 'Hurdle rate; whether the sponsor keeps part of its holding; related-party consent under the Offering Memorandum; private investment fund basis.',
    questions: [
      'Is the disclosure of the Seller’s cost, the markup and the valuation in section 10 sufficient, and should the full valuation report be made available to investors?',
      'Should the Sponsor give any warranties to the Portfolio beyond title and capacity (for example, no undisclosed side arrangements with the Issuer)?',
      'Should any portion of the markup be subject to a lock-up or deferred until an exit?',
      pifQ,
    ],
  },
  body: () => [
    ...front('Purchase of {{asset.issuer_name}} shares from an affiliate of the Sponsor'),
    ...summary([
      ['Investment', 'Up to {{asset.max_quantity}} {{asset.instrument}} of {{asset.issuer_name}}, bought from {{asset.seller_name}}, an affiliate of the Sponsor'],
      ['Transfer price', '{{asset.price_per_share}} per share, total up to {{asset.total_consideration}}'],
      ['Seller’s cost', '{{asset.sponsor_cost_per_share}} per share, acquired on {{asset.sponsor_acquisition_date}}'],
      ['Markup on cost', '{{asset.markup_pct}}'],
      ['Independent valuation', '{{asset.valuer_name}}, dated {{asset.valuation_date}}'],
    ]),
    N('The markup is calculated by the platform from the recorded cost and transfer price, never typed in. The Seller’s cost must be supported by the purchase documents held as evidence.'),
    H('2 The Portfolio'),
    P('2.1 The sole purpose of the Portfolio is to acquire and hold {{asset.instrument}} of {{asset.issuer_name}} (the “Company Shares”) and to distribute the proceeds when the investment is realised.', 1),
    H('3 The company'),
    P('3.1 {{asset.issuer_name}} (the “Issuer”) is a company incorporated in {{asset.issuer_jurisdiction}}.', 1),
    AI('issuer_description', 'A factual description of the Issuer’s business, products and stage, drafted from the sponsor’s facts and the Issuer’s materials uploaded for this portfolio. Every statement must be supported by an uploaded source. No projections, valuations or statements about future performance. Maximum 200 words.'),
    H('4 The investment'),
    P('4.1 The Company, for and on behalf of the Portfolio, will buy up to {{asset.max_quantity}} Company Shares from {{asset.seller_name}} (the “Seller”) at {{asset.price_per_share}} per share (the “Transfer Price”) under a share purchase agreement between the Seller and the Company acting for the Portfolio.', 1),
    P('4.2 Completion is conditional on the offer of Portfolio Shares closing with cleared subscription monies of at least {{portfolio.minimum_close_amount}}, and on any consent, waiver or right of first refusal required by the Issuer having been obtained or having lapsed ({{asset.consent_status}}).', 1),
    P('4.3 If the offer raises less than the maximum, the Portfolio buys the number of Company Shares that the cleared subscription monies, less the Portfolio’s expenses, allow at the Transfer Price.', 1),
    COND('[[IF asset.sponsor_retains_shares]]'),
    P('4.4 After completion, the Sponsor and its affiliates will continue to hold {{asset.sponsor_retained_quantity}} Company Shares directly.', 1),
    COND('[[END IF]]'),
    ...common([
      P('10.2 Sale by an affiliate of the Sponsor. The Seller is an affiliate of the Sponsor. The Sponsor therefore has an interest in the Transfer Price being as high as possible, which conflicts with the interests of investors in the Portfolio.', 1),
      P('10.3 The Seller acquired the Company Shares on {{asset.sponsor_acquisition_date}} at {{asset.sponsor_cost_per_share}} per share. The Transfer Price of {{asset.price_per_share}} per share is a markup of {{asset.markup_pct}} on that cost.', 1),
      P('10.4 {{asset.valuer_name}}, which is independent of the Sponsor, valued the Company Shares at {{asset.valuation_range}} per share as at {{asset.valuation_date}}. The acquisition was approved by the directors of the Company who have no interest in it.', 1),
      P('10.5 These matters are set out in more detail in the conflict disclosure statement dated {{conflict_disclosure.date}} (the “Conflict Disclosure”), which every investor must read and acknowledge before subscribing.', 1),
      COND('[[IF umbrella.om_requires_related_party_consent]]'),
      P('10.6 The acquisition is also subject to the consent required by {{umbrella.related_party_consent_clause}} of the Offering Memorandum.', 1),
      COND('[[END IF]]'),
    ], [
      'Related-party pricing: the Transfer Price was set by an affiliate of the Sponsor and includes a markup on the Seller’s cost. The independent valuation is an estimate and other valuers may reach a different view.',
      'Limited warranties: the Seller gives warranties about title and capacity only. The Portfolio has no claim against the Seller if the Issuer’s business performs worse than expected.',
      'Transfer restrictions: the Issuer’s constitutional documents restrict transfers of Company Shares, which may limit how and when the Portfolio can realise its investment.',
    ]),
  ],
};

// ---------- D13-C: third-party secondary ----------
const Cv = {
  meta: {
    id: 'D13-C', file: 'D13-C_Supplement_Third_Party_Secondary.docx',
    name: 'Portfolio supplement: purchase of existing shares from unrelated sellers',
    cls: 'D13 Portfolio supplement',
    variant: 'C · Secondary purchase from one or more existing shareholders not related to the sponsor',
    use: 'The portfolio buys existing shares from employees, early investors or other shareholders who are not affiliated with the sponsor, usually subject to the issuer’s consent or right of first refusal.',
    scope: 'Portfolio',
    signed: 'Not signed. Approved by directors (D12-A or D12-C) and cleared by counsel.',
    ai: 'Section 3 (the company) and the project-specific risk factors in section 9.',
    cond: 'Hurdle rate; partial completion; whether a placement fee is paid to an intermediary; private investment fund basis.',
    questions: [
      'If only some sellers complete, is returning the uninvested amount to investors pro rata acceptable, or should the directors be able to hold it for a later purchase in the same issuer?',
      'Should any fee paid to an intermediary or broker for sourcing the shares be disclosed as a figure or only as a basis?',
      'Are the title and capacity warranties from sellers sufficient, and should the Portfolio seek an indemnity?',
      pifQ,
    ],
  },
  body: () => [
    ...front('Purchase of existing {{asset.issuer_name}} shares from unrelated sellers'),
    ...summary([
      ['Investment', 'Up to {{asset.max_quantity}} {{asset.instrument}} of {{asset.issuer_name}}, bought from one or more existing shareholders not related to the Sponsor'],
      ['Purchase price', 'Up to {{asset.price_per_share}} per share, total up to {{asset.total_consideration}}'],
      ['Issuer approval', '{{asset.transfer_restrictions}}: {{asset.consent_status}}'],
    ]),
    H('2 The Portfolio'),
    P('2.1 The sole purpose of the Portfolio is to acquire and hold {{asset.instrument}} of {{asset.issuer_name}} (the “Company Shares”) and to distribute the proceeds when the investment is realised.', 1),
    H('3 The company'),
    P('3.1 {{asset.issuer_name}} (the “Issuer”) is a company incorporated in {{asset.issuer_jurisdiction}}.', 1),
    AI('issuer_description', 'A factual description of the Issuer’s business, products and stage, drafted from the sponsor’s facts and publicly available or Issuer-provided materials uploaded for this portfolio. Every statement must be supported by an uploaded source. No projections, valuations or statements about future performance. Maximum 200 words.'),
    H('4 The investment'),
    P('4.1 The Company, for and on behalf of the Portfolio, will buy Company Shares from one or more existing shareholders of the Issuer (the “Sellers”), none of whom is an affiliate of the Sponsor, at a price of no more than {{asset.price_per_share}} per share, under share purchase agreements between each Seller and the Company acting for the Portfolio.', 1),
    P('4.2 Each purchase is conditional on the Issuer’s consent to the transfer and on any right of first refusal or co-sale right of the Issuer or its other shareholders having been waived or having lapsed.', 1),
    P('4.3 If some purchases do not complete within {{asset.completion_window_days}} days after the offer closes, the Portfolio completes the purchases that can proceed, and the amount that cannot be invested is returned to investors pro rata to their subscriptions, without interest, after deducting the Portfolio’s share of expenses.', 1),
    COND('[[IF asset.has_placement_fee]]'),
    P('4.4 A fee of {{asset.placement_fee_description}} is payable to {{asset.placement_agent_name}} for arranging the purchases. It is paid from the assets of the Portfolio and is in addition to the fees in section 5.', 1),
    COND('[[END IF]]'),
    ...common([
      P('10.2 None of the Sellers is an affiliate of the Sponsor.[[IF asset.has_placement_fee]] The Sponsor has no interest in the placement fee described in section 4.4.[[END IF]]', 1),
    ], [
      'Information asymmetry: the Sellers and the Issuer may have information about the Issuer that the Portfolio does not have.',
      'Limited warranties: Sellers give warranties about title and capacity only.',
      'Completion risk: the Issuer may refuse consent, or another shareholder may exercise a right of first refusal, so the Portfolio may acquire fewer Company Shares than intended.',
      'Rights attached: shares bought from existing holders may be a class with fewer rights or a lower priority on a sale than shares issued in later financings.',
    ]),
  ],
};

module.exports = [A, B, Cv];
