/**
 * The canonical template format (decision 0008): a clause tree in which every block has a stable
 * id. Templates and draft versions are stored in this form; Word is for import and export only.
 */
import { createHash } from 'node:crypto';
import canonicalizeModule from 'canonicalize';
import { z } from 'zod';

const canonicalize = canonicalizeModule as unknown as (v: unknown) => string;

export const FORMAT = 'docsmart.clause-tree/1';

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'slot'; name: string }
  | { t: 'if'; cond: string; then: Inline[]; else?: Inline[] }
  | { t: 'each'; alias: string; list: string; where?: string; body: Inline[] };

export type ParaStyle = 'title' | 'subtitle' | 'body' | 'bullet' | 'check' | 'signature';

export type TableRow =
  | { t: 'row'; cells: Inline[][] }
  /** A row repeated for each item in a list. */
  | { t: 'each_row'; alias: string; list: string; where?: string; cells: Inline[][] };

export type Block =
  | { t: 'heading'; id: string; level: number; number?: string; text: Inline[] }
  | { t: 'clause'; id: string; number?: string; text: Inline[] }
  | { t: 'para'; id: string; style: ParaStyle; text: Inline[] }
  | { t: 'table'; id: string; rows: TableRow[] }
  | { t: 'if'; cond: string; then: Block[]; else?: Block[] }
  | { t: 'each'; alias: string; list: string; where?: string; body: Block[] }
  /** A section the AI may draft (build plan B8). */
  | { t: 'zone'; id: string; zone: string; instructions: Inline[] }
  /** The contracting-party wording, generated from records and read-only (DF-P10). */
  | { t: 'locked'; id: string; kind: 'contracting_party'; text: Inline[] }
  /** A note or question for counsel, removed on assembly. */
  | { t: 'note'; id: string; text: Inline[] };

export type IdBlock = Extract<Block, { id: string }>;

export interface TemplateTree {
  format: typeof FORMAT;
  /** The template it is, e.g. "D12-A". */
  template: string;
  body: Block[];
}

// ---------- structural schema ----------

const Id = z.string().regex(/^[A-Za-z0-9_]{1,36}$/, 'must be 1 to 36 letters, digits or underscores');
const Text = z.string().min(1);

// Cast: Zod's inferred optionals include undefined, which exactOptionalPropertyTypes rejects.
const InlineSchema = z.lazy(() =>
  z.discriminatedUnion('t', [
    z.strictObject({ t: z.literal('text'), v: Text }),
    z.strictObject({ t: z.literal('slot'), name: Text }),
    z.strictObject({
      t: z.literal('if'),
      cond: Text,
      then: z.array(InlineSchema),
      else: z.array(InlineSchema).optional(),
    }),
    z.strictObject({
      t: z.literal('each'),
      alias: Text,
      list: Text,
      where: Text.optional(),
      body: z.array(InlineSchema),
    }),
  ]),
) as unknown as z.ZodType<Inline>;
const Inlines = z.array(InlineSchema);
const Cells = z.array(Inlines).min(1);

const BlockSchema = z.lazy(() =>
  z.discriminatedUnion('t', [
    z.strictObject({
      t: z.literal('heading'),
      id: Id,
      level: z.number().int().min(1).max(9),
      number: Text.optional(),
      text: Inlines,
    }),
    z.strictObject({ t: z.literal('clause'), id: Id, number: Text.optional(), text: Inlines }),
    z.strictObject({
      t: z.literal('para'),
      id: Id,
      style: z.enum(['title', 'subtitle', 'body', 'bullet', 'check', 'signature']),
      text: Inlines,
    }),
    z.strictObject({
      t: z.literal('table'),
      id: Id,
      rows: z
        .array(
          z.discriminatedUnion('t', [
            z.strictObject({ t: z.literal('row'), cells: Cells }),
            z.strictObject({ t: z.literal('each_row'), alias: Text, list: Text, where: Text.optional(), cells: Cells }),
          ]),
        )
        .min(1),
    }),
    z.strictObject({
      t: z.literal('if'),
      cond: Text,
      then: z.array(BlockSchema),
      else: z.array(BlockSchema).optional(),
    }),
    z.strictObject({
      t: z.literal('each'),
      alias: Text,
      list: Text,
      where: Text.optional(),
      body: z.array(BlockSchema),
    }),
    z.strictObject({ t: z.literal('zone'), id: Id, zone: Text, instructions: Inlines }),
    z.strictObject({ t: z.literal('locked'), id: Id, kind: z.literal('contracting_party'), text: Inlines }),
    z.strictObject({ t: z.literal('note'), id: Id, text: Inlines }),
  ]),
) as unknown as z.ZodType<Block>;

export const TemplateTreeSchema = z
  .strictObject({ format: z.literal(FORMAT), template: Text, body: z.array(BlockSchema) })
  .superRefine((tree, ctx) => {
    const seen = new Set<string>();
    for (const b of idBlocks(tree.body)) {
      if (seen.has(b.id))
        ctx.addIssue({ code: 'custom', path: ['body'], message: `block id ${b.id} is used more than once` });
      seen.add(b.id);
    }
  });

// ---------- helpers ----------

/** Every block that carries an id, in document order. */
export function* idBlocks(blocks: readonly Block[]): Generator<IdBlock> {
  for (const b of blocks) {
    if (b.t === 'if') {
      yield* idBlocks(b.then);
      if (b.else) yield* idBlocks(b.else);
    } else if (b.t === 'each') yield* idBlocks(b.body);
    else yield b;
  }
}

/** Text with fields shown as {{name}} and the branches of conditions and loops run together. */
export function inlineText(xs: readonly Inline[]): string {
  return xs
    .map((x) => {
      if (x.t === 'text') return x.v;
      if (x.t === 'slot') return `{{${x.name}}}`;
      if (x.t === 'if') return inlineText(x.then) + (x.else ? inlineText(x.else) : '');
      return inlineText(x.body);
    })
    .join('');
}

/** The readable text of a block, for matching and display. */
export function blockText(b: IdBlock): string {
  switch (b.t) {
    case 'zone':
      return `${b.zone} ${inlineText(b.instructions)}`;
    case 'table':
      return b.rows.map((r) => r.cells.map(inlineText).join(' | ')).join('\n');
    default:
      return inlineText(b.text);
  }
}

/** SHA-256 over the RFC 8785 form of the tree (decision 0005). */
export function contentHash(tree: TemplateTree): string {
  return createHash('sha256').update(canonicalize(tree)).digest('hex');
}
