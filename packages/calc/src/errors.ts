export type CalcErrorCode = 'invalid_input' | 'currency_mismatch' | 'division_by_zero' | 'out_of_range';

/** A calculation refused its inputs. `input` names the offending input. */
export class CalcError extends Error {
  readonly code: CalcErrorCode;
  readonly input: string;

  constructor(code: CalcErrorCode, input: string, message: string) {
    super(`${input}: ${message}`);
    this.name = 'CalcError';
    this.code = code;
    this.input = input;
  }
}
