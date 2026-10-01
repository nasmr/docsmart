import { markup, sharesToIssue, totalConsideration } from './calculations.js';

/**
 * Which calculation produces each calculated field in templates/fields/catalogue.json, and which
 * catalogue fields feed it. Assembly uses this to fill calculated slots.
 *
 * subscription.allocated_amount is calculated in the data model but typed in during this slice
 * (field catalogue gap G10, build plan B4), so it has no entry until the allocation engine exists.
 */
export const calculatedFields = {
  'asset.total_consideration': {
    calculate: totalConsideration,
    inputs: { quantity: 'asset.max_quantity', price_per_share: 'asset.price_per_share' },
  },
  'asset.markup_pct': {
    calculate: markup,
    inputs: { price_per_share: 'asset.price_per_share', cost_per_share: 'asset.sponsor_cost_per_share' },
  },
  'subscription.shares': {
    calculate: sharesToIssue,
    inputs: { allocated_amount: 'subscription.allocated_amount', subscription_price: 'portfolio.subscription_price' },
  },
} as const;

export type CalculatedField = keyof typeof calculatedFields;

/** Fields the catalogue marks as calculated that deliberately have no calculation yet. */
export const notYetCalculated = {
  'subscription.allocated_amount': 'Typed in until the allocation engine (DF-65) exists; field catalogue gap G10.',
} as const;
