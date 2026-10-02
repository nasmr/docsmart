/**
 * The sponsor's record forms (build plan B4), described as data: which fields, how each is entered,
 * and when it applies. Field paths follow the record schemas in @docsmart/domain, which the API
 * validates on save; the forms do not repeat that validation, they place its messages.
 */
import { type Data, getPath, isBlank, setPath } from './paths.js';

interface Base {
  path: string;
  label: string;
  hint?: string;
  /** May be left out. Blank optional fields are removed before saving. */
  optional?: boolean;
  /** Shown only when this holds. Hidden fields are removed before saving. */
  when?: (data: Data) => boolean;
  readOnly?: boolean;
}

export type Field =
  | (Base & { kind: 'text' | 'long' | 'id' | 'date' | 'time' | 'currency' | 'email' | 'decimal' })
  | (Base & { kind: 'money' })
  | (Base & { kind: 'rate' })
  | (Base & { kind: 'int' })
  | (Base & { kind: 'bool' })
  | (Base & { kind: 'enum'; options: ReadonlyArray<readonly [string, string]> })
  | (Base & { kind: 'lines' })
  | (Base & { kind: 'list'; item: Field[]; blank: (items: Data[]) => Data; noun: string });

export interface Section {
  title: string;
  note?: string;
  fields: Field[];
  /** An optional object (e.g. the valuation): dropped when nothing in it was entered. */
  group?: string;
  when?: (data: Data) => boolean;
}

export interface Context {
  umbrella_id?: string | undefined;
  portfolio_id?: string | undefined;
  currency?: string | undefined;
}

export interface FormSpec {
  title: string;
  sections: Section[];
  blank: (ctx: Context) => Data;
  /** The record's id: its own id field, or the portfolio's for records kept under it. */
  idOf: (data: Data, ctx: Context) => string;
}

const money = (currency = 'USD') => ({ amount: '', currency });
const ownId = (data: Data) => String(data.id ?? '');
const portfolioId = (_: Data, ctx: Context) => ctx.portfolio_id ?? '';
const nextId = (prefix: string, items: Data[]) => `${prefix}_${String(items.length + 1).padStart(2, '0')}`;
const ID_HINT = 'Lower-case letters, digits and underscores; fixed once saved.';

/** Blank: nothing entered. A money amount counts, not its currency, which is filled in for you. */
export function isBlankValue(field: Field, value: unknown): boolean {
  if (field.kind === 'money') return isBlank(getPath(value, 'amount'));
  return isBlank(value);
}

/** Every value path a form shows for this data, for placing validation messages. */
export function fieldPaths(spec: FormSpec, data: Data): string[] {
  const paths: string[] = [];
  const walk = (fields: Field[], prefix: string, scope: Data) => {
    for (const f of fields) {
      if (f.when && !f.when(scope)) continue;
      const path = prefix + f.path;
      paths.push(path);
      if (f.kind === 'list') {
        const items = (getPath(data, path) as Data[] | undefined) ?? [];
        items.forEach((item, i) => {
          walk(f.item, `${path}.${i}.`, item);
        });
      }
    }
  };
  for (const s of spec.sections) if (!s.when || s.when(data)) walk(s.fields, '', data);
  return paths;
}

/** The record to send: hidden and blank optional fields removed, blank optional groups dropped. */
export function prepareForSave(spec: FormSpec, data: Data): Data {
  let out = data;
  const clean = (fields: Field[], prefix: string, scope: Data, hidden: boolean) => {
    for (const f of fields) {
      const path = prefix + f.path;
      const value = getPath(out, path);
      if (hidden || (f.when && !f.when(scope)) || (f.optional && isBlankValue(f, value))) {
        out = setPath(out, path, undefined);
      } else if (f.kind === 'list') {
        ((value as Data[] | undefined) ?? []).forEach((item, i) => {
          clean(f.item, `${path}.${i}.`, item, false);
        });
      }
    }
  };
  for (const s of spec.sections) {
    const hidden = !!s.when && !s.when(data);
    clean(s.fields, '', data, hidden);
    if (s.group && (hidden || isBlank(getPath(out, s.group)))) out = setPath(out, s.group, undefined);
  }
  return out;
}

// ---------- the forms ----------

export const FUND_CATEGORIES = [
  ['private_investment_fund', 'Private investment fund'],
  ['private_fund', 'Private fund'],
  ['professional_fund', 'Professional fund'],
  ['public_fund', 'Public fund'],
  ['incubator_fund', 'Incubator fund'],
  ['approved_fund', 'Approved fund'],
  ['not_regulated', 'Not regulated'],
] as const;

export const PORTFOLIO_STATUSES = [
  ['PROPOSED', 'Proposed'],
  ['APPROVED', 'Approved'],
  ['OPEN', 'Open'],
  ['CLOSED', 'Closed'],
  ['INVESTED', 'Invested'],
  ['DISTRIBUTING', 'Distributing'],
  ['WINDING_UP', 'Winding up'],
  ['TERMINATED', 'Terminated'],
] as const;

export const ACQUISITION_SOURCES = [
  ['issuer_primary', 'Bought from the issuer'],
  ['market_secondary', 'Bought from a third party'],
  ['gp_sourced', 'Supplied by the sponsor'],
] as const;

export const umbrellaForm: FormSpec = {
  title: 'Umbrella',
  idOf: ownId,
  blank: () => ({
    id: '',
    legal_name: '',
    company_number: '',
    registered_agent: '',
    registered_office: '',
    fund_category: 'private_investment_fund',
    is_regulated_fund: true,
    investor_basis_description: '',
    directors: [],
    authorised_signatories: [],
    offering_memorandum: { date: '', requires_related_party_consent: false },
    service_providers: { administrator: { name: '' } },
    cost_allocation_rules: [],
    sponsor_id: '',
  }),
  sections: [
    {
      title: 'The company',
      fields: [
        { kind: 'id', path: 'id', label: 'Umbrella id', hint: ID_HINT },
        {
          kind: 'text',
          path: 'legal_name',
          label: 'Legal name',
          hint: 'As registered, including “Segregated Portfolio Company” or “SPC”. Every document uses it.',
        },
        { kind: 'text', path: 'company_number', label: 'BVI company number' },
        { kind: 'text', path: 'registered_agent', label: 'Registered agent' },
        { kind: 'long', path: 'registered_office', label: 'Registered office' },
        { kind: 'id', path: 'sponsor_id', label: 'Sponsor id', hint: 'The sponsor record this umbrella belongs to.' },
      ],
    },
    {
      title: 'Regulation',
      note: 'The category list is to be confirmed with BVI counsel.',
      fields: [
        { kind: 'bool', path: 'is_regulated_fund', label: 'Regulated fund' },
        { kind: 'enum', path: 'fund_category', label: 'Fund category', options: FUND_CATEGORIES },
        {
          kind: 'long',
          path: 'investor_basis_description',
          label: 'Who may invest',
          hint: 'The investor basis as the offering memorandum states it.',
        },
      ],
    },
    {
      title: 'Directors and signatories',
      fields: [
        {
          kind: 'list',
          path: 'directors',
          label: 'Directors',
          noun: 'director',
          blank: (items) => ({ id: nextId('dir', items), name: '', independent: false }),
          item: [
            { kind: 'id', path: 'id', label: 'Id' },
            { kind: 'text', path: 'name', label: 'Name' },
            { kind: 'bool', path: 'independent', label: 'Independent' },
            { kind: 'text', path: 'note', label: 'Note', optional: true },
          ],
        },
        {
          kind: 'list',
          path: 'authorised_signatories',
          label: 'Authorised signatories',
          noun: 'signatory',
          blank: (items) => ({ id: nextId('sig', items), director_id: '', name: '', title: '' }),
          item: [
            { kind: 'id', path: 'id', label: 'Id' },
            { kind: 'id', path: 'director_id', label: 'Director id', hint: 'Must be one of the directors above.' },
            { kind: 'text', path: 'name', label: 'Name' },
            { kind: 'text', path: 'title', label: 'Title' },
          ],
        },
      ],
    },
    {
      title: 'Offering memorandum',
      fields: [
        { kind: 'date', path: 'offering_memorandum.date', label: 'Date' },
        {
          kind: 'bool',
          path: 'offering_memorandum.requires_related_party_consent',
          label: 'Requires related-party consent',
        },
        {
          kind: 'long',
          path: 'offering_memorandum.related_party_consent_clause',
          label: 'Related-party consent clause',
          optional: true,
          when: (d) => getPath(d, 'offering_memorandum.requires_related_party_consent') === true,
        },
        {
          kind: 'lines',
          path: 'offering_memorandum.defined_terms',
          label: 'Defined terms',
          hint: 'One per line. The terms the supplements may use without defining them again.',
          optional: true,
        },
        { kind: 'long', path: 'offering_memorandum.note', label: 'Note', optional: true },
      ],
    },
    {
      title: 'Service providers',
      fields: [
        { kind: 'text', path: 'service_providers.administrator.name', label: 'Administrator' },
        { kind: 'text', path: 'service_providers.auditor.name', label: 'Auditor', optional: true },
      ],
    },
    {
      title: 'Cost-allocation rules',
      note: 'How umbrella costs are shared between portfolios. The rule with the latest effective date applies.',
      fields: [
        {
          kind: 'list',
          path: 'cost_allocation_rules',
          label: 'Rules',
          noun: 'rule',
          blank: () => ({ ref: '', category: '', basis: '', effective_from: '', approved_by: '' }),
          item: [
            { kind: 'text', path: 'ref', label: 'Reference', hint: 'e.g. 2026-01' },
            { kind: 'text', path: 'category', label: 'Cost category' },
            { kind: 'long', path: 'basis', label: 'Basis of allocation' },
            { kind: 'date', path: 'effective_from', label: 'Effective from' },
            { kind: 'id', path: 'approved_by', label: 'Approved by (director id)' },
          ],
        },
      ],
    },
  ],
};

export const sponsorForm: FormSpec = {
  title: 'Sponsor',
  idOf: ownId,
  blank: () => ({ id: '', legal_name: '', affiliates: [] }),
  sections: [
    {
      title: 'Sponsor',
      fields: [
        { kind: 'id', path: 'id', label: 'Sponsor id', hint: ID_HINT },
        { kind: 'text', path: 'legal_name', label: 'Legal name' },
        {
          kind: 'list',
          path: 'affiliates',
          label: 'Affiliates',
          noun: 'affiliate',
          blank: (items) => ({ id: nextId('aff', items), legal_name: '', relationship: '' }),
          item: [
            { kind: 'id', path: 'id', label: 'Id' },
            { kind: 'text', path: 'legal_name', label: 'Legal name' },
            { kind: 'text', path: 'relationship', label: 'Relationship to the sponsor' },
          ],
        },
      ],
    },
  ],
};

export const portfolioForm: FormSpec = {
  title: 'Portfolio',
  idOf: ownId,
  blank: (ctx) => ({
    id: '',
    umbrella_id: ctx.umbrella_id ?? '',
    legal_name: '',
    project_ref: '',
    share_class_name: '',
    share_par_value: money(),
    base_currency: 'USD',
    status: 'PROPOSED',
    allocation_policy: { description: '' },
  }),
  sections: [
    {
      title: 'The portfolio',
      fields: [
        { kind: 'id', path: 'id', label: 'Portfolio id', hint: `${ID_HINT} e.g. pf_cedar` },
        {
          kind: 'text',
          path: 'legal_name',
          label: 'Legal name',
          hint: 'Including “Segregated Portfolio”, e.g. “Cedar Segregated Portfolio”. The contracting-party wording is built from it.',
        },
        { kind: 'text', path: 'short_name', label: 'Short name', optional: true, hint: 'For screens, e.g. Cedar SP.' },
        { kind: 'text', path: 'project_ref', label: 'Project reference' },
        { kind: 'enum', path: 'status', label: 'Stage', options: PORTFOLIO_STATUSES },
        { kind: 'id', path: 'umbrella_id', label: 'Umbrella', readOnly: true },
      ],
    },
    {
      title: 'Shares',
      fields: [
        { kind: 'text', path: 'share_class_name', label: 'Share class', hint: 'e.g. Class A Participating Shares' },
        { kind: 'money', path: 'share_par_value', label: 'Par value per share' },
        { kind: 'currency', path: 'base_currency', label: 'Base currency' },
        {
          kind: 'long',
          path: 'allocation_policy.description',
          label: 'Allocation policy',
          hint: 'How oversubscription is allocated, as it should read in the documents.',
        },
      ],
    },
  ],
};

export const termsForm: FormSpec = {
  title: 'Terms',
  idOf: portfolioId,
  blank: (ctx) => ({
    portfolio_id: ctx.portfolio_id ?? '',
    version: 1,
    min_subscription: money(ctx.currency),
    subscription_price: money(ctx.currency),
    mgmt_fee_rate: '',
    fee_basis: '',
    fee_frequency: 'quarterly',
    perf_fee_rate: '',
    has_hurdle: false,
    org_expense_cap: money(ctx.currency),
    term_years: '',
    extension_years: 0,
    costs_deducted_on_lapse: false,
  }),
  sections: [
    {
      title: 'Subscriptions',
      fields: [
        { kind: 'int', path: 'version', label: 'Terms version' },
        { kind: 'money', path: 'min_subscription', label: 'Minimum subscription' },
        { kind: 'money', path: 'subscription_price', label: 'Subscription price per share' },
      ],
    },
    {
      title: 'Fees',
      fields: [
        { kind: 'rate', path: 'mgmt_fee_rate', label: 'Management fee', hint: 'A year, as a percentage.' },
        { kind: 'text', path: 'fee_basis', label: 'Charged on', hint: 'e.g. subscribed capital' },
        {
          kind: 'enum',
          path: 'fee_frequency',
          label: 'Paid',
          options: [
            ['quarterly', 'Quarterly'],
            ['semi_annually', 'Semi-annually'],
            ['annually', 'Annually'],
          ],
        },
        { kind: 'rate', path: 'perf_fee_rate', label: 'Performance fee', hint: 'Of profits, as a percentage.' },
        { kind: 'bool', path: 'has_hurdle', label: 'Performance fee has a hurdle' },
        { kind: 'rate', path: 'hurdle_rate', label: 'Hurdle', optional: true, when: (d) => d.has_hurdle === true },
        { kind: 'money', path: 'org_expense_cap', label: 'Organisational expenses cap' },
      ],
    },
    {
      title: 'Term',
      fields: [
        { kind: 'int', path: 'term_years', label: 'Term (years)' },
        { kind: 'int', path: 'extension_years', label: 'Extension (years)', hint: '0 for none.' },
        {
          kind: 'bool',
          path: 'costs_deducted_on_lapse',
          label: 'Costs are deducted if the offer lapses',
        },
        {
          kind: 'money',
          path: 'lapse_cost_cap',
          label: 'Cap on costs deducted on lapse',
          optional: true,
          when: (d) => d.costs_deducted_on_lapse === true,
        },
      ],
    },
  ],
};

export const offerForm: FormSpec = {
  title: 'Offer',
  idOf: ownId,
  blank: (ctx) => ({
    id: ctx.portfolio_id ? `${ctx.portfolio_id.replace(/^pf_/, '')}_offer` : '',
    portfolio_id: ctx.portfolio_id ?? '',
    open_date: '',
    close_date: '',
    funding_deadline: '',
    target_size: money(ctx.currency),
    hard_cap: money(ctx.currency),
    minimum_close_amount: money(ctx.currency),
  }),
  sections: [
    {
      title: 'Dates',
      fields: [
        { kind: 'id', path: 'id', label: 'Offer id', hint: ID_HINT },
        { kind: 'date', path: 'open_date', label: 'Opens' },
        { kind: 'date', path: 'close_date', label: 'Closes' },
        { kind: 'date', path: 'funding_deadline', label: 'Funding deadline' },
      ],
    },
    {
      title: 'Size',
      fields: [
        { kind: 'money', path: 'target_size', label: 'Target' },
        { kind: 'money', path: 'hard_cap', label: 'Hard cap' },
        { kind: 'money', path: 'minimum_close_amount', label: 'Minimum to close' },
      ],
    },
  ],
};

const gp = (d: Data) => d.acquisition_source === 'gp_sourced';

export const assetForm: FormSpec = {
  title: 'Asset',
  idOf: ownId,
  blank: (ctx) => ({
    id: ctx.portfolio_id ? `${ctx.portfolio_id.replace(/^pf_/, '')}_asset` : '',
    portfolio_id: ctx.portfolio_id ?? '',
    issuer_name: '',
    issuer_jurisdiction: '',
    instrument: '',
    acquisition_source: 'issuer_primary',
    quantity: '',
    price_per_share: money(ctx.currency),
    seller_name: '',
    consent_status: 'not_required',
    transfer_restrictions: '',
  }),
  sections: [
    {
      title: 'The asset',
      fields: [
        { kind: 'id', path: 'id', label: 'Asset id', hint: ID_HINT },
        { kind: 'text', path: 'issuer_name', label: 'Issuer' },
        {
          kind: 'text',
          path: 'issuer_jurisdiction',
          label: 'Issuer jurisdiction',
          hint: 'e.g. Delaware, United States',
        },
        { kind: 'text', path: 'instrument', label: 'Instrument', hint: 'e.g. Series B Preferred Stock' },
        { kind: 'text', path: 'round_name', label: 'Round', optional: true },
        { kind: 'int', path: 'quantity', label: 'Number of shares' },
        { kind: 'money', path: 'price_per_share', label: 'Price per share' },
        { kind: 'date', path: 'long_stop_date', label: 'Long-stop date', optional: true },
        { kind: 'int', path: 'completion_window_days', label: 'Completion window (days)', optional: true },
      ],
    },
    {
      title: 'Where it comes from',
      fields: [
        { kind: 'enum', path: 'acquisition_source', label: 'Source', options: ACQUISITION_SOURCES },
        { kind: 'text', path: 'seller_name', label: 'Seller' },
        {
          kind: 'id',
          path: 'seller_affiliate_id',
          label: 'Seller is the sponsor affiliate',
          hint: 'The affiliate id from the sponsor record.',
          optional: true,
          when: gp,
        },
        {
          kind: 'money',
          path: 'gp_cost_basis_per_share',
          label: "Sponsor's cost per share",
          optional: true,
          when: gp,
        },
        { kind: 'date', path: 'gp_acquisition_date', label: 'Sponsor bought it on', optional: true, when: gp },
        {
          kind: 'text',
          path: 'gp_cost_evidence.evidence_ref',
          label: 'Cost evidence reference',
          optional: true,
          when: gp,
        },
        {
          kind: 'text',
          path: 'gp_cost_evidence.description',
          label: 'Cost evidence description',
          optional: true,
          when: gp,
        },
        { kind: 'bool', path: 'sponsor_retains_shares', label: 'The sponsor keeps some shares', when: gp },
        {
          kind: 'int',
          path: 'sponsor_retained_quantity',
          label: 'Shares the sponsor keeps',
          optional: true,
          when: (d) => gp(d) && d.sponsor_retains_shares === true,
        },
      ],
    },
    {
      title: 'Independent valuation',
      group: 'valuation',
      note: 'Leave blank if there is none.',
      fields: [
        { kind: 'text', path: 'valuation.valuer_name', label: 'Valuer' },
        { kind: 'date', path: 'valuation.date', label: 'Report date' },
        { kind: 'decimal', path: 'valuation.range_per_share.low', label: 'Range per share, low' },
        { kind: 'decimal', path: 'valuation.range_per_share.high', label: 'Range per share, high' },
        { kind: 'currency', path: 'valuation.range_per_share.currency', label: 'Range currency' },
      ],
    },
    {
      title: 'Transfer',
      fields: [
        {
          kind: 'enum',
          path: 'consent_status',
          label: 'Issuer consent',
          options: [
            ['not_required', 'Not required'],
            ['requested', 'Requested'],
            ['obtained', 'Obtained'],
            ['waived', 'Waived'],
            ['lapsed', 'Lapsed'],
          ],
        },
        { kind: 'long', path: 'transfer_restrictions', label: 'Transfer restrictions' },
      ],
    },
    {
      title: 'Placement',
      group: 'placement',
      note: 'Leave blank if there is no placement agent.',
      fields: [
        { kind: 'bool', path: 'placement.has_fee', label: 'A placement fee is paid' },
        { kind: 'text', path: 'placement.agent_name', label: 'Placement agent', optional: true },
        { kind: 'long', path: 'placement.fee_description', label: 'Fee', optional: true },
      ],
    },
  ],
};

export const accountForm: FormSpec = {
  title: 'Subscription account',
  idOf: portfolioId,
  blank: () => ({ account_name: '', bank_name: '', account_number: '', swift: '', verified_by: '' }),
  sections: [
    {
      title: 'Where subscriptions are paid',
      note: "The portfolio's own account, from the administrator's verified record.",
      fields: [
        { kind: 'text', path: 'account_name', label: 'Account name' },
        { kind: 'text', path: 'bank_name', label: 'Bank' },
        { kind: 'text', path: 'account_number', label: 'Account number' },
        { kind: 'text', path: 'swift', label: 'SWIFT / BIC' },
        { kind: 'text', path: 'verified_by', label: 'Verified by' },
      ],
    },
  ],
};

/** A blank list item's values, for adding one. */
export function addItem(data: Data, field: Extract<Field, { kind: 'list' }>, prefix = ''): Data {
  const path = prefix + field.path;
  const items = (getPath(data, path) as Data[] | undefined) ?? [];
  return setPath(data, path, [...items, field.blank(items)]);
}
