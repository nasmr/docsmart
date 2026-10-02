/**
 * The only expressions a template may contain (decision 0008, "templates are data"):
 *
 *   field.path              true when the boolean field is true
 *   field.path = value      true when the enum field has that value
 *   any alias.field[ = v]   true when the test holds for any item of the list the alias names
 *
 * ELSE gives the negative. There are no operators, no "and" or "or", no quotes and no calls.
 */

export interface Condition {
  any: boolean;
  /** Dotted field path, e.g. "asset.acquisition_source" or "director.is_interested". */
  path: string;
  /** Present for an enum test. */
  value?: string;
}

const PATH = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const VALUE = /^[a-z][a-z0-9_]*$/;

/** Parses a condition, or returns why it is not in the allowed form. */
export function parseCondition(text: string): Condition | { error: string } {
  const m = text.match(/^(any )?(\S+?)(?: = (\S+))?$/);
  if (!m) return { error: `“${text}” is not “field”, “field = value” or “any alias.field”` };
  const [, any, path, value] = m as unknown as [string, string | undefined, string, string | undefined];
  if (!PATH.test(path)) return { error: `“${path}” is not a dotted field path` };
  if (value !== undefined && !VALUE.test(value)) return { error: `“${value}” is not an enum value` };
  return { any: any !== undefined, path, ...(value !== undefined ? { value } : {}) };
}

export function isConditionError(c: Condition | { error: string }): c is { error: string } {
  return 'error' in c;
}

/**
 * Evaluates a condition against flat facts (used for selection rules). `any` needs list facts, which
 * flat facts do not have, so it is refused here; assembly evaluates it with the records.
 */
export function evaluateFlat(text: string, facts: Readonly<Record<string, unknown>>): boolean {
  const c = parseCondition(text);
  if (isConditionError(c)) throw new Error(c.error);
  if (c.any) throw new Error(`“${text}” tests a list, which selection rules cannot do`);
  if (!(c.path in facts)) throw new Error(`No fact for ${c.path}`);
  const v = facts[c.path];
  if (c.value !== undefined) {
    if (typeof v !== 'string') throw new Error(`${c.path} is not an enum value`);
    return v === c.value;
  }
  if (typeof v !== 'boolean') throw new Error(`${c.path} is not true or false`);
  return v;
}
