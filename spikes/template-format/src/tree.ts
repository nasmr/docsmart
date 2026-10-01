// Candidate canonical template format: a clause tree with stable ids.
// Spike code: the shapes here are what the spike tests, not a final schema.
import { createHash } from 'node:crypto';
import canonicalizeModule from 'canonicalize';

const canonicalize = canonicalizeModule as unknown as (v: unknown) => string;

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'slot'; name: string }
  | { t: 'if'; cond: string; then: Inline[]; else?: Inline[] }
  | { t: 'each'; alias: string; list: string; where?: string; body: Inline[] }
  | { t: 'raw'; v: string }; // [[...]] text that is not a block token (a template issue)

export type ParaStyle = 'title' | 'subtitle' | 'body' | 'bullet' | 'check' | 'signature';

export type Block =
  | { t: 'heading'; id: string; number?: string; text: Inline[] }
  | { t: 'clause'; id: string; number: string; text: Inline[] }
  | { t: 'para'; id: string; style: ParaStyle; text: Inline[] }
  | { t: 'table'; id: string; rows: TableRow[] }
  | { t: 'if'; cond: string; then: Block[]; else?: Block[] }
  | { t: 'each'; alias: string; list: string; where?: string; body: Block[] }
  | { t: 'zone'; id: string; zone: string; instructions: Inline[] }
  | { t: 'locked'; id: string; kind: 'contracting_party'; text: Inline[] }
  | { t: 'note'; id: string; text: Inline[] };

// A row is either fixed cells, or a row repeated for each item in a list.
export type TableRow =
  | { t: 'row'; cells: Inline[][] }
  | { t: 'each_row'; alias: string; list: string; where?: string; cells: Inline[][] };

export interface TemplateTree {
  format: 'docsmart.clause-tree/0';
  template: string;
  body: Block[];
}

export function canonicalJson(tree: TemplateTree): string {
  return canonicalize(tree);
}

export function contentHash(tree: TemplateTree): string {
  return createHash('sha256').update(canonicalJson(tree)).digest('hex');
}

// Every block that carries an id, in document order.
export function* idBlocks(blocks: Block[]): Generator<Extract<Block, { id: string }>> {
  for (const b of blocks) {
    if (b.t === 'if') {
      yield* idBlocks(b.then);
      if (b.else) yield* idBlocks(b.else);
    } else if (b.t === 'each') {
      yield* idBlocks(b.body);
    } else {
      yield b;
    }
  }
}

export function inlineText(xs: Inline[]): string {
  return xs
    .map((x) => {
      if (x.t === 'text' || x.t === 'raw') return x.v;
      if (x.t === 'slot') return `{{${x.name}}}`;
      if (x.t === 'if') return inlineText(x.then) + (x.else ? inlineText(x.else) : '');
      return inlineText(x.body);
    })
    .join('');
}

export function blockText(b: Block): string {
  switch (b.t) {
    case 'heading':
    case 'clause':
    case 'para':
    case 'locked':
    case 'note':
      return inlineText(b.text);
    case 'zone':
      return b.zone + ' ' + inlineText(b.instructions);
    case 'table':
      return b.rows.map((r) => r.cells.map(inlineText).join(' | ')).join('\n');
    default:
      return '';
  }
}
