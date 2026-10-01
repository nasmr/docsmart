// D12-B (written resolution, sponsor asset) ported to TemplateMark, two variants.
// Source wording: templates/generator/resolutions.js (header, B.body, operative, directorSigs).
import type { Director } from './atlas.ts';

const NS = 'org.docsmart.d12b@1.0.0';
type V = Record<string, string | boolean>;
const s = (v: V, k: string) => String(v[k]);

const ARTICLES_Q = 'Which article permits directors to act by written resolution, and must every director sign?';
const REGULATORY_Q = 'Is the Company a regulated fund (for example a private investment fund recognised under SIBA) or unregulated? The source reviewed says a regulated fund needs the FSC’s prior approval to create a new portfolio, while an unregulated SPC notifies the FSC in writing within 14 days (Segregated Portfolio Companies (BVI Business Company) Regulations, reg. 7). Please confirm which applies and the current form.';

// ------------------------------------------------------------------------------------------
// Shared text. W(entity, field) writes a field in the #with form TemplateMark needs.
// ------------------------------------------------------------------------------------------
const W = (entity: string, field: string) => `{{#with ${entity}}}{{${field}}}{{/with}}`;

function body(v: { p11: string; interests: string; p21tail: string; s3: string; p55: string; locked: string; effective: string }) {
  return `# WRITTEN RESOLUTIONS OF THE DIRECTORS

# OF ${W('umbrella', 'legal_name')}

(the “Company”), a BVI business company registered as a segregated portfolio company, company number ${W('umbrella', 'company_number')}

Passed in writing on ${W('resolution', 'date')} in accordance with the Company’s articles of association and the BVI Business Companies Act (Revised Edition 2020) (the “Act”).

## 1 Background

1.1 The Company is a segregated portfolio company${v.p11}.

1.2 The directors propose to create a new segregated portfolio to acquire ${W('asset', 'instrument')} of ${W('asset', 'issuer_name')} (the “Project Shares”) from ${W('asset', 'seller_name')} (the “Seller”), which is an affiliate of ${W('sponsor', 'legal_name')} (the “Sponsor”).

1.3 The Seller acquired the Project Shares on ${W('asset', 'sponsor_acquisition_date')} at ${W('asset', 'sponsor_cost_per_share')} per share. The proposed transfer price is ${W('asset', 'price_per_share')} per share (the “Transfer Price”), a markup of ${W('asset', 'markup_pct')} on the Seller’s cost.

1.4 ${W('asset', 'valuer_name')} has provided an independent valuation of the Project Shares dated ${W('asset', 'valuation_date')} (the “Valuation”), which was tabled with these resolutions.

## Declarations of interest

${v.interests}

The directors who have not declared an interest (the “Independent Directors”) have considered the Valuation, the Transfer Price and the Seller’s cost before passing the resolutions in section 5.

<!-- COUNSEL NOTE: The markup is calculated by the platform from the recorded cost and Transfer Price, not typed in. Please confirm the declaration wording and whether the Independent Directors alone must pass section 5. -->

IT IS RESOLVED THAT:

## 2 Creation of the Portfolio

2.1 A segregated portfolio of the Company be created and named ${W('portfolio', 'legal_name')} (the “Portfolio”), with effect from ${W('resolution', 'effective_date')}${v.p21tail}.

2.2 The assets and liabilities attributable to the Portfolio be held and recorded separately from the general assets of the Company and from the assets of every other segregated portfolio of the Company, and the directors establish and maintain procedures for that purpose.

2.3 A class of shares linked to the Portfolio be designated as ${W('portfolio', 'share_class_name')}, each with a par value of ${W('portfolio', 'share_par_value')}, carrying the rights set out in the Company’s articles of association and the Supplement (the “Portfolio Shares”), and every Portfolio Share be recorded in the register of members as linked to the Portfolio.

## 3 Regulatory approval or notification

${v.s3}

<!-- COUNSEL NOTE: ${REGULATORY_Q} -->

## 4 Offer of Portfolio Shares

4.1 The supplement to the Company’s offering memorandum dated ${W('umbrella', 'om_date')} relating to the Portfolio, in the form tabled (the “Supplement”), be approved, subject to its clearance by the Company’s legal counsel.

4.2 Portfolio Shares be offered at ${W('portfolio', 'subscription_price')} per share, with a minimum subscription of ${W('portfolio', 'min_subscription')} per investor and a maximum aggregate offer of ${W('portfolio', 'max_offer')}.

4.3 The offer open on ${W('portfolio', 'offer_open_date')} and close on ${W('portfolio', 'offer_close_date')}, unless the directors resolve to extend or close it early.

4.4 If subscriptions received exceed the maximum aggregate offer, allocations be made ${W('portfolio', 'allocation_method_description')}, and the allocation for each investor be recorded in the Company’s records.

<!-- COUNSEL NOTE: The minimum subscription must be consistent with the investor category the Company relies on. For a private investment fund issuing only to professional investors, the sources reviewed give a minimum initial investment of US$100,000. Please confirm the category and minimum. -->

## 5 Acquisition from the Seller (Independent Directors)

5.1 Having considered the Valuation, the Transfer Price and the Seller’s cost, the Independent Directors approve the acquisition by the Company, for and on behalf of the Portfolio, of up to ${W('asset', 'max_quantity')} Project Shares from the Seller at the Transfer Price, for a total consideration not exceeding ${W('asset', 'total_consideration')}.

5.2 Completion be conditional on (a) the offer of Portfolio Shares closing with cleared subscription monies of at least ${W('portfolio', 'minimum_close_amount')}, and (b) any consent, waiver or right of first refusal required by ${W('asset', 'issuer_name')} having been obtained or having lapsed.

5.3 The conflict disclosure statement in the form tabled (the “Conflict Disclosure”), which sets out the Seller’s cost, the Transfer Price, the markup and the Valuation, be approved subject to its clearance by the Company’s legal counsel, and be given to every prospective investor before they subscribe.

5.4 Every subscription agreement for Portfolio Shares include the investor’s written acknowledgement that they have received and read the Conflict Disclosure.

${v.p55}

## 6 Contracting for the Portfolio

6.1 Every agreement, instrument and notice entered into or given in connection with the Portfolio state on its face that it is executed by the Company for and on behalf of the Portfolio, using the following wording:

${v.locked}

## 7 Authority

7.1 Any director be authorised to sign, for and on behalf of the Company acting for the Portfolio, the Supplement, subscription agreements, share certificates (if issued) and any other document needed to give effect to these resolutions.

7.2 The registered agent be instructed to update the register of members and any other statutory records to reflect these resolutions.

These resolutions are passed by the directors signing below and take effect when the last director signs${v.effective}.

{{#clause umbrella}}
{{#ulist directors}}
- {{name}}

  \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

  Director

  Date: {{signed_date}}
{{/ulist}}
{{/clause}}

<!-- COUNSEL NOTE: ${ARTICLES_Q} -->
`;
}

const S3_IF = `{{#with umbrella}}{{#if is_regulated_fund}}3.1 Any director, or the Company’s registered agent, be authorised to apply to the Financial Services Commission for approval of the creation of the Portfolio, and no Portfolio Shares be issued until that approval has been received.{{else}}3.1 The Company’s registered agent be instructed to notify the Financial Services Commission in writing of the creation of the Portfolio within 14 days of the date on which it is created.{{/if}}{{/with}}`;
const P21_IF = `{{#with umbrella}}{{#if is_regulated_fund}} or, if later, the date on which the Financial Services Commission approves the creation of the Portfolio{{/if}}{{/with}}`;

// ------------------------------------------------------------------------------------------
// Variant 1: data only. No formulas, no condition= anywhere.
// ------------------------------------------------------------------------------------------
export const dataOnly = {
  cto: `
namespace ${NS}
concept Regulated { o String fund_category }
concept RelatedPartyConsent { o String clause }
concept SigningDirector { o String name  o String signed_date }
concept InterestedDirector { o String name  o String interest_description }
concept Umbrella {
  o String legal_name
  o String company_number
  o Boolean is_regulated_fund
  o String om_date
  o Regulated regulated optional                      // invented: present when is_regulated_fund
  o RelatedPartyConsent related_party_consent optional // invented: present when om_requires_related_party_consent
  o SigningDirector[] directors
}
concept Sponsor { o String legal_name }
concept Portfolio {
  o String legal_name  o String share_class_name  o String share_par_value  o String subscription_price
  o String min_subscription  o String max_offer  o String offer_open_date  o String offer_close_date
  o String allocation_method_description  o String minimum_close_amount
}
concept ProjectAsset {
  o String instrument  o String issuer_name  o String seller_name  o String sponsor_acquisition_date
  o String sponsor_cost_per_share  o String price_per_share  o String markup_pct  o String valuer_name
  o String valuation_date  o String max_quantity  o String total_consideration
}
concept Resolution {
  o String date
  o String effective_date
  o String later_effective_date optional               // invented: present when effective_date_differs
}
concept ContractingParty { o String designation }      // invented: wording built by our code from the records
@template
concept D12B {
  o Umbrella umbrella
  o Sponsor sponsor
  o Portfolio portfolio
  o ProjectAsset asset
  o Resolution resolution
  o InterestedDirector[] interested_directors          // invented: umbrella.directors WHERE is_interested
  o ContractingParty contracting_party
}
`,
  md: body({
    p11: `{{#with umbrella}}{{#optional regulated}} and is recognised as a {{fund_category}} under the Securities and Investment Business Act (Revised Edition 2020){{/optional}}{{/with}}`,
    interests: `{{#ulist interested_directors}}\n- {{name}} has declared to the other directors that they are interested in the acquisition as {{interest_description}}.\n{{/ulist}}`,
    p21tail: P21_IF,
    s3: S3_IF,
    p55: `{{#with umbrella}}{{#optional related_party_consent}}5.5 Completion also be conditional on the consent required by {{clause}} of the offering memorandum having been obtained.{{/optional}}{{/with}}`,
    locked: `{{#clause contracting_party}}\n**{{designation}}**\n{{/clause}}`,
    effective: `{{#with resolution}}{{#optional later_effective_date}} or on {{this}} if later{{/optional}}{{/with}}`,
  }),
  invented: [
    'umbrella.regulated { fund_category } — optional concept standing for [[IF umbrella.is_regulated_fund]] with a field inside (1.1)',
    'umbrella.related_party_consent { clause } — optional concept standing for [[IF umbrella.om_requires_related_party_consent]] with a field inside (5.5)',
    'resolution.later_effective_date — optional scalar standing for [[IF resolution.effective_date_differs]] with a field inside (signing paragraph)',
    'interested_directors — pre-filtered list standing for [[FOR EACH director IN umbrella.directors WHERE director.is_interested]]',
    'contracting_party.designation — the locked wording, built by our code, so it is data not template text',
  ],
  data(v: V, dirs: Director[]) {
    return {
      $class: `${NS}.D12B`,
      umbrella: {
        $class: `${NS}.Umbrella`,
        legal_name: s(v, 'umbrella.legal_name'), company_number: s(v, 'umbrella.company_number'), is_regulated_fund: !!v['umbrella.is_regulated_fund'], om_date: s(v, 'umbrella.om_date'),
        ...(v['umbrella.is_regulated_fund'] ? { regulated: { $class: `${NS}.Regulated`, fund_category: s(v, 'umbrella.fund_category') } } : {}),
        ...(v['umbrella.om_requires_related_party_consent'] ? { related_party_consent: { $class: `${NS}.RelatedPartyConsent`, clause: s(v, 'umbrella.related_party_consent_clause') } } : {}),
        directors: dirs.map((d) => ({ $class: `${NS}.SigningDirector`, name: d.name, signed_date: d.signed_date })),
      },
      sponsor: { $class: `${NS}.Sponsor`, legal_name: s(v, 'sponsor.legal_name') },
      portfolio: portfolio(v),
      asset: asset(v),
      resolution: { $class: `${NS}.Resolution`, date: s(v, 'resolution.date'), effective_date: s(v, 'resolution.effective_date'), ...(v['resolution.effective_date_differs'] ? { later_effective_date: s(v, 'resolution.effective_date') } : {}) },
      interested_directors: dirs.filter((d) => d.is_interested).map((d) => ({ $class: `${NS}.InterestedDirector`, name: d.name, interest_description: d.interest_description ?? '' })),
      contracting_party: { $class: `${NS}.ContractingParty`, designation: `${s(v, 'umbrella.legal_name')} for and on behalf of ${s(v, 'portfolio.legal_name')}` },
    };
  },
};

function portfolio(v: V) {
  const f = ['legal_name', 'share_class_name', 'share_par_value', 'subscription_price', 'min_subscription', 'max_offer', 'offer_open_date', 'offer_close_date', 'allocation_method_description', 'minimum_close_amount'];
  return { $class: `${NS}.Portfolio`, ...Object.fromEntries(f.map((k) => [k, s(v, 'portfolio.' + k)])) };
}
function asset(v: V) {
  const f = ['instrument', 'issuer_name', 'seller_name', 'sponsor_acquisition_date', 'sponsor_cost_per_share', 'price_per_share', 'markup_pct', 'valuer_name', 'valuation_date', 'max_quantity', 'total_consideration'];
  return { $class: `${NS}.ProjectAsset`, ...Object.fromEntries(f.map((k) => [k, s(v, 'asset.' + k)])) };
}

// ------------------------------------------------------------------------------------------
// Variant 2: code allowed. The model mirrors the records (booleans as in the Word master);
// formulas and condition= are used where they bring the template closer to the master.
// ------------------------------------------------------------------------------------------
export const codeAllowed = {
  cto: `
namespace ${NS}
concept Director { o String name  o Boolean is_interested  o String interest_description optional  o String signed_date }
concept Umbrella {
  o String legal_name  o String company_number  o Boolean is_regulated_fund  o String fund_category  o String om_date
  o Boolean om_requires_related_party_consent  o String related_party_consent_clause  o Director[] directors
}
concept Sponsor { o String legal_name }
concept Portfolio {
  o String legal_name  o String share_class_name  o String share_par_value  o String subscription_price
  o String min_subscription  o String max_offer  o String offer_open_date  o String offer_close_date
  o String allocation_method_description  o String minimum_close_amount
}
concept ProjectAsset {
  o String instrument  o String issuer_name  o String seller_name  o String sponsor_acquisition_date
  o String sponsor_cost_per_share  o String price_per_share  o String markup_pct  o String valuer_name
  o String valuation_date  o String max_quantity  o String total_consideration
}
concept Resolution { o String date  o String effective_date  o Boolean effective_date_differs }
@template
concept D12B { o Umbrella umbrella  o Sponsor sponsor  o Portfolio portfolio  o ProjectAsset asset  o Resolution resolution }
`,
  md: body({
    // A field inside #if does not type (C2), and a formula inside #if gets no value (C2.10), so the whole phrase is one formula.
    p11: `{{% return umbrella.is_regulated_fund ? ' and is recognised as a ' + umbrella.fund_category + ' under the Securities and Investment Business Act (Revised Edition 2020)' : '' %}}`,
    // WHERE: a condition inside a list item cannot drop the item (C6.5b), so the filtered paragraphs are one formula.
    interests: `{{% return umbrella.directors.filter(d => d.is_interested).map(d => d.name + ' has declared to the other directors that they are interested in the acquisition as ' + d.interest_description + '.').join(' ') %}}`,
    p21tail: P21_IF,
    s3: S3_IF,
    p55: `{{#clause umbrella condition="return umbrella.om_requires_related_party_consent"}}\n5.5 Completion also be conditional on the consent required by {{related_party_consent_clause}} of the offering memorandum having been obtained.\n{{/clause}}`,
    locked: `**${W('umbrella', 'legal_name')} for and on behalf of ${W('portfolio', 'legal_name')}**`,
    effective: `{{% return resolution.effective_date_differs ? ' or on ' + resolution.effective_date + ' if later' : '' %}}`,
  }),
  invented: [] as string[],
  data(v: V, dirs: Director[]) {
    return {
      $class: `${NS}.D12B`,
      umbrella: {
        $class: `${NS}.Umbrella`,
        legal_name: s(v, 'umbrella.legal_name'), company_number: s(v, 'umbrella.company_number'), is_regulated_fund: !!v['umbrella.is_regulated_fund'],
        fund_category: s(v, 'umbrella.fund_category'), om_date: s(v, 'umbrella.om_date'),
        om_requires_related_party_consent: !!v['umbrella.om_requires_related_party_consent'], related_party_consent_clause: s(v, 'umbrella.related_party_consent_clause'),
        directors: dirs.map((d) => ({ $class: `${NS}.Director`, name: d.name, is_interested: d.is_interested, ...(d.interest_description ? { interest_description: d.interest_description } : {}), signed_date: d.signed_date })),
      },
      sponsor: { $class: `${NS}.Sponsor`, legal_name: s(v, 'sponsor.legal_name') },
      portfolio: portfolio(v),
      asset: asset(v),
      resolution: { $class: `${NS}.Resolution`, date: s(v, 'resolution.date'), effective_date: s(v, 'resolution.effective_date'), effective_date_differs: !!v['resolution.effective_date_differs'] },
    };
  },
};
