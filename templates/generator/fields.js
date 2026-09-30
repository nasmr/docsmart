// Checks the templates against templates/fields/catalogue.json and writes templates/fields/usage.md.
//   node fields.js          check, then rewrite usage.md
//   node fields.js --check  check, and fail if usage.md is out of date
// Exits 1 if a template uses something the catalogue lacks, or the catalogue lists something no
// template uses. Template issues (unbound loop fields, stray [[...]] text) are reported, not fatal.
const fs = require('fs');
const path = require('path');
const { scan, usage } = require('./lib');

const dir = path.join(__dirname, '..', 'fields');
const cat = JSON.parse(fs.readFileSync(path.join(dir, 'catalogue.json'), 'utf8'));
const templates = [...require('./resolutions'), ...require('./supplements'), ...require('./subscriptions')];
for (const t of templates) scan(t.meta, t.body);
const ids = templates.map((t) => t.meta.id);

const errors = [];
const issues = [];
const aliases = new Set(Object.values(cat.lists).map((l) => l.item));
const inLoop = (u, alias) => u.context.some((c) => c.startsWith('EACH ' + alias + ' IN '));

// A condition is `field`, `field = value` or `any alias.field`.
function parseCondition(expr) {
  const m = expr.match(/^(any\s+)?([\w.]+)(?:\s*=\s*(\w+))?$/);
  return m ? { any: !!m[1], field: m[2], value: m[3] } : null;
}

const used = { fields: new Set(), lists: new Set(), zones: new Set() };
for (const u of usage) {
  const where = u.template + ': ';
  if (u.kind === 'field') {
    used.fields.add(u.name);
    if (!cat.fields[u.name]) errors.push(where + 'field {{' + u.name + '}} is not in the catalogue');
    const alias = u.name.split('.')[0];
    if (aliases.has(alias) && !inLoop(u, alias)) issues.push(where + '{{' + u.name + '}} is used outside a FOR EACH ' + alias + ' loop, so it is not clear which ' + alias + ' it means');
  } else if (u.kind === 'condition') {
    const c = parseCondition(u.name);
    if (!c) { errors.push(where + 'cannot parse condition “' + u.name + '”'); continue; }
    used.fields.add(c.field);
    const f = cat.fields[c.field];
    if (!f) { errors.push(where + 'condition field ' + c.field + ' is not in the catalogue'); continue; }
    if (c.value && !(f.values || []).includes(c.value)) errors.push(where + 'condition “' + u.name + '”: ' + c.value + ' is not a value of ' + c.field);
    if (!c.value && f.type !== 'boolean') errors.push(where + 'condition “' + u.name + '” needs a boolean field, but ' + c.field + ' is ' + f.type);
    const alias = c.field.split('.')[0];
    if (c.any) issues.push(where + '[[IF ' + u.name + ']] does not say which list “any” ranges over; use FOR EACH … WHERE');
    else if (aliases.has(alias) && !inLoop(u, alias)) issues.push(where + '[[IF ' + u.name + ']] is used outside a FOR EACH ' + alias + ' loop');
  } else if (u.kind === 'list') {
    used.lists.add(u.name);
    if (!cat.lists[u.name]) errors.push(where + 'list ' + u.name + ' is not in the catalogue');
  } else if (u.kind === 'zone') {
    used.zones.add(u.name);
    if (!cat.zones[u.name]) errors.push(where + 'AI zone ' + u.name + ' is not in the catalogue');
  } else if (u.kind === 'placeholder') {
    issues.push(where + '[[' + u.name + ']] uses block markup but is not IF, ELSE, END IF, FOR EACH or END FOR EACH');
  } else if (u.kind === 'error') {
    issues.push(where + u.name);
  }
}
for (const k of Object.keys(cat.fields)) if (!used.fields.has(k)) errors.push('catalogue: field ' + k + ' is not used by any template');
for (const k of Object.keys(cat.lists)) if (!used.lists.has(k)) errors.push('catalogue: list ' + k + ' is not used by any template');
for (const k of Object.keys(cat.zones)) if (!used.zones.has(k)) errors.push('catalogue: zone ' + k + ' is not used by any template');
for (const [k, f] of Object.entries(cat.fields)) {
  if (!cat.types[f.type]) errors.push('catalogue: ' + k + ' has unknown type ' + f.type);
  if (!cat.origins[f.origin]) errors.push('catalogue: ' + k + ' has unknown origin ' + f.origin);
  if (f.type === 'enum' && !(f.values || []).length) errors.push('catalogue: enum ' + k + ' has no values');
}

// ---------- usage.md ----------

// The conditions a use depends on, ignoring loops without a WHERE.
function conditionsOf(u) {
  const out = [];
  for (const c of u.context) {
    if (c.startsWith('EACH ')) { const w = c.split(' WHERE ')[1]; if (w) out.push('where ' + w); }
    else if (c.startsWith('NOT ')) out.push('unless ' + c.slice(4));
    else out.push('if ' + c);
  }
  return out.join(' and ');
}

// "D12-A, D12-B; D13-B if x" — templates grouped by the condition the item appears under.
function usedIn(match) {
  const per = new Map(); // template -> Set(condition) ; '' = unconditional
  for (const u of usage) {
    if (!match(u)) continue;
    if (!per.has(u.template)) per.set(u.template, new Set());
    per.get(u.template).add(conditionsOf(u));
  }
  const groups = new Map(); // condition text -> [templates]
  for (const id of ids) {
    if (!per.has(id)) continue;
    const s = per.get(id);
    const key = s.has('') ? '' : [...s].sort().join(' or ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  return [...groups.entries()].map(([k, v]) => v.join(', ') + (k ? ' ' + k : '')).join('; ');
}

const fieldUse = (name) => (u) => (u.kind === 'field' && u.name === name)
  || (u.kind === 'condition' && parseCondition(u.name) && parseCondition(u.name).field === name);
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const entityOf = (source) => source.match(/^[A-Za-z]+/)[0];

const L = [];
L.push('# Field usage');
L.push('');
L.push('Generated by `templates/generator/fields.js` from `catalogue.json` and the template sources. Do not edit by hand: run `npm run fields` in `templates/generator`.');
L.push('');
L.push('## Templates');
L.push('');
L.push('| Template | Fields | Conditions | Lists | AI zones | Locked wording |');
L.push('|---|---|---|---|---|---|');
for (const id of ids) {
  const mine = usage.filter((u) => u.template === id);
  const distinct = (kind) => [...new Set(mine.filter((u) => u.kind === kind).map((u) => u.name))];
  L.push('| ' + [id, distinct('field').length, distinct('condition').length, distinct('list').join(', ') || '—',
    distinct('zone').join(', ') || '—', distinct('locked').map((s) => '`' + s + '`').join('<br>') || '—'].map(cell).join(' | ') + ' |');
}
L.push('');
L.push('## Fields by origin');
L.push('');
L.push('| Origin | Fields | Meaning |');
L.push('|---|---|---|');
for (const [o, meaning] of Object.entries(cat.origins)) {
  L.push('| ' + [o, Object.values(cat.fields).filter((f) => f.origin === o).length, meaning].map(cell).join(' | ') + ' |');
}
L.push('');
L.push('## Fields by source entity');
L.push('');
L.push('“Used in” lists each template, and the condition when the field appears only under one.');
const byEntity = new Map();
for (const [k, f] of Object.entries(cat.fields)) {
  const e = entityOf(f.source);
  if (!byEntity.has(e)) byEntity.set(e, []);
  byEntity.get(e).push([k, f]);
}
const order = [...Object.keys(cat.entities), ...[...byEntity.keys()].filter((e) => !cat.entities[e]).sort()];
for (const e of order) {
  if (!byEntity.has(e)) continue;
  L.push('');
  L.push('### ' + e);
  L.push('');
  if (cat.entities[e]) { L.push(cat.entities[e]); L.push(''); }
  L.push('| Field | Type | Origin | Source | Used in | Notes |');
  L.push('|---|---|---|---|---|---|');
  for (const [k, f] of byEntity.get(e)) {
    const type = f.type === 'enum' ? 'enum: ' + f.values.join(', ') : f.type;
    const notes = [f.validation, f.notes].filter(Boolean).join(' ');
    L.push('| ' + ['`' + k + '`', type, f.origin, '`' + f.source + '`', usedIn(fieldUse(k)), notes].map(cell).join(' | ') + ' |');
  }
}
L.push('');
L.push('## Lists');
L.push('');
L.push('| List | Item | Origin | Source | Used in |');
L.push('|---|---|---|---|---|');
for (const [k, l] of Object.entries(cat.lists)) {
  L.push('| ' + ['`' + k + '`', l.item, l.origin, '`' + l.source + '`', usedIn((u) => u.kind === 'list' && u.name === k)].map(cell).join(' | ') + ' |');
}
L.push('');
L.push('## AI-drafted zones');
L.push('');
L.push('| Zone | Used in | Instructions |');
L.push('|---|---|---|');
for (const [k, z] of Object.entries(cat.zones)) {
  L.push('| ' + ['`' + k + '`', usedIn((u) => u.kind === 'zone' && u.name === k), z.description].map(cell).join(' | ') + ' |');
}
L.push('');
L.push('## Template issues');
L.push('');
const uniqueIssues = [...new Set(issues)];
if (!uniqueIssues.length) L.push('None.');
for (const i of uniqueIssues) L.push('- ' + i);
L.push('');
const md = L.join('\n');

for (const e of errors) console.error('error: ' + e);
for (const i of uniqueIssues) console.warn('template issue: ' + i);
const file = path.join(dir, 'usage.md');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current !== md) { console.error('error: templates/fields/usage.md is out of date; run npm run fields'); process.exit(1); }
} else {
  fs.writeFileSync(file, md);
  console.log('wrote', path.relative(process.cwd(), file));
}
console.log(Object.keys(cat.fields).length + ' fields, ' + Object.keys(cat.lists).length + ' lists, ' + Object.keys(cat.zones).length + ' zones; '
  + errors.length + ' errors, ' + uniqueIssues.length + ' template issues');
if (errors.length) process.exit(1);
