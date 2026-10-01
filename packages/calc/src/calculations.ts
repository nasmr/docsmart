import { Decimal, type Money, parseMoney, parseShareCount, sameCurrency, scaleOf } from './decimal.js';
import { type Calculated, calculated } from './evidence.js';

/** Decimal places kept for a markup rate (0.329787 is 32.9787%). Display rounds further. */
export const MARKUP_DECIMAL_PLACES = 6;

export interface TotalConsiderationInputs {
  quantity: number;
  price_per_share: Money;
}

/**
 * Maximum total price for the asset: quantity × price per share. Exact; the result keeps the
 * price's decimal places (12.50 × 400000 = 5000000.00).
 */
export function totalConsideration(inputs: TotalConsiderationInputs): Calculated<TotalConsiderationInputs, Money> {
  const quantity = parseShareCount('quantity', inputs.quantity);
  const price = parseMoney('price_per_share', inputs.price_per_share, { positive: true });
  const amount = price.times(quantity).toFixed(scaleOf(inputs.price_per_share.amount));
  return calculated('total_consideration', 1, inputs, { amount, currency: inputs.price_per_share.currency });
}

export interface MarkupInputs {
  price_per_share: Money;
  cost_per_share: Money;
}

/**
 * Transfer price over the seller's cost, as a fraction: (price − cost) ÷ cost, rounded half away
 * from zero to MARKUP_DECIMAL_PLACES. Negative when the price is below cost.
 */
export function markup(inputs: MarkupInputs): Calculated<MarkupInputs, string> {
  const price = parseMoney('price_per_share', inputs.price_per_share);
  const cost = parseMoney('cost_per_share', inputs.cost_per_share, { positive: true });
  sameCurrency(
    { input: 'price_per_share', money: inputs.price_per_share },
    { input: 'cost_per_share', money: inputs.cost_per_share },
  );
  const rate = price.minus(cost).dividedBy(cost).toFixed(MARKUP_DECIMAL_PLACES, Decimal.ROUND_HALF_UP);
  return calculated('markup', 1, inputs, normaliseZero(rate), {
    decimal_places: MARKUP_DECIMAL_PLACES,
    mode: 'half_away_from_zero',
  });
}

export interface SharesToIssueInputs {
  allocated_amount: Money;
  subscription_price: Money;
}

/**
 * Whole shares to issue for an allocated amount: allocated ÷ price, rounded down, because
 * fractions of a share are not issued (D13 §6.3).
 */
export function sharesToIssue(inputs: SharesToIssueInputs): Calculated<SharesToIssueInputs, number> {
  const amount = parseMoney('allocated_amount', inputs.allocated_amount);
  const price = parseMoney('subscription_price', inputs.subscription_price, { positive: true });
  sameCurrency(
    { input: 'subscription_price', money: inputs.subscription_price },
    { input: 'allocated_amount', money: inputs.allocated_amount },
  );
  const shares = amount.dividedToIntegerBy(price).toNumber();
  return calculated('shares_to_issue', 1, inputs, shares, { decimal_places: 0, mode: 'down' });
}

// toFixed can give "-0.000000" for a tiny negative that rounds to zero.
function normaliseZero(s: string): string {
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}
