// D13-B (supplement, sponsor secondary) ported to TemplateMark, two variants.
// Source wording: templates/generator/supplements.js (front, summary, B.body, common).
import { type Director, zoneText } from './atlas.ts';

const NS = 'org.docsmart.d13b@1.0.0';
type V = Record<string, string | boolean>;
const s = (v: V, k: string) => String(v[k]);
const W = (entity: string, field: string) => `{{#with ${entity}}}{{${field}}}{{/with}}`;

const PIF_Q = 'Which investor basis does the Company rely on: fewer than 50 investors, private invitation only, or professional and exempted investors only (which the sources reviewed tie to a US$100,000 minimum initial investment)? The minimum subscription and section 11 must match.';
const SELLING_Q = 'Which selling restrictions and legends are needed for the jurisdictions where investors are located (for example Australia, Singapore, Hong Kong, the EU and the UK), and should US persons be excluded?';

function body(v: { locked: string; perfCell: string; p44: string; p52hurdle: string; p106: string; p111: string }) {
  return `# SUPPLEMENT NO. ${W('portfolio', 'supplement_number')}

dated ${W('supplement', 'date')}

to the Offering Memorandum dated ${W('umbrella', 'om_date')} of

# ${W('umbrella', 'legal_name')}

a BVI business company registered as a segregated portfolio company

relating to

# ${W('portfolio', 'legal_name')}

Purchase of ${W('asset', 'issuer_name')} shares from an affiliate of the Sponsor

${v.locked}

## Important information

This Supplement forms part of, and must be read together with, the Offering Memorandum of the Company dated ${W('umbrella', 'om_date')} (the “Offering Memorandum”). Words defined in the Offering Memorandum have the same meaning in this Supplement unless this Supplement says otherwise. If this Supplement and the Offering Memorandum are inconsistent, this Supplement prevails in relation to the Portfolio.

${W('portfolio', 'legal_name')} (the “Portfolio”) is a segregated portfolio of the Company. The assets of the Portfolio are available only to meet liabilities attributable to the Portfolio. Investors in the Portfolio have no interest in, and no recourse to, the assets of any other segregated portfolio of the Company.

An investment in the Portfolio involves a high degree of risk, including the risk of losing all of the amount invested. Portfolio Shares cannot be redeemed at the investor’s request and there is no market for them. Investors should read section 9 (Risk factors) and take their own legal, tax and financial advice.

<!-- COUNSEL NOTE: ${SELLING_Q} -->

## 1 Summary of terms

| Portfolio | ${W('portfolio', 'legal_name')} |
|---|---|
| Shares offered | ${W('portfolio', 'share_class_name')}, par value ${W('portfolio', 'share_par_value')} (the “Portfolio Shares”) |
| Subscription price | ${W('portfolio', 'subscription_price')} per Portfolio Share |
| Minimum subscription | ${W('portfolio', 'min_subscription')} |
| Maximum offer | ${W('portfolio', 'max_offer')} |
| Minimum to proceed | ${W('portfolio', 'minimum_close_amount')} |
| Offer period | ${W('portfolio', 'offer_open_date')} to ${W('portfolio', 'offer_close_date')}, unless extended or closed early by the directors |
| Investment | Up to ${W('asset', 'max_quantity')} ${W('asset', 'instrument')} of ${W('asset', 'issuer_name')}, bought from ${W('asset', 'seller_name')}, an affiliate of the Sponsor |
| Transfer price | ${W('asset', 'price_per_share')} per share, total up to ${W('asset', 'total_consideration')} |
| Seller’s cost | ${W('asset', 'sponsor_cost_per_share')} per share, acquired on ${W('asset', 'sponsor_acquisition_date')} |
| Markup on cost | ${W('asset', 'markup_pct')} |
| Independent valuation | ${W('asset', 'valuer_name')}, dated ${W('asset', 'valuation_date')} |
| Term | ${W('portfolio', 'term_years')} years from the first issue of Portfolio Shares, extendable by the directors by up to ${W('portfolio', 'extension_years')} years |
| Management fee | ${W('portfolio', 'mgmt_fee_rate')} a year on ${W('portfolio', 'fee_basis')} |
| Performance fee | ${v.perfCell} |
| Organisational expenses | Borne by the Portfolio up to ${W('portfolio', 'org_expense_cap')}; any excess borne by the Sponsor |
| Umbrella costs | Allocated to the Portfolio under the Company’s cost-allocation rule ${W('umbrella', 'cost_rule_ref')} |
| Base currency | ${W('portfolio', 'base_currency')} |
| Administrator | ${W('umbrella', 'administrator_name')} |

<!-- COUNSEL NOTE: Every figure in this table is filled from the portfolio record. The management and performance fee basis should be confirmed against the Offering Memorandum’s general fee terms. -->

<!-- COUNSEL NOTE: The markup is calculated by the platform from the recorded cost and transfer price, never typed in. The Seller’s cost must be supported by the purchase documents held as evidence. -->

## 2 The Portfolio

2.1 The sole purpose of the Portfolio is to acquire and hold ${W('asset', 'instrument')} of ${W('asset', 'issuer_name')} (the “Company Shares”) and to distribute the proceeds when the investment is realised.

## 3 The company

3.1 ${W('asset', 'issuer_name')} (the “Issuer”) is a company incorporated in ${W('asset', 'issuer_jurisdiction')}.

<!-- AI ZONE issuer_description: A factual description of the Issuer’s business, products and stage, drafted from the sponsor’s facts and the Issuer’s materials uploaded for this portfolio. Every statement must be supported by an uploaded source. No projections, valuations or statements about future performance. Maximum 200 words. -->
{{#clause issuer_description}}
{{text}}
{{/clause}}

## 4 The investment

4.1 The Company, for and on behalf of the Portfolio, will buy up to ${W('asset', 'max_quantity')} Company Shares from ${W('asset', 'seller_name')} (the “Seller”) at ${W('asset', 'price_per_share')} per share (the “Transfer Price”) under a share purchase agreement between the Seller and the Company acting for the Portfolio.

4.2 Completion is conditional on the offer of Portfolio Shares closing with cleared subscription monies of at least ${W('portfolio', 'minimum_close_amount')}, and on any consent, waiver or right of first refusal required by the Issuer having been obtained or having lapsed (${W('asset', 'consent_status')}).

4.3 If the offer raises less than the maximum, the Portfolio buys the number of Company Shares that the cleared subscription monies, less the Portfolio’s expenses, allow at the Transfer Price.

${v.p44}

## 5 Fees and expenses

5.1 Management fee. The Sponsor is entitled to a management fee of ${W('portfolio', 'mgmt_fee_rate')} a year on ${W('portfolio', 'fee_basis')}, calculated and paid ${W('portfolio', 'fee_frequency')} in arrears from the assets of the Portfolio.

5.2 Performance fee. On each distribution, the Sponsor is entitled to ${W('portfolio', 'perf_fee_rate')} of the amount by which cumulative distributions exceed investors’ subscribed capital${v.p52hurdle}. The calculation is made by the Company’s calculation service and shown on each distribution notice.

5.3 Organisational expenses. The costs of establishing the Portfolio and offering the Portfolio Shares are borne by the Portfolio up to ${W('portfolio', 'org_expense_cap')}. Any excess is borne by the Sponsor.

5.4 Umbrella costs. Costs of the Company that do not relate to a particular segregated portfolio are allocated to the Portfolio under the Company’s cost-allocation rule ${W('umbrella', 'cost_rule_ref')}. No cost of any other segregated portfolio is charged to the Portfolio.

## 6 Subscriptions and allocation

6.1 Investors apply by completing a subscription agreement for the Portfolio and giving the information required for anti-money laundering and tax purposes.

6.2 If applications exceed the maximum offer, the directors allocate Portfolio Shares ${W('portfolio', 'allocation_method_description')}. Each investor is notified of their allocation, which may be less than the amount applied for.

6.3 Allocated amounts must be received in cleared funds by ${W('portfolio', 'funding_deadline')}. Portfolio Shares are issued at the subscription price once cleared funds are received and the offer has closed. Fractions of Portfolio Shares are not issued; allocations are rounded down to a whole share.

6.4 If cleared subscription monies of at least ${W('portfolio', 'minimum_close_amount')} are not received by the end of the offer period, the offer lapses and all subscription monies are returned without interest.

## 7 Distributions and termination

7.1 Distributions are paid only from the assets of the Portfolio, after the Portfolio’s liabilities and fees. The directors may distribute proceeds from a sale or other realisation of the Portfolio’s investment, or distribute securities in kind where the directors consider it in investors’ interests and permitted by the issuer’s transfer restrictions.

7.2 After the Portfolio’s investment has been fully realised, or at the end of the term, the directors will wind up the Portfolio, make a final distribution and compulsorily redeem the Portfolio Shares.

## 8 Transfers

8.1 Portfolio Shares may be transferred only with the prior written consent of the directors, to a person who is eligible to invest under section 11 and who has completed the Company’s onboarding. Any transfer restrictions affecting the Portfolio’s investment may also apply.

## 9 Risk factors

In addition to the risks described in the Offering Memorandum, investors should consider the following.

- Concentration: the Portfolio holds a single investment. Its value depends entirely on the performance of that investment.
- Illiquidity: Portfolio Shares cannot be redeemed at the investor’s request, and there is no market for them. Investors may not receive any return until the investment is realised, which may take longer than the term.
- Valuation: the investment is not listed. Any valuation is an estimate and may not reflect the price achievable on a sale.
- Loss of capital: investors may lose all of the amount invested.
- Limited information and control: the Portfolio is a minority holder and relies on information provided by the issuer.
- Fees and expenses reduce returns, including the Portfolio’s share of umbrella costs.
- Currency: where the investment is valued or realised in a currency other than ${W('portfolio', 'base_currency')}, exchange rates will affect returns.
- Related-party pricing: the Transfer Price was set by an affiliate of the Sponsor and includes a markup on the Seller’s cost. The independent valuation is an estimate and other valuers may reach a different view.
- Limited warranties: the Seller gives warranties about title and capacity only. The Portfolio has no claim against the Seller if the Issuer’s business performs worse than expected.
- Transfer restrictions: the Issuer’s constitutional documents restrict transfers of Company Shares, which may limit how and when the Portfolio can realise its investment.

<!-- AI ZONE project_risk_factors: Risks specific to this investment and this issuer, drafted only from the sponsor’s facts and the issuer’s materials uploaded for this portfolio. Each statement must be supported by an uploaded source. No statements about expected returns, liquidity or the likelihood of an exit. Maximum 250 words. -->
{{#clause project_risk_factors}}
{{text}}
{{/clause}}

## 10 Conflicts of interest

10.1 The Sponsor and its affiliates act for other segregated portfolios of the Company and other clients, and may have interests that conflict with those of the Portfolio, including in allocating investment opportunities and time. The Offering Memorandum describes how the Sponsor manages these conflicts.

10.2 Sale by an affiliate of the Sponsor. The Seller is an affiliate of the Sponsor. The Sponsor therefore has an interest in the Transfer Price being as high as possible, which conflicts with the interests of investors in the Portfolio.

10.3 The Seller acquired the Company Shares on ${W('asset', 'sponsor_acquisition_date')} at ${W('asset', 'sponsor_cost_per_share')} per share. The Transfer Price of ${W('asset', 'price_per_share')} per share is a markup of ${W('asset', 'markup_pct')} on that cost.

10.4 ${W('asset', 'valuer_name')}, which is independent of the Sponsor, valued the Company Shares at ${W('asset', 'valuation_range')} per share as at ${W('asset', 'valuation_date')}. The acquisition was approved by the directors of the Company who have no interest in it.

10.5 These matters are set out in more detail in the conflict disclosure statement dated ${W('conflict_disclosure', 'date')} (the “Conflict Disclosure”), which every investor must read and acknowledge before subscribing.

${v.p106}

## 11 Eligible investors

${v.p111}

11.2 Each investor must meet the eligibility requirements in the Offering Memorandum and the subscription agreement, including the requirements of their own jurisdiction.

<!-- COUNSEL NOTE: ${PIF_Q} -->
`;
}

const PORTFOLIO_F = ['supplement_number', 'legal_name', 'share_class_name', 'share_par_value', 'subscription_price', 'min_subscription', 'max_offer', 'minimum_close_amount', 'offer_open_date', 'offer_close_date', 'term_years', 'extension_years', 'mgmt_fee_rate', 'fee_basis', 'perf_fee_rate', 'org_expense_cap', 'base_currency', 'fee_frequency', 'allocation_method_description', 'funding_deadline'];
const ASSET_F = ['issuer_name', 'max_quantity', 'instrument', 'seller_name', 'price_per_share', 'total_consideration', 'sponsor_cost_per_share', 'sponsor_acquisition_date', 'markup_pct', 'valuer_name', 'valuation_date', 'issuer_jurisdiction', 'consent_status', 'valuation_range'];
const UMBRELLA_F = ['legal_name', 'om_date', 'administrator_name', 'cost_rule_ref'];
const props = (fs: string[]) => fs.map((f) => `  o String ${f}`).join('\n');
const pick = (v: V, e: string, fs: string[]) => Object.fromEntries(fs.map((f) => [f, s(v, `${e}.${f}`)]));
const zone = (z: string) => ({ $class: `${NS}.Zone`, text: zoneText(z) });

export const dataOnly = {
  cto: `
namespace ${NS}
concept Zone { o String text }
concept Umbrella {
${props(UMBRELLA_F)}
  o String related_party_consent_clause optional   // invented: present when om_requires_related_party_consent
  o String pif_investor_basis optional             // invented: present when fund_category = private_investment_fund
}
concept Portfolio {
${props(PORTFOLIO_F)}
  o String hurdle_rate_if_any optional             // invented: present when has_hurdle
}
concept ProjectAsset {
${props(ASSET_F)}
  o String retained_quantity optional              // invented: present when sponsor_retains_shares
}
concept Dated { o String date }
concept ContractingParty { o String designation } // invented: wording built by our code from the records
@template
concept D13B {
  o Umbrella umbrella
  o Portfolio portfolio
  o ProjectAsset asset
  o Dated supplement
  o Dated conflict_disclosure
  o ContractingParty contracting_party
  o Zone issuer_description                       // invented: holder for the AI-drafted zone text
  o Zone project_risk_factors                     // invented: holder for the AI-drafted zone text
}
`,
  md: body({
    locked: `{{#clause contracting_party}}\n**Issuer: {{designation}}**\n{{/clause}}`,
    perfCell: `${W('portfolio', 'perf_fee_rate')} of profits after investors have received back their subscribed capital{{#with portfolio}}{{#optional hurdle_rate_if_any}} and a return of {{this}} a year{{/optional}}{{/with}}`,
    p44: `{{#with asset}}{{#optional retained_quantity}}4.4 After completion, the Sponsor and its affiliates will continue to hold {{this}} Company Shares directly.{{/optional}}{{/with}}`,
    p52hurdle: `{{#with portfolio}}{{#optional hurdle_rate_if_any}} plus a return of {{this}} a year{{/optional}}{{/with}}`,
    p106: `{{#with umbrella}}{{#optional related_party_consent_clause}}10.6 The acquisition is also subject to the consent required by {{this}} of the Offering Memorandum.{{/optional}}{{/with}}`,
    p111: `{{#with umbrella}}{{#optional pif_investor_basis}}11.1 Portfolio Shares may be issued only to investors who meet the basis on which the Company operates as a private investment fund: {{this}}.{{/optional}}{{/with}}`,
  }),
  invented: [
    'portfolio.hurdle_rate_if_any — optional scalar standing for [[IF portfolio.has_hurdle]] with a field inside (table row and 5.2)',
    'asset.retained_quantity — optional scalar standing for [[IF asset.sponsor_retains_shares]] with a field inside (4.4)',
    'umbrella.related_party_consent_clause (optional form) — standing for [[IF umbrella.om_requires_related_party_consent]] with a field inside (10.6)',
    'umbrella.pif_investor_basis — optional scalar standing for the enum test [[IF umbrella.fund_category = private_investment_fund]] with a field inside (11.1)',
    'contracting_party.designation — the locked wording, built by our code, so it is data not template text',
    'issuer_description { text } — holder for the AI zone, so the zone can be a #clause',
    'project_risk_factors { text } — holder for the AI zone, so the zone can be a #clause',
  ],
  data(v: V, _dirs: Director[]) {
    return {
      $class: `${NS}.D13B`,
      umbrella: {
        $class: `${NS}.Umbrella`, ...pick(v, 'umbrella', UMBRELLA_F),
        ...(v['umbrella.om_requires_related_party_consent'] ? { related_party_consent_clause: s(v, 'umbrella.related_party_consent_clause') } : {}),
        ...(v['umbrella.fund_category'] === 'private_investment_fund' ? { pif_investor_basis: s(v, 'umbrella.investor_basis_description') } : {}),
      },
      portfolio: { $class: `${NS}.Portfolio`, ...pick(v, 'portfolio', PORTFOLIO_F), ...(v['portfolio.has_hurdle'] ? { hurdle_rate_if_any: s(v, 'portfolio.hurdle_rate') } : {}) },
      asset: { $class: `${NS}.ProjectAsset`, ...pick(v, 'asset', ASSET_F), ...(v['asset.sponsor_retains_shares'] ? { retained_quantity: s(v, 'asset.sponsor_retained_quantity') } : {}) },
      supplement: { $class: `${NS}.Dated`, date: s(v, 'supplement.date') },
      conflict_disclosure: { $class: `${NS}.Dated`, date: s(v, 'conflict_disclosure.date') },
      contracting_party: { $class: `${NS}.ContractingParty`, designation: `${s(v, 'umbrella.legal_name')} for and on behalf of ${s(v, 'portfolio.legal_name')}` },
      issuer_description: zone('issuer_description'),
      project_risk_factors: zone('project_risk_factors'),
    };
  },
};

export const codeAllowed = {
  cto: `
namespace ${NS}
concept Zone { o String text }
enum FundCategory { o private_investment_fund  o none }
concept Umbrella {
${props(UMBRELLA_F)}
  o Boolean om_requires_related_party_consent
  o String related_party_consent_clause
  o FundCategory fund_category
  o String investor_basis_description
}
concept Portfolio {
${props(PORTFOLIO_F)}
  o Boolean has_hurdle
  o String hurdle_rate
}
concept ProjectAsset {
${props(ASSET_F)}
  o Boolean sponsor_retains_shares
  o String sponsor_retained_quantity
}
concept Dated { o String date }
@template
concept D13B {
  o Umbrella umbrella
  o Portfolio portfolio
  o ProjectAsset asset
  o Dated supplement
  o Dated conflict_disclosure
  o Zone issuer_description                       // invented: holder for the AI-drafted zone text
  o Zone project_risk_factors                     // invented: holder for the AI-drafted zone text
}
`,
  md: body({
    locked: `**Issuer: ${W('umbrella', 'legal_name')} for and on behalf of ${W('portfolio', 'legal_name')}**`,
    // Field inside a condition, inline, inside a table cell: only a formula can do it (C2, C2.10).
    perfCell: `${W('portfolio', 'perf_fee_rate')} of profits after investors have received back their subscribed capital{{% return portfolio.has_hurdle ? ' and a return of ' + portfolio.hurdle_rate + ' a year' : '' %}}`,
    p44: `{{#clause asset condition="return asset.sponsor_retains_shares"}}\n4.4 After completion, the Sponsor and its affiliates will continue to hold {{sponsor_retained_quantity}} Company Shares directly.\n{{/clause}}`,
    p52hurdle: `{{% return portfolio.has_hurdle ? ' plus a return of ' + portfolio.hurdle_rate + ' a year' : '' %}}`,
    p106: `{{#clause umbrella condition="return umbrella.om_requires_related_party_consent"}}\n10.6 The acquisition is also subject to the consent required by {{related_party_consent_clause}} of the Offering Memorandum.\n{{/clause}}`,
    p111: `{{#clause umbrella condition="return umbrella.fund_category === 'private_investment_fund'"}}\n11.1 Portfolio Shares may be issued only to investors who meet the basis on which the Company operates as a private investment fund: {{investor_basis_description}}.\n{{/clause}}`,
  }),
  invented: [
    'issuer_description { text } — holder for the AI zone, so the zone can be a #clause',
    'project_risk_factors { text } — holder for the AI zone, so the zone can be a #clause',
  ],
  data(v: V, _dirs: Director[]) {
    return {
      $class: `${NS}.D13B`,
      umbrella: {
        $class: `${NS}.Umbrella`, ...pick(v, 'umbrella', UMBRELLA_F),
        om_requires_related_party_consent: !!v['umbrella.om_requires_related_party_consent'], related_party_consent_clause: s(v, 'umbrella.related_party_consent_clause'),
        fund_category: s(v, 'umbrella.fund_category'), investor_basis_description: s(v, 'umbrella.investor_basis_description'),
      },
      portfolio: { $class: `${NS}.Portfolio`, ...pick(v, 'portfolio', PORTFOLIO_F), has_hurdle: !!v['portfolio.has_hurdle'], hurdle_rate: s(v, 'portfolio.hurdle_rate') },
      asset: { $class: `${NS}.ProjectAsset`, ...pick(v, 'asset', ASSET_F), sponsor_retains_shares: !!v['asset.sponsor_retains_shares'], sponsor_retained_quantity: s(v, 'asset.sponsor_retained_quantity') },
      supplement: { $class: `${NS}.Dated`, date: s(v, 'supplement.date') },
      conflict_disclosure: { $class: `${NS}.Dated`, date: s(v, 'conflict_disclosure.date') },
      issuer_description: zone('issuer_description'),
      project_risk_factors: zone('project_risk_factors'),
    };
  },
};
