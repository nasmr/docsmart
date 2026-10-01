/**
 * Records the sponsor enters (build plan B2, B4), as Zod schemas. Field names follow the
 * `source` paths in templates/fields/catalogue.json.
 *
 * These enforce what the spec requires of the records themselves. Whether a particular template
 * has everything it needs is the required-slot check's job (build plan B6), not this module's.
 */
import { z } from 'zod';
import { portfolioNameProblems, umbrellaNameProblems } from './names.js';

// ---------- value types (catalogue `types`) ----------

const DECIMAL = /^-?\d+(\.\d+)?$/;
export const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'must be a lower-case id');
export const Currency = z.string().regex(/^[A-Z]{3}$/, 'must be a three-letter ISO 4217 code');
export const DecimalString = z.string().regex(DECIMAL, 'must be a plain decimal number');
export const Money = z.strictObject({
  amount: DecimalString.refine((s) => !s.startsWith('-'), 'must not be negative'),
  currency: Currency,
});
export type Money = z.infer<typeof Money>;
/** A fraction between 0 and 1 inclusive, as a decimal string ("0.02" is 2%). */
export const Rate = z.string().regex(/^(0(\.\d+)?|1(\.0+)?)$/, 'must be a decimal fraction between 0 and 1');
export const IsoDate = z.iso.date();
export const ShareCount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const Text = z.string().trim().min(1, 'is required');

const legalName = (which: 'umbrella' | 'portfolio') =>
  z.string().superRefine((name, ctx) => {
    const problems = which === 'umbrella' ? umbrellaNameProblems(name) : portfolioNameProblems(name);
    for (const message of problems) ctx.addIssue({ code: 'custom', message });
  });

/** Adds an issue at `path` when `when` holds and the field is missing. */
function requireWhen(ctx: z.RefinementCtx, when: boolean, value: unknown, path: (string | number)[], why: string) {
  if (when && (value === undefined || value === null))
    ctx.addIssue({ code: 'custom', path, message: `is required ${why}` });
}

// ---------- umbrella and sponsor ----------

export const FundCategory = z.enum([
  'private_investment_fund',
  'private_fund',
  'professional_fund',
  'public_fund',
  'incubator_fund',
  'approved_fund',
  'not_regulated',
]);

export const Director = z.strictObject({ id: Id, name: Text, independent: z.boolean(), note: z.string().optional() });
export const AuthorisedSignatory = z.strictObject({ id: Id, director_id: Id, name: Text, title: Text });

export const Umbrella = z
  .strictObject({
    id: Id,
    legal_name: legalName('umbrella'),
    company_number: Text,
    registered_agent: Text,
    registered_office: Text,
    fund_category: FundCategory,
    is_regulated_fund: z.boolean(),
    investor_basis_description: Text,
    directors: z.array(Director).min(1, 'needs at least one director'),
    authorised_signatories: z.array(AuthorisedSignatory),
    offering_memorandum: z.strictObject({
      date: IsoDate,
      requires_related_party_consent: z.boolean(),
      related_party_consent_clause: Text.optional(),
      defined_terms: z.array(Text).optional(),
      note: z.string().optional(),
    }),
    service_providers: z.strictObject({
      administrator: z.strictObject({ name: Text }),
      auditor: z.strictObject({ name: Text }).optional(),
    }),
    cost_allocation_rules: z.array(
      z.strictObject({ ref: Text, category: Text, basis: Text, effective_from: IsoDate, approved_by: Id }),
    ),
    sponsor_id: Id,
  })
  .superRefine((u, ctx) => {
    requireWhen(
      ctx,
      u.offering_memorandum.requires_related_party_consent,
      u.offering_memorandum.related_party_consent_clause,
      ['offering_memorandum', 'related_party_consent_clause'],
      'when the offering memorandum requires related-party consent',
    );
    const directorIds = new Set(u.directors.map((d) => d.id));
    u.authorised_signatories.forEach((s, i) => {
      if (!directorIds.has(s.director_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['authorised_signatories', i, 'director_id'],
          message: 'is not a director',
        });
      }
    });
  });
export type Umbrella = z.infer<typeof Umbrella>;

export const Sponsor = z.strictObject({
  id: Id,
  legal_name: Text,
  affiliates: z.array(z.strictObject({ id: Id, legal_name: Text, relationship: Text })),
});
export type Sponsor = z.infer<typeof Sponsor>;

// ---------- portfolio ----------

/** Addendum §3.3. */
export const PortfolioStatus = z.enum([
  'PROPOSED',
  'APPROVED',
  'OPEN',
  'CLOSED',
  'INVESTED',
  'DISTRIBUTING',
  'WINDING_UP',
  'TERMINATED',
]);

export const Portfolio = z.strictObject({
  id: Id,
  umbrella_id: Id,
  legal_name: legalName('portfolio'),
  short_name: Text.optional(),
  project_ref: Text,
  share_class_name: Text,
  share_par_value: Money,
  base_currency: Currency,
  status: PortfolioStatus,
  allocation_policy: z.strictObject({ description: Text }),
});
export type Portfolio = z.infer<typeof Portfolio>;

export const PortfolioTerms = z
  .strictObject({
    portfolio_id: Id,
    version: z.number().int().positive(),
    min_subscription: Money,
    subscription_price: Money,
    mgmt_fee_rate: Rate,
    fee_basis: Text,
    fee_frequency: z.enum(['quarterly', 'semi_annually', 'annually']),
    perf_fee_rate: Rate,
    has_hurdle: z.boolean(),
    hurdle_rate: Rate.optional(),
    org_expense_cap: Money,
    term_years: z.number().int().positive(),
    extension_years: z.number().int().nonnegative(),
    costs_deducted_on_lapse: z.boolean(),
    lapse_cost_cap: Money.optional(),
  })
  .superRefine((t, ctx) => {
    requireWhen(ctx, t.has_hurdle, t.hurdle_rate, ['hurdle_rate'], 'when the performance fee has a hurdle');
    requireWhen(
      ctx,
      t.costs_deducted_on_lapse,
      t.lapse_cost_cap,
      ['lapse_cost_cap'],
      'when costs are deducted on lapse',
    );
  });
export type PortfolioTerms = z.infer<typeof PortfolioTerms>;

export const Offer = z
  .strictObject({
    id: Id,
    portfolio_id: Id,
    open_date: IsoDate,
    close_date: IsoDate,
    funding_deadline: IsoDate,
    target_size: Money,
    hard_cap: Money,
    minimum_close_amount: Money,
  })
  .superRefine((o, ctx) => {
    if (o.close_date < o.open_date)
      ctx.addIssue({ code: 'custom', path: ['close_date'], message: 'is before the open date' });
    if (o.funding_deadline < o.close_date) {
      ctx.addIssue({ code: 'custom', path: ['funding_deadline'], message: 'is before the close date' });
    }
  });
export type Offer = z.infer<typeof Offer>;

export const AcquisitionSource = z.enum(['issuer_primary', 'market_secondary', 'gp_sourced']);

export const Asset = z
  .strictObject({
    id: Id,
    portfolio_id: Id,
    issuer_name: Text,
    issuer_jurisdiction: Text,
    instrument: Text,
    acquisition_source: AcquisitionSource,
    quantity: ShareCount,
    price_per_share: Money,
    seller_name: Text,
    seller_affiliate_id: Id.optional(),
    round_name: Text.optional(),
    long_stop_date: IsoDate.optional(),
    gp_cost_basis_per_share: Money.optional(),
    gp_acquisition_date: IsoDate.optional(),
    gp_cost_evidence: z.strictObject({ evidence_ref: Text, description: Text }).optional(),
    sponsor_retains_shares: z.boolean().optional(),
    sponsor_retained_quantity: ShareCount.optional(),
    valuation: z
      .strictObject({
        valuer_name: Text,
        date: IsoDate,
        range_per_share: z.strictObject({ low: DecimalString, high: DecimalString, currency: Currency }),
      })
      .optional(),
    completion_window_days: z.number().int().positive().optional(),
    consent_status: z.enum(['not_required', 'requested', 'obtained', 'waived', 'lapsed']),
    transfer_restrictions: Text,
    placement: z
      .strictObject({ has_fee: z.boolean(), agent_name: Text.optional(), fee_description: Text.optional() })
      .optional(),
  })
  .superRefine((a, ctx) => {
    // Addendum §5.1: a sponsor-supplied asset carries its cost basis and acquisition date, evidence-linked.
    const gp = a.acquisition_source === 'gp_sourced';
    const why = 'when the asset is supplied by the sponsor (addendum §5.1)';
    requireWhen(ctx, gp, a.gp_cost_basis_per_share, ['gp_cost_basis_per_share'], why);
    requireWhen(ctx, gp, a.gp_acquisition_date, ['gp_acquisition_date'], why);
    requireWhen(ctx, gp, a.gp_cost_evidence, ['gp_cost_evidence'], why);
    requireWhen(ctx, gp, a.seller_affiliate_id, ['seller_affiliate_id'], why);
    if (!gp && a.gp_cost_basis_per_share) {
      ctx.addIssue({
        code: 'custom',
        path: ['gp_cost_basis_per_share'],
        message: 'is only for assets supplied by the sponsor',
      });
    }
    requireWhen(
      ctx,
      a.sponsor_retains_shares === true,
      a.sponsor_retained_quantity,
      ['sponsor_retained_quantity'],
      'when the sponsor keeps some shares',
    );
    if (a.placement) {
      const why = 'when a placement fee is paid';
      requireWhen(ctx, a.placement.has_fee, a.placement.agent_name, ['placement', 'agent_name'], why);
      requireWhen(ctx, a.placement.has_fee, a.placement.fee_description, ['placement', 'fee_description'], why);
    }
    if (a.gp_cost_basis_per_share && a.gp_cost_basis_per_share.currency !== a.price_per_share.currency) {
      ctx.addIssue({
        code: 'custom',
        path: ['gp_cost_basis_per_share', 'currency'],
        message: 'differs from the price currency',
      });
    }
  });
export type Asset = z.infer<typeof Asset>;

export const SubscriptionAccount = z.strictObject({
  account_name: Text,
  bank_name: Text,
  account_number: Text,
  swift: Text,
  verified_by: Text,
});
export type SubscriptionAccount = z.infer<typeof SubscriptionAccount>;

// ---------- investors (identity stub, build plan B1) ----------

const Person = z.strictObject({ name: Text, title: Text });
const Controller = z.strictObject({ name: Text, role: Text, ownership_description: Text });
const Kyc = z.strictObject({ completed_date: IsoDate });

export const IndividualParty = z.strictObject({
  id: Id,
  type: z.literal('individual'),
  full_name: Text,
  date_of_birth: IsoDate,
  nationality: Text,
  residential_address: Text,
  tax_residence: Text,
  tax_id: Text,
  email: z.email(),
  kyc: Kyc,
});

export const EntityParty = z
  .strictObject({
    id: Id,
    type: z.literal('entity'),
    legal_name: Text,
    entity_type: z.enum(['company', 'limited_partnership', 'trust', 'foundation', 'other']),
    jurisdiction: Text,
    registration_number: Text,
    registered_address: Text,
    tax_residence: Text,
    tax_id: Text,
    email: z.email(),
    notice_contact: Text,
    is_trustee: z.boolean(),
    trust_name: Text.optional(),
    authorised_signatories: z.array(Person).min(1, 'needs at least one authorised signatory'),
    controllers: z.array(Controller),
    kyc: Kyc,
  })
  .superRefine((p, ctx) => {
    requireWhen(ctx, p.is_trustee, p.trust_name, ['trust_name'], 'when the investor is a trustee');
  });

export const Party = z.discriminatedUnion('type', [IndividualParty, EntityParty]);
export type Party = z.infer<typeof Party>;

export const SubscriptionRequest = z.strictObject({
  id: Id,
  offer_id: Id,
  party_id: Id,
  requested_amount: Money,
  eligibility: z.strictObject({
    // The investor's own confirmation; the platform does not determine eligibility.
    status: z.enum(['professional', 'exempted', 'other_basis']),
    formed_for_investment: z.boolean().optional(),
  }),
  payment_reference: Text,
  allocation: z
    .strictObject({
      allocated: Money,
      // Typed in until the allocation engine exists (build plan B4, field catalogue gap G10).
      entered_by: z.literal('sponsor'),
      note: z.string().optional(),
    })
    .optional(),
});
export type SubscriptionRequest = z.infer<typeof SubscriptionRequest>;

/** One portfolio's records as held together (the fixture layout). */
export const PortfolioRecords = z
  .strictObject({
    portfolio: Portfolio,
    terms: PortfolioTerms,
    offer: Offer,
    asset: Asset,
    subscription_account: SubscriptionAccount,
  })
  .superRefine((r, ctx) => {
    for (const key of ['terms', 'offer', 'asset'] as const) {
      if (r[key].portfolio_id !== r.portfolio.id) {
        ctx.addIssue({ code: 'custom', path: [key, 'portfolio_id'], message: `is not ${r.portfolio.id}` });
      }
    }
  });
export type PortfolioRecords = z.infer<typeof PortfolioRecords>;
