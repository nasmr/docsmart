// Test helpers for the nine first-pass templates and the field catalogue in the repository.
import { readdirSync, readFileSync } from 'node:fs';
import type { Block, Inline } from '../format.js';
import { type Catalogue, CatalogueSchema } from '../rules.js';

const repo = new URL('../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, repo));

export const catalogue: Catalogue = CatalogueSchema.parse(
  JSON.parse(read('templates/fields/catalogue.json').toString()),
);

export const FIRST_PASS = ['D12-A', 'D12-B', 'D12-C', 'D13-A', 'D13-B', 'D13-C', 'D1SP-A', 'D1SP-B', 'D1SP-C'] as const;

export function firstPassFile(id: string): Uint8Array {
  const dir = 'templates/first-pass/';
  const name = readdirSync(new URL(dir, repo)).find((f) => f.startsWith(`${id}_`));
  if (!name) throw new Error(`no first-pass file for ${id}`);
  return read(dir + name);
}

export interface UsageRecord {
  kind: string;
  name: string;
  context: string[];
}
export const generatorUsage: Record<string, UsageRecord[]> = JSON.parse(
  read('templates/fields/usage.json').toString(),
).templates;

// The same records from an imported tree, in the generator's terms (lib.js): a condition is
// recorded outside its own block; a list outside its loop; a WHERE inside the loop before it applies.
const each = (alias: string, list: string, where?: string) =>
  `EACH ${alias} IN ${list}${where ? ` WHERE ${where}` : ''}`;

export function treeUsage(blocks: readonly Block[]): UsageRecord[] {
  const out: UsageRecord[] = [];
  const rec = (kind: string, name: string, context: string[]) => out.push({ kind, name, context });
  const inl = (xs: readonly Inline[], ctx: string[]) => {
    for (const x of xs) {
      if (x.t === 'slot') rec('field', x.name, ctx);
      else if (x.t === 'if') {
        rec('condition', x.cond, ctx);
        inl(x.then, [...ctx, x.cond]);
        if (x.else) inl(x.else, [...ctx, `NOT ${x.cond}`]);
      } else if (x.t === 'each') {
        rec('list', x.list, ctx);
        if (x.where) rec('condition', x.where, [...ctx, each(x.alias, x.list)]);
        inl(x.body, [...ctx, each(x.alias, x.list, x.where)]);
      }
    }
  };
  const blk = (bs: readonly Block[], ctx: string[]) => {
    for (const b of bs) {
      if (b.t === 'if') {
        rec('condition', b.cond, ctx);
        blk(b.then, [...ctx, b.cond]);
        if (b.else) blk(b.else, [...ctx, `NOT ${b.cond}`]);
      } else if (b.t === 'each') {
        rec('list', b.list, ctx);
        if (b.where) rec('condition', b.where, [...ctx, each(b.alias, b.list)]);
        blk(b.body, [...ctx, each(b.alias, b.list, b.where)]);
      } else if (b.t === 'zone') {
        rec('zone', b.zone, ctx);
        inl(b.instructions, ctx);
      } else if (b.t === 'locked') {
        rec('locked', b.text.map((x) => (x.t === 'slot' ? `{{${x.name}}}` : x.t === 'text' ? x.v : '')).join(''), ctx);
        inl(b.text, ctx);
      } else if (b.t === 'table') {
        for (const r of b.rows) {
          const c = r.t === 'each_row' ? [...ctx, each(r.alias, r.list, r.where)] : ctx;
          if (r.t === 'each_row') {
            rec('list', r.list, ctx);
            if (r.where) rec('condition', r.where, [...ctx, each(r.alias, r.list)]);
          }
          for (const cell of r.cells) inl(cell, c);
        }
      } else inl(b.text, ctx);
    }
  };
  blk(blocks, []);
  return out;
}

/** Records as sorted "kind | name | context" strings, for comparing as multisets. */
export const keys = (rs: readonly UsageRecord[]) =>
  rs.map((r) => `${r.kind} | ${r.name} | ${r.context.join(' > ')}`).sort();
