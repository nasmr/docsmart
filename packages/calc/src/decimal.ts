import { Decimal as DecimalJs } from 'decimal.js';
import { CalcError } from './errors.js';

/**
 * A private Decimal configuration, so nothing else that changes decimal.js's global settings can
 * affect a result. Fifty significant digits is far more than any amount, price or count needs.
 */
export const Decimal = DecimalJs.clone({
  precision: 50,
  rounding: DecimalJs.ROUND_HALF_UP,
  toExpNeg: -50,
  toExpPos: 50,
});
export type Decimal = InstanceType<typeof Decimal>;

/** Plain decimal notation only: no exponent, no leading or trailing point, no sign other than '-'. */
const DECIMAL = /^-?\d+(\.\d+)?$/;
const CURRENCY = /^[A-Z]{3}$/;

export interface Money {
  amount: string;
  currency: string;
}

export function parseDecimal(input: string, value: unknown): Decimal {
  if (typeof value !== 'string') throw new CalcError('invalid_input', input, 'must be a decimal string');
  if (!DECIMAL.test(value)) throw new CalcError('invalid_input', input, `“${value}” is not a plain decimal number`);
  return new Decimal(value);
}

/** Number of digits after the decimal point, as written. */
export function scaleOf(value: string): number {
  const point = value.indexOf('.');
  return point === -1 ? 0 : value.length - point - 1;
}

export function parseMoney(input: string, value: unknown, opts: { positive?: boolean } = {}): Decimal {
  if (typeof value !== 'object' || value === null) {
    throw new CalcError('invalid_input', input, 'must be { amount, currency }');
  }
  const { amount, currency } = value as Partial<Money>;
  if (typeof currency !== 'string' || !CURRENCY.test(currency)) {
    throw new CalcError('invalid_input', `${input}.currency`, 'must be a three-letter ISO 4217 code');
  }
  const d = parseDecimal(`${input}.amount`, amount);
  if (d.isNegative()) throw new CalcError('out_of_range', `${input}.amount`, 'must not be negative');
  if (opts.positive && d.isZero()) {
    throw new CalcError('division_by_zero', `${input}.amount`, 'must be greater than zero');
  }
  return d;
}

export function parseShareCount(input: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new CalcError('invalid_input', input, 'must be a whole number of shares');
  }
  if (value <= 0) throw new CalcError('out_of_range', input, 'must be greater than zero');
  return value;
}

export function sameCurrency(a: { input: string; money: Money }, b: { input: string; money: Money }): void {
  if (a.money.currency !== b.money.currency) {
    throw new CalcError(
      'currency_mismatch',
      b.input,
      `is in ${b.money.currency} but ${a.input} is in ${a.money.currency}; amounts in different currencies are never combined`,
    );
  }
}
