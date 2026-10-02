/**
 * Field values for assembly, looked up from the records by the field catalogue's `source` paths.
 * Simple sources ("Umbrella.legal_name", "Asset.valuation.date") are read generically; the rest
 * (joins, selections, derived, calculated and other documents' values) are listed in SPECIAL.
 */
import { calculatedFields } from '@docsmart/calc';
import type { Party, PortfolioRecords, Sponsor, SubscriptionRequest, Umbrella } from '@docsmart/domain';
import { z } from 'zod';
import type { ValueType } from './format.js';

/** The catalogue, as assembly needs it (templates/fields/catalogue.json). */
export const FieldCatalogueSchema = z.object({
  fields: z.record(
    z.string(),
    z.object({
      type: z.string(),
      source: z.string(),
      origin: z.enum(['record', 'document', 'calculated', 'derived', 'platform', 'external', 'execution']),
      values: z.array(z.string()).optional(),
      labels: z.record(z.string(), z.string()).optional(),
    }),
  ),
  lists: z.record(z.string(), z.object({ item: z.string(), source: z.string() })),
  zones: z.record(z.string(), z.object({})),
});
export type FieldCatalogue = z.infer<typeof FieldCatalogueSchema>;
export type FieldSpec = FieldCatalogue['fields'][string];

/** Facts about other documents this one refers to. */
export interface References {
  U3?: { version_label: string; content_hash: string };
  D13?: { supplement_number: number; date: string; content_hash: string };
  D15?: { date: string };
  /** The investor's earlier subscription agreement, for D1SP-C. */
  earlier_agreement?: { portfolio_legal_name: string; executed_date: string; ref: string };
}

export interface AssemblyRecords {
  umbrella: Umbrella;
  sponsor: Sponsor;
  portfolio?: PortfolioRecords;
  party?: Party;
  subscription?: SubscriptionRequest;
}

export interface AssemblyContext {
  catalogue: FieldCatalogue;
  document: { id: string; class: string; inputs: Readonly<Record<string, unknown>> };
  records: AssemblyRecords;
  references: References;
}

/** What a lookup found. `calculated` carries the calculation service's evidence. */
export type Lookup =
  | { kind: 'value'; value: unknown; evidence?: unknown }
  | { kind: 'missing'; reason: string }
  | { kind: 'execution' };

type Item = Readonly<Record<string, unknown>>;
type Special = (ctx: AssemblyContext, item: Item | undefined) => Lookup;

const missing = (reason: string): Lookup => ({ kind: 'missing', reason });
const found = (value: unknown): Lookup =>
  value === undefined || value === null ? missing('no value') : { kind: 'value', value };

function get(root: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), root);
}

function roots(ctx: AssemblyContext): Record<string, unknown> {
  const { umbrella, sponsor, portfolio, party, subscription } = ctx.records;
  return {
    Umbrella: umbrella,
    Sponsor: sponsor,
    Portfolio: portfolio?.portfolio,
    PortfolioTerms: portfolio?.terms,
    Offer: portfolio?.offer,
    Asset: portfolio?.asset,
    SubscriptionAccount: portfolio?.subscription_account,
    Party: party,
    SubscriptionRequest: subscription,
  };
}

// Interests are entered per document. With the list entered, a director without an entry has
// declared none; with no list at all, the answer is missing, never assumed.
const interests = (ctx: AssemblyContext) =>
  ctx.document.inputs.director_interests as Array<Record<string, unknown>> | undefined;
const interestOf = (ctx: AssemblyContext, item: Item | undefined) =>
  interests(ctx)?.find((i) => i.director_id === item?.id);
const NO_INTERESTS = missing('no declarations of interest entered for this document');

/** A calculation from @docsmart/calc, with its inputs taken from other catalogue fields. */
function calculation(field: keyof typeof calculatedFields): Special {
  return (ctx, item) => {
    const spec = calculatedFields[field];
    const inputs: Record<string, unknown> = {};
    for (const [param, source] of Object.entries(spec.inputs)) {
      const v = lookup(source, ctx, item);
      if (v.kind !== 'value') return missing(`needs ${source}`);
      inputs[param] = v.value;
    }
    try {
      // The inputs were gathered by name from the registry, so the shapes match; calc validates them anyway.
      const calculate = spec.calculate as unknown as (i: Record<string, unknown>) => {
        value: unknown;
        evidence: unknown;
      };
      const r = calculate(inputs);
      return { kind: 'value', value: r.value, evidence: r.evidence };
    } catch (e) {
      return missing(`could not be calculated: ${(e as Error).message}`);
    }
  };
}

/** The document's own D13 values when assembling a D13; otherwise the referenced supplement's. */
const supplement =
  (key: 'supplement_number' | 'date'): Special =>
  (ctx) =>
    found(ctx.document.class === 'D13' ? ctx.document.inputs[key] : ctx.references.D13?.[key]);

export const SPECIAL: Record<string, Special> = {
  // Joins: a director's interest in this transaction is entered on the document (catalogue note).
  'director.is_interested': (ctx, item) =>
    interests(ctx) ? { kind: 'value', value: interestOf(ctx, item)?.is_interested === true } : NO_INTERESTS,
  'director.abstains': (ctx, item) =>
    interests(ctx) ? { kind: 'value', value: interestOf(ctx, item)?.abstains === true } : NO_INTERESTS,
  'director.interest_description': (ctx, item) => found(interestOf(ctx, item)?.description),
  'resolution.interest_declared': (ctx) =>
    interests(ctx) ? { kind: 'value', value: interests(ctx)?.some((i) => i.is_interested === true) } : NO_INTERESTS,
  'meeting.chair_name': (ctx) => {
    const id = get(ctx.document.inputs, 'meeting.chair_director_id');
    return found(ctx.records.umbrella.directors.find((d) => d.id === id)?.name);
  },
  // Selections.
  'company_signatory.name': (ctx) => found(companySignatory(ctx)?.name),
  'company_signatory.title': (ctx) => found(companySignatory(ctx)?.title),
  'umbrella.cost_rule_ref': (ctx) => {
    // The rule in force: the one with the latest effective date (catalogue note).
    const rules = [...ctx.records.umbrella.cost_allocation_rules].sort((a, b) =>
      b.effective_from.localeCompare(a.effective_from),
    );
    if (rules.length > 1 && rules[0]?.effective_from === rules[1]?.effective_from)
      return missing('two cost-allocation rules take effect on the same date');
    return found(rules[0]?.ref);
  },
  // Derived.
  'investor.display_name': (ctx) => {
    const p = ctx.records.party;
    return found(p ? (p.type === 'individual' ? p.full_name : p.legal_name) : undefined);
  },
  'investor.identity_ref': (ctx) => found(ctx.records.party?.id),
  'resolution.effective_date_differs': (ctx) => {
    const { effective_date: e, resolution_date: r } = ctx.document.inputs as {
      effective_date?: string;
      resolution_date?: string;
    };
    return e && r ? { kind: 'value', value: e > r } : missing('needs resolution.date and resolution.effective_date');
  },
  // Typed in during this slice (field catalogue gap G10).
  'subscription.allocated_amount': (ctx) => found(ctx.records.subscription?.allocation?.allocated),
  // Calculated.
  'asset.total_consideration': calculation('asset.total_consideration'),
  'asset.markup_pct': calculation('asset.markup_pct'),
  'subscription.shares': calculation('subscription.shares'),
  // Other documents.
  'umbrella.subscription_terms_version': (ctx) => found(ctx.references.U3?.version_label),
  'umbrella.subscription_terms_hash': (ctx) => found(ctx.references.U3?.content_hash),
  'portfolio.supplement_number': supplement('supplement_number'),
  'supplement.date': supplement('date'),
  'portfolio.supplement_hash': (ctx) => found(ctx.references.D13?.content_hash),
  'conflict_disclosure.date': (ctx) => found(ctx.references.D15?.date),
  'investor.existing_portfolio_name': (ctx) => found(ctx.references.earlier_agreement?.portfolio_legal_name),
  'investor.prior_agreement_date': (ctx) => found(ctx.references.earlier_agreement?.executed_date),
  'investor.prior_agreement_ref': (ctx) => found(ctx.references.earlier_agreement?.ref),
};

function companySignatory(ctx: AssemblyContext) {
  const id = ctx.document.inputs.company_signatory_id;
  return ctx.records.umbrella.authorised_signatories.find((s) => s.id === id);
}

export type Route = 'execution' | 'special' | 'item' | 'inputs' | 'record';
const ROOTS = [
  'Umbrella',
  'Sponsor',
  'Portfolio',
  'PortfolioTerms',
  'Offer',
  'Asset',
  'SubscriptionAccount',
  'Party',
  'SubscriptionRequest',
];

/** How a field is looked up, or undefined when nothing can look it up. */
export function lookupRoute(field: string, spec: FieldSpec): Route | undefined {
  if (spec.origin === 'execution') return 'execution';
  if (SPECIAL[field]) return 'special';
  if (/^\w+(?:\.\w+)*\[\]\.[\w.]+$/.test(spec.source)) return 'item';
  if (/^DocumentInstance\.inputs\.[\w.]+$/.test(spec.source)) return 'inputs';
  const root = spec.source.match(/^(\w+)\.[\w.]+$/)?.[1];
  return root && ROOTS.includes(root) ? 'record' : undefined;
}

/** Looks up a field's value for this document, and for a loop item when inside a loop. */
export function lookup(field: string, ctx: AssemblyContext, item?: Item): Lookup {
  const spec = ctx.catalogue.fields[field];
  if (!spec) return missing(`${field} is not in the field catalogue`);
  switch (lookupRoute(field, spec)) {
    case 'execution':
      return { kind: 'execution' };
    case 'special':
      return (SPECIAL[field] as Special)(ctx, item);
    case 'item': {
      // A loop item's own field: "Umbrella.directors[].name" → item.name.
      const path = spec.source.slice(spec.source.indexOf('[].') + 3);
      return item ? found(get(item, path)) : missing(`${field} needs a loop item`);
    }
    case 'inputs':
      return found(get(ctx.document.inputs, spec.source.slice('DocumentInstance.inputs.'.length)));
    case 'record': {
      const [root, ...rest] = spec.source.split('.');
      const record = roots(ctx)[root as string];
      if (record === undefined) return missing(`no ${root} record for this document`);
      return found(get(record, rest.join('.')));
    }
    default:
      return missing(`no lookup for source ${spec.source}`);
  }
}

/** The items of a list, for FOR EACH. */
export function lookupList(list: string, ctx: AssemblyContext): Item[] | { missing: string } {
  const { umbrella, party } = ctx.records;
  switch (list) {
    case 'umbrella.directors':
      return umbrella.directors;
    case 'meeting.attendees': {
      const ids = get(ctx.document.inputs, 'meeting.attendee_director_ids');
      if (!Array.isArray(ids)) return { missing: 'no meeting attendees entered' };
      const directors = ids.map((id) => umbrella.directors.find((d) => d.id === id));
      return directors.every(Boolean) ? (directors as Item[]) : { missing: 'an attendee is not a director' };
    }
    case 'investor.authorised_signatories':
      return party?.type === 'entity'
        ? party.authorised_signatories
        : { missing: 'the investor has no authorised signatories' };
    case 'investor.controllers':
      return party?.type === 'entity' ? party.controllers : { missing: 'the investor has no controllers' };
    default:
      return { missing: `no lookup for list ${list}` };
  }
}

/** A stable key for a loop item: its id when it has one, otherwise its position. */
export function itemKey(item: Item, index: number): string {
  return typeof item.id === 'string' ? item.id : String(index + 1);
}

export type { Party, PortfolioRecords, Sponsor, SubscriptionRequest, Umbrella, ValueType };
