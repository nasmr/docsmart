/**
 * Deterministic assembly (build plan B5): an approved template and the records give an assembled
 * document. No model is involved; numbers come from records or the calculation service (CLAUDE.md).
 */
import { designation } from '@docsmart/domain';
import {
  type Block,
  checkImportRules,
  type Inline,
  isConditionError,
  parseCondition,
  type TableRow,
  type TemplateTree,
} from '@docsmart/template-library';
import {
  ASSEMBLED_FORMAT,
  type AssembledBlock,
  type AssembledDocument,
  type AssemblyProblem,
  assembledHash,
  type Piece,
} from './assembled.js';
import { FormatError, formatValue, type ValueType } from './format.js';
import { type AssemblyContext, type FieldCatalogue, itemKey, type Lookup, lookup, lookupList } from './resolve.js';

export interface AssemblyInput extends Omit<AssemblyContext, 'catalogue'> {
  template: TemplateTree;
  template_version_id: string;
  catalogue: FieldCatalogue;
}

export interface AssemblyResult {
  document: AssembledDocument;
  content_hash: string;
  /** Every value used, for re-derivation (DF-51). `item` is the loop item's key. */
  values: Array<{ field: string; item?: string; value: unknown }>;
  /** Evidence from the calculation service for each calculated value. */
  calculations: unknown[];
  /** Hashes of the documents it was built on, for DraftVersion.referenced_document_hashes (addendum §4.2). */
  referenced_hashes: Record<string, string>;
}

export class AssemblyRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssemblyRefused';
  }
}

type Scope = ReadonlyMap<string, { item: Readonly<Record<string, unknown>>; key: string }>;

export function assemble(input: AssemblyInput): AssemblyResult {
  const rules = checkImportRules(input.template, { ...input.catalogue, fields: input.catalogue.fields });
  if (rules.length) {
    throw new AssemblyRefused(
      `The template breaks the import rules: ${rules.map((r) => `${r.at}: ${r.message}`).join('; ')}`,
    );
  }
  const ctx: AssemblyContext = {
    catalogue: input.catalogue,
    document: input.document,
    records: input.records,
    references: input.references,
  };
  const problems: AssemblyProblem[] = [];
  const values = new Map<string, { field: string; item?: string; value: unknown }>();
  const calculations: unknown[] = [];

  const problem = (p: AssemblyProblem) => {
    if (!problems.some((q) => q.kind === p.kind && q.field === p.field && q.at === p.at)) problems.push(p);
  };

  function find(field: string, scope: Scope): Lookup {
    const bound = scope.get(field.split('.')[0] as string);
    const r = lookup(field, ctx, bound?.item);
    if (r.kind === 'value') {
      const key = bound ? `${field}@${bound.key}` : field;
      if (!values.has(key)) {
        values.set(key, { field, ...(bound ? { item: bound.key } : {}), value: r.value });
        if (r.evidence) calculations.push(r.evidence);
      }
    }
    return r;
  }

  /** True, false, or undefined when it cannot be decided (reported, never assumed false). */
  function decide(text: string, scope: Scope, at: string): boolean | undefined {
    const c = parseCondition(text);
    if (isConditionError(c)) throw new AssemblyRefused(c.error); // the import rules make this unreachable
    const test = (s: Scope): boolean | undefined => {
      const r = find(c.path, s);
      if (r.kind !== 'value') {
        problem({
          kind: 'condition_undecided',
          field: c.path,
          at,
          reason: r.kind === 'missing' ? r.reason : 'filled at signing',
        });
        return undefined;
      }
      if (c.value !== undefined) return r.value === c.value;
      if (typeof r.value !== 'boolean') {
        problem({ kind: 'condition_undecided', field: c.path, at, reason: 'is not true or false' });
        return undefined;
      }
      return r.value;
    };
    if (!c.any) return test(scope);
    const alias = c.path.split('.')[0] as string;
    const list = Object.entries(ctx.catalogue.lists).find(([, l]) => l.item === alias)?.[0] as string;
    const items = lookupList(list, ctx);
    if (!Array.isArray(items)) {
      problem({ kind: 'list_unavailable', field: list, at, reason: items.missing });
      return undefined;
    }
    let undecided = false;
    for (const [i, item] of items.entries()) {
      const r = test(new Map([...scope, [alias, { item, key: itemKey(item, i) }]]));
      if (r === true) return true;
      if (r === undefined) undecided = true;
    }
    return undecided ? undefined : false;
  }

  /** The items of a loop that pass its filter, each with its scope. */
  function iterate(alias: string, list: string, where: string | undefined, scope: Scope, at: string): Scope[] {
    const items = lookupList(list, ctx);
    if (!Array.isArray(items)) {
      problem({ kind: 'list_unavailable', field: list, at, reason: items.missing });
      return [];
    }
    const out: Scope[] = [];
    for (const [i, item] of items.entries()) {
      const inner: Scope = new Map([...scope, [alias, { item, key: itemKey(item, i) }]]);
      if (where === undefined || decide(where, inner, at) === true) out.push(inner);
    }
    return out;
  }

  function fill(field: string, scope: Scope, at: string): Piece {
    const spec = ctx.catalogue.fields[field];
    const r = find(field, scope);
    if (r.kind === 'execution') return { t: 'blank', field };
    if (r.kind === 'missing') {
      problem({ kind: 'missing_value', field, at, reason: r.reason });
      return { t: 'missing', field, reason: r.reason };
    }
    try {
      const v = formatValue((spec?.type ?? 'text') as ValueType, r.value, {
        ...(spec?.labels ? { labels: spec.labels } : {}),
        calculated: spec?.origin === 'calculated',
      });
      return { t: 'value', field, v, origin: spec?.origin ?? 'record' };
    } catch (e) {
      const reason = e instanceof FormatError ? e.message : String(e);
      problem({ kind: 'missing_value', field, at, reason });
      return { t: 'missing', field, reason };
    }
  }

  function inlines(xs: readonly Inline[], scope: Scope, at: string): Piece[] {
    const out: Piece[] = [];
    for (const x of xs) {
      if (x.t === 'text') out.push({ t: 'text', v: x.v });
      else if (x.t === 'slot') out.push(fill(x.name, scope, at));
      else if (x.t === 'if') {
        const d = decide(x.cond, scope, at);
        if (d === true) out.push(...inlines(x.then, scope, at));
        else if (d === false && x.else) out.push(...inlines(x.else, scope, at));
      } else out.push(...list(iterate(x.alias, x.list, x.where, scope, at).map((inner) => inlines(x.body, inner, at))));
    }
    return merge(out);
  }

  /** An inline loop's items as a list: “A”, “A and B”, “A, B and C” (decision 0011). */
  function list(items: Piece[][]): Piece[] {
    const trimmed = items.map(trim).filter((i) => i.length);
    return trimmed.flatMap((item, i) => [
      ...(i === 0 ? [] : [{ t: 'text' as const, v: i === trimmed.length - 1 ? ' and ' : ', ' }]),
      ...item,
    ]);
  }

  const idFor = (id: string, scope: Scope) =>
    scope.size ? `${id}__${[...scope.values()].map((s) => s.key).join('_')}` : id;

  function rows(rs: readonly TableRow[], scope: Scope, at: string): Piece[][][] {
    const out: Piece[][][] = [];
    for (const r of rs) {
      if (r.t === 'row') out.push(r.cells.map((c) => inlines(c, scope, at)));
      else
        for (const inner of iterate(r.alias, r.list, r.where, scope, at))
          out.push(r.cells.map((c) => inlines(c, inner, at)));
    }
    return out;
  }

  function blocks(bs: readonly Block[], scope: Scope): AssembledBlock[] {
    const out: AssembledBlock[] = [];
    for (const b of bs) {
      switch (b.t) {
        case 'if': {
          const d = decide(b.cond, scope, firstId(b.then) ?? 'template');
          if (d === true) out.push(...blocks(b.then, scope));
          else if (d === false && b.else) out.push(...blocks(b.else, scope));
          break;
        }
        case 'each':
          for (const inner of iterate(b.alias, b.list, b.where, scope, firstId(b.body) ?? 'template'))
            out.push(...blocks(b.body, inner));
          break;
        case 'note':
          break; // counsel notes are removed on assembly
        case 'zone':
          out.push({ t: 'zone', id: idFor(b.id, scope), zone: b.zone, text: [] });
          break;
        case 'locked':
          out.push({ t: 'locked', id: idFor(b.id, scope), text: locked(b.id, scope) });
          break;
        case 'table':
          out.push({ t: 'table', id: idFor(b.id, scope), rows: rows(b.rows, scope, b.id) });
          break;
        default: {
          const text = inlines(b.text, scope, b.id);
          // A paragraph that is empty once its conditions are decided is left out.
          if (text.every((p) => p.t === 'text' && p.v.trim() === '') && b.text.length) break;
          const id = idFor(b.id, scope);
          if (b.t === 'heading')
            out.push({ t: 'heading', id, level: b.level, ...(b.number ? { number: b.number } : {}), text });
          else if (b.t === 'clause') out.push({ t: 'clause', id, ...(b.number ? { number: b.number } : {}), text });
          else out.push({ t: 'para', id, style: b.style, text });
        }
      }
    }
    return out;
  }

  /** The designation, generated from the records (DF-62) and checked against the filled fields (INV-9). */
  function locked(id: string, scope: Scope): Piece[] {
    const u = fill('umbrella.legal_name', scope, id);
    const p = fill('portfolio.legal_name', scope, id);
    const pieces: Piece[] = [u, { t: 'text', v: ' for and on behalf of ' }, p];
    if (u.t !== 'value' || p.t !== 'value') return pieces;
    try {
      if (designation(u.v, p.v) !== `${u.v} for and on behalf of ${p.v}`)
        throw new Error('does not match the generated wording');
    } catch (e) {
      problem({ kind: 'locked_wording', field: 'portfolio.legal_name', at: id, reason: (e as Error).message });
    }
    return pieces;
  }

  const body = renumber(blocks(input.template.body, new Map()));
  const document: AssembledDocument = {
    format: ASSEMBLED_FORMAT,
    document_id: input.document.id,
    template: input.template.template,
    template_version_id: input.template_version_id,
    body,
    problems,
  };
  const referenced_hashes: Record<string, string> = {};
  if (input.references.U3) referenced_hashes.U3 = input.references.U3.content_hash;
  if (input.references.D13) referenced_hashes.D13 = input.references.D13.content_hash;
  return {
    document,
    content_hash: assembledHash(document),
    values: [...values.values()],
    calculations,
    referenced_hashes,
  };
}

/** Without leading and trailing spaces. */
function trim(pieces: Piece[]): Piece[] {
  const out = [...pieces];
  const first = out[0];
  if (first?.t === 'text') out[0] = { t: 'text', v: first.v.trimStart() };
  const last = out[out.length - 1];
  if (last?.t === 'text') out[out.length - 1] = { t: 'text', v: last.v.trimEnd() };
  return merge(out);
}

/** Adjacent text pieces joined, so equal content always has one form. */
function merge(pieces: Piece[]): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (p.t === 'text' && last?.t === 'text') out[out.length - 1] = { t: 'text', v: last.v + p.v };
    else if (!(p.t === 'text' && p.v === '')) out.push(p);
  }
  return out;
}

function firstId(bs: readonly Block[]): string | undefined {
  for (const b of bs) {
    if ('id' in b) return b.id;
    const inner = b.t === 'if' ? (firstId(b.then) ?? (b.else ? firstId(b.else) : undefined)) : firstId(b.body);
    if (inner) return inner;
  }
  return undefined;
}

/**
 * Numbers headings and clauses in order once conditions are decided: where a template offers
 * alternative clauses (Word numbers both 3.1 and 3.2), the one kept is 3.1. Numbers that are not
 * dotted digits, such as "(a)", are kept as they are.
 */
export function renumber(body: AssembledBlock[]): AssembledBlock[] {
  const counters: number[] = [];
  return body.map((b) => {
    if ((b.t !== 'heading' && b.t !== 'clause') || !b.number) return b;
    const m = b.number.match(/^(\d+(?:\.\d+)*)(\.?)$/);
    if (!m) return b;
    const parts = (m[1] as string).split('.').map(Number);
    const depth = parts.length;
    for (let d = 0; d < depth - 1; d++) counters[d] = counters[d] ?? (parts[d] as number);
    counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;
    counters.length = depth;
    return { ...b, number: `${counters.join('.')}${m[2]}` };
  });
}
