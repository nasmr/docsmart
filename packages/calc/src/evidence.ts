/**
 * How a calculated value was produced. Stored with the value, so the value can be traced and
 * re-derived (DF-51). Contains no timestamp: the same inputs always give the same record.
 */
export interface Evidence<I, O> {
  computed_by: '@docsmart/calc';
  /** Name of the calculation. */
  function: string;
  /** Bumped whenever the calculation's logic or rounding changes. */
  version: number;
  /** A copy of the inputs exactly as given. */
  inputs: I;
  output: O;
  /** Present when the result was rounded. */
  rounding?: { decimal_places: number; mode: 'half_away_from_zero' | 'down' };
}

export interface Calculated<I, O> {
  value: O;
  evidence: Evidence<I, O>;
}

export function calculated<I, O>(
  fn: string,
  version: number,
  inputs: I,
  value: O,
  rounding?: Evidence<I, O>['rounding'],
): Calculated<I, O> {
  const evidence: Evidence<I, O> = {
    computed_by: '@docsmart/calc',
    function: fn,
    version,
    inputs: structuredClone(inputs),
    output: structuredClone(value),
    ...(rounding ? { rounding } : {}),
  };
  return { value, evidence };
}
