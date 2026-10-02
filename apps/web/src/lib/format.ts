/**
 * How a value will print in documents, using the house formatting itself (decision 0011,
 * @docsmart/assembly/format), so the preview on a form is exactly what assembly produces.
 */
import { formatCount, formatDate, formatEnteredRate, formatMoney } from '@docsmart/assembly/format';

const safe =
  <T>(f: (v: T) => string) =>
  (v: T): string | undefined => {
    try {
      return f(v);
    } catch {
      return undefined;
    }
  };

export const printDate = safe(formatDate);
export const printMoney = safe(formatMoney);
export const printRate = safe(formatEnteredRate);
export const printCount = safe(formatCount);
