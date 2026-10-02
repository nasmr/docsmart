/**
 * Rates are kept as decimal fractions ("0.015") and entered as percentages ("1.5"). The conversion
 * moves the decimal point in the string, so it is exact: no floating point.
 */
const PLAIN = /^\d+(\.\d+)?$/;

function shift(value: string, places: number): string {
  const [whole = '', fraction = ''] = value.split('.');
  const digits = whole + fraction;
  const point = whole.length + places;
  const padded = point <= 0 ? '0'.repeat(1 - point) + digits : digits.padEnd(point, '0');
  const at = Math.max(point, 1);
  const int = padded.slice(0, at).replace(/^0+(?=\d)/, '');
  const frac = padded.slice(at).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

/** "1.5" → "0.015". Undefined when the text is not a plain non-negative number. */
export function percentToFraction(percent: string): string | undefined {
  const t = percent.trim();
  return PLAIN.test(t) ? shift(t, -2) : undefined;
}

/** "0.015" → "1.5". Undefined when the value is not a plain non-negative number. */
export function fractionToPercent(fraction: string): string | undefined {
  return PLAIN.test(fraction) ? shift(fraction, 2) : undefined;
}
