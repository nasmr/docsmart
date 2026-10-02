/**
 * House formatting (decision 0011). One fixed format, independent of the machine's locale, so the
 * same records always print the same text and give the same hash.
 */
import { Decimal } from 'decimal.js';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Minor-unit digits for currencies that do not use two. ISO 4217. */
const MINOR_UNITS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  ISK: 0,
  CLP: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
  LYD: 3,
  IQD: 3,
};

export class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormatError';
  }
}

/** "1 October 2026" from "2026-10-01". */
export function formatDate(iso: unknown): string {
  const m = typeof iso === 'string' ? iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) throw new FormatError(`“${String(iso)}” is not a date (YYYY-MM-DD)`);
  const [, y, mo, d] = m as unknown as [string, string, string, string];
  const month = MONTHS[Number(mo) - 1];
  const day = Number(d);
  if (!month || day < 1 || day > 31) throw new FormatError(`“${iso}” is not a real date`);
  return `${day} ${month} ${y}`;
}

/** "15:00 (UTC+04:00)" from "15:00+04:00"; "Z" is UTC+00:00. */
export function formatTime(iso: unknown): string {
  const m = typeof iso === 'string' ? iso.match(/^([01]\d|2[0-3]):([0-5]\d)(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/) : null;
  if (!m) throw new FormatError(`“${String(iso)}” is not a time with a UTC offset (HH:MM±HH:MM)`);
  const offset = m[3] === 'Z' ? '+00:00' : (m[3] as string);
  return `${m[1]}:${m[2]} (UTC${offset})`;
}

/** Commas for thousands on the whole-number part of a plain decimal string. */
function group(decimal: string): string {
  const [whole = '', fraction] = decimal.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction !== undefined ? `${grouped}.${fraction}` : grouped;
}

const PLAIN = /^\d+(\.\d+)?$/;

/**
 * "USD 3,000,000.00". At least the currency's minor unit, more only when the amount holds more
 * (trailing zeros beyond the minor unit dropped). Never rounded.
 */
export function formatMoney(money: unknown): string {
  const { amount, currency } = (money ?? {}) as { amount?: unknown; currency?: unknown };
  if (typeof amount !== 'string' || !PLAIN.test(amount))
    throw new FormatError(`“${String(amount)}” is not a money amount`);
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency))
    throw new FormatError(`“${String(currency)}” is not a currency code`);
  return `${currency} ${group(fixMinor(amount, MINOR_UNITS[currency] ?? 2))}`;
}

function fixMinor(amount: string, minor: number): string {
  const [whole = '0', fraction = ''] = amount.split('.');
  let f = fraction.replace(/0+$/, '');
  if (f.length < minor) f = f.padEnd(minor, '0');
  return f ? `${whole.replace(/^0+(?=\d)/, '')}.${f}` : whole.replace(/^0+(?=\d)/, '');
}

/** "USD 11.80 to USD 13.10". */
export function formatMoneyRange(range: unknown): string {
  const { low, high, currency } = (range ?? {}) as { low?: unknown; high?: unknown; currency?: unknown };
  return `${formatMoney({ amount: low, currency })} to ${formatMoney({ amount: high, currency })}`;
}

/** A rate from the records ("0.015") as a percentage exactly as stored: "1.5%". */
export function formatEnteredRate(rate: unknown): string {
  if (typeof rate !== 'string' || !PLAIN.test(rate)) throw new FormatError(`“${String(rate)}” is not a rate`);
  return `${trimZeros(new Decimal(rate).times(100).toFixed())}%`;
}

/** A rate from the calculation service ("0.329787") to two places: "32.98%". Negative stays negative. */
export function formatCalculatedRate(rate: unknown): string {
  if (typeof rate !== 'string' || !/^-?\d+(\.\d+)?$/.test(rate))
    throw new FormatError(`“${String(rate)}” is not a rate`);
  const pct = new Decimal(rate).times(100).toFixed(2, Decimal.ROUND_HALF_UP);
  return `${pct === '-0.00' ? '0.00' : pct}%`;
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** "400,000". */
export function formatCount(n: unknown): string {
  if (typeof n !== 'number' || !Number.isSafeInteger(n)) throw new FormatError(`“${String(n)}” is not a whole number`);
  return n < 0 ? `-${group(String(-n))}` : group(String(n));
}

/** The catalogue label, or the value with underscores as spaces. */
export function formatEnum(value: unknown, labels: Readonly<Record<string, string>> = {}): string {
  if (typeof value !== 'string' || !value) throw new FormatError(`“${String(value)}” is not an enum value`);
  return labels[value] ?? value.replace(/_/g, ' ');
}

export type ValueType =
  | 'text'
  | 'long_text'
  | 'identifier'
  | 'date'
  | 'time'
  | 'money'
  | 'money_range'
  | 'rate'
  | 'integer'
  | 'share_count'
  | 'currency'
  | 'country'
  | 'jurisdiction'
  | 'address'
  | 'email'
  | 'boolean'
  | 'enum'
  | 'hash';

/** Formats a value of a catalogue type. `calculated` selects the calculated-rate rule. */
export function formatValue(
  type: ValueType,
  value: unknown,
  opts: { labels?: Readonly<Record<string, string>>; calculated?: boolean } = {},
): string {
  switch (type) {
    case 'date':
      return formatDate(value);
    case 'time':
      return formatTime(value);
    case 'money':
      return formatMoney(value);
    case 'money_range':
      return formatMoneyRange(value);
    case 'rate':
      return opts.calculated ? formatCalculatedRate(value) : formatEnteredRate(value);
    case 'integer':
    case 'share_count':
      return formatCount(value);
    case 'enum':
      return formatEnum(value, opts.labels);
    case 'boolean':
      throw new FormatError('booleans are never printed; they only drive conditions');
    default:
      if (typeof value !== 'string' || value.trim() === '') throw new FormatError('is empty');
      return value;
  }
}
