/**
 * Import rules (decision 0008, build plan B3). A template is data, never code: an import fails,
 * naming the place, unless every rule holds.
 */
import { z } from 'zod';
import { isConditionError, parseCondition } from './conditions.js';
import type { Block, Inline, TableRow, TemplateTree } from './format.js';

/** The parts of templates/fields/catalogue.json the rules use. */
export const CatalogueSchema = z.object({
  fields: z.record(z.string(), z.object({ type: z.string(), values: z.array(z.string()).optional() })),
  lists: z.record(z.string(), z.object({ item: z.string() })),
  zones: z.record(z.string(), z.object({})),
});
export type Catalogue = z.infer<typeof CatalogueSchema>;

export type RuleId =
  | 'condition_form' // a condition or filter is not in the closed form
  | 'unknown_field' // a field path is not in the catalogue
  | 'condition_type' // a test does not fit the field's type, or uses a value the catalogue does not list
  | 'unknown_list' // a loop is over a list the catalogue does not have
  | 'loop_alias' // a loop's variable is not the catalogue's item name for that list
  | 'unbound_variable' // a loop variable is used outside the loop that binds it
  | 'unknown_zone' // an AI zone the catalogue does not have
  | 'locked_wording'; // the locked text is not exactly the generated designation (INV-9)

export interface RuleProblem {
  rule: RuleId;
  /** Id of the nearest block, or "template" when there is none. */
  at: string;
  message: string;
}

/**
 * The template form of the contracting-party wording (DF-62, decision 0003): the two legal names
 * joined by the fixed words. Assembly fills the fields from the records.
 */
export const DESIGNATION: readonly Inline[] = [
  { t: 'slot', name: 'umbrella.legal_name' },
  { t: 'text', v: ' for and on behalf of ' },
  { t: 'slot', name: 'portfolio.legal_name' },
];

export function checkImportRules(tree: TemplateTree, catalogue: Catalogue): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const items = new Map<string, string[]>(); // item alias -> lists that use it
  for (const [list, l] of Object.entries(catalogue.lists)) items.set(l.item, [...(items.get(l.item) ?? []), list]);

  const report = (rule: RuleId, at: string, message: string) => problems.push({ rule, at, message });

  function checkPath(path: string, bound: ReadonlySet<string>, at: string, what: string) {
    const alias = path.split('.')[0] as string;
    if (items.has(alias) && !bound.has(alias)) {
      report('unbound_variable', at, `${what} ${path} uses “${alias}” outside a loop that binds it`);
    }
    if (!catalogue.fields[path]) report('unknown_field', at, `${what} ${path} is not in the field catalogue`);
  }

  function checkCondition(text: string, bound: ReadonlySet<string>, at: string) {
    const c = parseCondition(text);
    if (isConditionError(c)) return report('condition_form', at, c.error);
    const alias = c.path.split('.')[0] as string;
    if (c.any) {
      const lists = items.get(alias) ?? [];
      if (lists.length !== 1) {
        return report(
          'condition_form',
          at,
          lists.length
            ? `“any ${alias}” could mean ${lists.join(' or ')}; use FOR EACH … WHERE instead`
            : `“any” needs a list item, and “${alias}” is not one`,
        );
      }
      // The test ranges over that list, so the alias is bound for the path itself.
      checkPath(c.path, new Set([...bound, alias]), at, 'Condition');
    } else checkPath(c.path, bound, at, 'Condition');
    const field = catalogue.fields[c.path];
    if (!field) return;
    if (c.value === undefined && field.type !== 'boolean') {
      report('condition_type', at, `${c.path} is ${field.type}, so it needs “= value”`);
    }
    if (c.value !== undefined) {
      if (field.type !== 'enum') report('condition_type', at, `${c.path} is ${field.type}, not an enum`);
      else if (!field.values?.includes(c.value)) report('condition_type', at, `${c.value} is not a value of ${c.path}`);
    }
  }

  function checkLoop(alias: string, list: string, where: string | undefined, bound: ReadonlySet<string>, at: string) {
    const l = catalogue.lists[list];
    if (!l) report('unknown_list', at, `List ${list} is not in the field catalogue`);
    else if (l.item !== alias)
      report('loop_alias', at, `A loop over ${list} must name its item “${l.item}”, not “${alias}”`);
    const inner = new Set([...bound, alias]);
    if (where !== undefined) checkCondition(where, inner, at);
    return inner;
  }

  function inlines(xs: readonly Inline[], bound: ReadonlySet<string>, at: string) {
    for (const x of xs) {
      if (x.t === 'slot') checkPath(x.name, bound, at, 'Field');
      else if (x.t === 'if') {
        checkCondition(x.cond, bound, at);
        inlines(x.then, bound, at);
        if (x.else) inlines(x.else, bound, at);
      } else if (x.t === 'each') inlines(x.body, checkLoop(x.alias, x.list, x.where, bound, at), at);
    }
  }

  function rows(rs: readonly TableRow[], bound: ReadonlySet<string>, at: string) {
    for (const r of rs) {
      const inner = r.t === 'each_row' ? checkLoop(r.alias, r.list, r.where, bound, at) : bound;
      for (const c of r.cells) inlines(c, inner, at);
    }
  }

  function blocks(bs: readonly Block[], bound: ReadonlySet<string>, near: string) {
    for (const b of bs) {
      switch (b.t) {
        case 'if':
          checkCondition(b.cond, bound, firstId(b.then) ?? near);
          blocks(b.then, bound, near);
          if (b.else) blocks(b.else, bound, near);
          break;
        case 'each':
          blocks(b.body, checkLoop(b.alias, b.list, b.where, bound, firstId(b.body) ?? near), near);
          break;
        case 'table':
          rows(b.rows, bound, b.id);
          break;
        case 'zone':
          if (!catalogue.zones[b.zone]) report('unknown_zone', b.id, `AI zone ${b.zone} is not in the field catalogue`);
          inlines(b.instructions, bound, b.id);
          break;
        case 'locked':
          if (JSON.stringify(b.text) !== JSON.stringify(DESIGNATION)) {
            report(
              'locked_wording',
              b.id,
              'The locked wording must be exactly “{{umbrella.legal_name}} for and on behalf of {{portfolio.legal_name}}”',
            );
          }
          inlines(b.text, bound, b.id);
          break;
        default:
          inlines(b.text, bound, b.id);
      }
    }
  }

  blocks(tree.body, new Set(), 'template');
  return problems;
}

function firstId(bs: readonly Block[]): string | undefined {
  for (const b of bs) {
    if ('id' in b) return b.id;
    const inner = b.t === 'if' ? (firstId(b.then) ?? (b.else ? firstId(b.else) : undefined)) : firstId(b.body);
    if (inner) return inner;
  }
  return undefined;
}
