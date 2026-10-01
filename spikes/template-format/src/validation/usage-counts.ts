// Recounts the README's figures ("41 uses, 24 fields" inside conditions; "11" enum
// conditions) from the generator's own usage records, not by hand.
// Run: node src/validation/usage-counts.ts
import { createRequire } from 'node:module';
import path from 'node:path';
import { save } from './harness.ts';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../../../..');
const gen = path.join(root, 'templates/generator');
const { scan, usage } = require(path.join(gen, 'lib.js'));
const templates = [...require(path.join(gen, 'resolutions.js')), ...require(path.join(gen, 'supplements.js')), ...require(path.join(gen, 'subscriptions.js'))];

type U = { template: string; kind: string; name: string; context: string[] };
const all: U[] = [];
for (const t of templates) {
  usage.length = 0;
  scan(t.meta, t.body);
  all.push(...usage.map((u: U) => ({ ...u, context: [...u.context] })));
}

const isCond = (c: string) => !c.startsWith('EACH ');
const fields = all.filter((u) => u.kind === 'field');
const inIf = fields.filter((u) => u.context.some(isCond));
const inIfOrWhere = fields.filter((u) => u.context.some((c) => isCond(c) || / WHERE /.test(c)));
const inLoop = fields.filter((u) => u.context.some((c) => c.startsWith('EACH ')));
const conds = all.filter((u) => u.kind === 'condition');
const enumConds = conds.filter((u) => /=/.test(u.name));
const aggregate = conds.filter((u) => /^any\s/.test(u.name));
const distinct = (xs: U[]) => [...new Set(xs.map((u) => u.name))];
const byTemplate = (xs: U[]) => Object.fromEntries(templates.map((t: any) => [t.meta.id, xs.filter((u) => u.template === t.meta.id).length]));
const countBy = (xs: U[]) => Object.entries(xs.reduce((m: Record<string, number>, u) => ((m[u.name] = (m[u.name] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);

const out = {
  templates: templates.length,
  records: all.length,
  field_uses: fields.length,
  distinct_fields: distinct(fields).length,
  fields_inside_an_IF: { uses: inIf.length, distinct: distinct(inIf).length, by_template: byTemplate(inIf) },
  fields_inside_an_IF_or_a_WHERE_loop: { uses: inIfOrWhere.length, distinct: distinct(inIfOrWhere).length },
  fields_inside_a_loop: { uses: inLoop.length, distinct: distinct(inLoop).length },
  conditions: { uses: conds.length, distinct: distinct(conds).length, list: countBy(conds) },
  enum_conditions: { uses: enumConds.length, distinct: distinct(enumConds).length, by_template: byTemplate(enumConds), list: countBy(enumConds) },
  aggregate_conditions: countBy(aggregate),
  nested_conditions: conds.filter((u) => u.context.some(isCond)).map((u) => `${u.template}: ${u.name} (inside ${u.context.join(' > ')})`),
  conditions_inside_a_loop: conds.filter((u) => u.context.some((c) => c.startsWith('EACH ')) && !u.context.every((c) => c.startsWith('EACH '))).length,
  distinct_lists: countBy(all.filter((u) => u.kind === 'list')).length,
  loops: all.filter((u) => u.kind === 'list').map((u) => `${u.template}: ${u.name}${u.context.length ? ' (inside ' + u.context.join(' > ') + ')' : ''}`),
  where_clauses: conds.filter((u) => u.context.some((c) => c.startsWith('EACH '))).map((u) => `${u.template}: WHERE ${u.name}`),
  zones: all.filter((u) => u.kind === 'zone').map((u) => `${u.template}: ${u.name}`),
  locked: all.filter((u) => u.kind === 'locked').map((u) => `${u.template}: ${u.name}`),
  errors: all.filter((u) => u.kind === 'error'),
  fields_inside_an_IF_list: countBy(inIf),
};
console.log(JSON.stringify(out, null, 2));
save('usage-counts', out);
