/**
 * Word → clause tree (decision 0008). Reads the markup conventions in templates/README.md:
 * {{fields}}, [[IF …]] / [[ELSE]] / [[END IF]], [[FOR EACH … IN …]] / [[END FOR EACH]], and the
 * labelled boxes for AI zones, the locked designation and counsel notes.
 */
import { createHash } from 'node:crypto';
import { type Block, FORMAT, type Inline, type ParaStyle, type TableRow, type TemplateTree } from '../format.js';
import { ImportFailure, type ImportProblem } from './problems.js';
import { readWord, type WordBlock, type WordParagraph, where } from './read.js';

/** Bookmarks carrying block ids start with this (the renderer writes them). */
export const BOOKMARK_PREFIX = 'dsc_';

/** The first-pass templates start with a cover page for counsel, which is not template content. */
const COVER_MARK = 'SINGULARITY · DOCUMENT FACTORY';

const LABEL = {
  note: 'COUNSEL NOTE (removed on assembly)',
  zone: 'AI-DRAFTED ZONE · ',
  locked: 'LOCKED · CONTRACTING PARTY',
};
const EACH = /^FOR EACH (\w+) IN ([\w.]+)(?: WHERE (.+))?$/;

export interface ImportResult {
  tree: TemplateTree;
  ids: {
    /** Blocks whose id came from a docsmart bookmark. */
    from_bookmark: string[];
    /** Blocks given an id derived from their content (no bookmark). */
    derived: string[];
    /** Blocks that carried a bookmark already used earlier (a pasted copy): new id → claimed id. */
    duplicates: Array<{ id: string; bookmark: string }>;
  };
}

export async function importWord(docx: Uint8Array, template: string): Promise<ImportResult> {
  const all = await readWord(docx);
  const coverEnd =
    all[0]?.kind === 'p' && all[0].text.startsWith(COVER_MARK)
      ? all.findIndex((b) => b.kind === 'p' && b.page_break)
      : -1;
  const body = all
    .slice(coverEnd + 1)
    .filter((b) => !(b.kind === 'p' && b.text.trim() === '' && b.bookmarks.length === 0));

  const problems: ImportProblem[] = [];
  const items = body.map((b) => classify(b, problems));
  const { blocks, marks } = nest(items, problems);
  if (problems.length) throw new ImportFailure(problems);
  const ids = assignIds(template, blocks, marks);
  return { tree: { format: FORMAT, template, body: blocks }, ids };
}

// ---------- inline markup ----------

type Token = { k: 'text'; v: string } | { k: 'slot'; name: string } | { k: 'marker'; v: string };

function tokens(s: string): Token[] {
  const out: Token[] = [];
  for (const part of s.split(/(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/)) {
    if (!part) continue;
    if (part.startsWith('{{')) out.push({ k: 'slot', name: part.slice(2, -2).trim() });
    else if (part.startsWith('[[')) out.push({ k: 'marker', v: part.slice(2, -2).trim() });
    else out.push({ k: 'text', v: part });
  }
  return out;
}

function inlines(s: string, at: string, problems: ImportProblem[]): Inline[] {
  const ts = tokens(s);
  let i = 0;
  const fail = (code: ImportProblem['code'], message: string) => {
    problems.push({ code, at, message });
    i = ts.length;
  };
  function seq(stops: string[]): Inline[] {
    const out: Inline[] = [];
    while (i < ts.length) {
      const t = ts[i] as Token;
      if (t.k === 'marker' && stops.includes(t.v)) return out;
      i++;
      if (t.k === 'text') out.push({ t: 'text', v: t.v });
      else if (t.k === 'slot') out.push({ t: 'slot', name: t.name });
      else {
        const m = t.v.match(/^IF (.+)$/);
        const e = t.v.match(EACH);
        if (m) {
          const then = seq(['ELSE', 'END IF']);
          let els: Inline[] | undefined;
          if ((ts[i] as Token | undefined)?.k === 'marker' && (ts[i] as { v: string }).v === 'ELSE') {
            i++;
            els = seq(['END IF']);
          }
          if ((ts[i] as { v?: string } | undefined)?.v !== 'END IF') {
            fail('unbalanced_block', `[[IF ${m[1]}]] is not closed with [[END IF]] in the same paragraph.`);
            return out;
          }
          i++;
          out.push({ t: 'if', cond: (m[1] as string).trim(), then, ...(els ? { else: els } : {}) });
        } else if (e) {
          const body = seq(['END FOR EACH']);
          if ((ts[i] as { v?: string } | undefined)?.v !== 'END FOR EACH') {
            fail('unbalanced_block', `[[FOR EACH …]] is not closed with [[END FOR EACH]] in the same paragraph.`);
            return out;
          }
          i++;
          out.push({
            t: 'each',
            alias: e[1] as string,
            list: e[2] as string,
            ...(e[3] ? { where: e[3].trim() } : {}),
            body,
          });
        } else if (['ELSE', 'END IF', 'END FOR EACH'].includes(t.v)) {
          fail('unbalanced_block', `[[${t.v}]] has nothing to close.`);
          return out;
        } else {
          fail(
            'unknown_marker',
            `[[${t.v}]] is not IF, ELSE, END IF, FOR EACH or END FOR EACH. Use a counsel note for text to be written.`,
          );
          return out;
        }
      }
    }
    return out;
  }
  return seq([]);
}

// ---------- blocks ----------

type Item =
  | { k: 'open-if'; cond: string; at: string }
  | { k: 'else'; at: string }
  | { k: 'end-if'; at: string }
  | { k: 'open-each'; alias: string; list: string; where?: string; at: string }
  | { k: 'end-each'; at: string }
  | { k: 'block'; b: Block; bookmarks: string[] };

function classify(w: WordBlock, problems: ImportProblem[]): Item {
  const at = where(w);
  const block = (b: Block): Item => ({ k: 'block', b, bookmarks: w.bookmarks });
  if (w.kind === 'tbl') {
    if (!w.rows.length) problems.push({ code: 'empty_table', at, message: 'The table has no rows.' });
    return block({ t: 'table', id: '', rows: w.rows.map((cells) => tableRow(cells, at, problems)) });
  }
  const text = w.text;
  const only = text.trim().match(/^\[\[([^\]]+)\]\]$/);
  if (only) {
    const v = (only[1] as string).trim();
    const m = v.match(/^IF (.+)$/);
    const e = v.match(EACH);
    if (m) return { k: 'open-if', cond: (m[1] as string).trim(), at };
    if (v === 'ELSE') return { k: 'else', at };
    if (v === 'END IF') return { k: 'end-if', at };
    if (e)
      return {
        k: 'open-each',
        alias: e[1] as string,
        list: e[2] as string,
        ...(e[3] ? { where: e[3].trim() } : {}),
        at,
      };
    if (v === 'END FOR EACH') return { k: 'end-each', at };
  }
  const inl = (s: string) => inlines(s, at, problems);
  if (w.bordered && text.startsWith(LABEL.note))
    return block({ t: 'note', id: '', text: inl(text.slice(LABEL.note.length).replace(/^\n/, '')) });
  if (w.bordered && text.startsWith(LABEL.zone)) {
    const [head, ...rest] = text.slice(LABEL.zone.length).split('\n');
    return block({ t: 'zone', id: '', zone: (head as string).trim(), instructions: inl(rest.join('\n')) });
  }
  if (w.bordered && text.startsWith(LABEL.locked)) {
    return block({ t: 'locked', id: '', kind: 'contracting_party', text: inl(text.split('\n').slice(1).join('\n')) });
  }
  if (isHeading(w)) {
    const typed = w.number ? null : text.match(/^(\d+)\s+(.*)$/s);
    const number = w.number ?? typed?.[1];
    return block({
      t: 'heading',
      id: '',
      level: w.heading_level ?? 1,
      ...(number ? { number } : {}),
      text: inl(typed ? (typed[2] as string) : text),
    });
  }
  if (w.number) return block({ t: 'clause', id: '', number: w.number, text: inl(text) });
  const typed = text.match(/^(\d+(?:\.\d+)+)\t([\s\S]*)$/);
  if (typed) return block({ t: 'clause', id: '', number: typed[1] as string, text: inl(typed[2] as string) });
  return block({
    t: 'para',
    id: '',
    style: paraStyle(w),
    text: inl(w.bullet || !text.startsWith('☐') ? text : text.replace(/^☐\s*/, '')),
  });
}

/** A heading style or outline level; or, in the first-pass templates, bold 11.5pt kept with the next paragraph. */
function isHeading(w: WordParagraph): boolean {
  if (w.heading_level !== undefined) return true;
  return w.keep_next && w.bold && w.size === 23;
}

function paraStyle(w: WordParagraph): ParaStyle {
  if (w.style_name === 'Title') return 'title';
  if (w.style_name === 'Subtitle') return 'subtitle';
  if (w.center) return w.bold ? 'title' : 'subtitle';
  if (w.bullet) return 'bullet';
  if (w.text.startsWith('☐')) return 'check';
  if (/^_{10,}$/.test(w.text.trim())) return 'signature';
  return 'body';
}

/** A FOR EACH that opens in the first cell and closes in the last repeats the row. */
function tableRow(cells: string[], at: string, problems: ImportProblem[]): TableRow {
  const first = cells[0] ?? '';
  const last = cells[cells.length - 1] ?? '';
  const open = first.match(/^\s*\[\[(FOR EACH [^\]]+)\]\]\s*/);
  const close = last.match(/\s*\[\[END FOR EACH\]\]\s*$/);
  const e = open?.[1]?.match(EACH);
  if (open && close && e && cells.length > 1) {
    const inner = cells.map((c, j) => {
      let s = c;
      if (j === 0) s = s.slice(open[0].length);
      if (j === cells.length - 1) s = s.slice(0, s.length - close[0].length);
      return inlines(s, at, problems);
    });
    return {
      t: 'each_row',
      alias: e[1] as string,
      list: e[2] as string,
      ...(e[3] ? { where: e[3].trim() } : {}),
      cells: inner,
    };
  }
  return { t: 'row', cells: cells.map((c) => inlines(c, at, problems)) };
}

function nest(items: Item[], problems: ImportProblem[]): { blocks: Block[]; marks: Map<Block, string[]> } {
  const marks = new Map<Block, string[]>();
  let i = 0;
  function seq(stops: Item['k'][]): Block[] {
    const out: Block[] = [];
    while (i < items.length) {
      const it = items[i] as Item;
      if (stops.includes(it.k)) return out;
      i++;
      if (it.k === 'block') {
        marks.set(it.b, it.bookmarks);
        out.push(it.b);
      } else if (it.k === 'open-if') {
        const then = seq(['else', 'end-if']);
        let els: Block[] | undefined;
        if (items[i]?.k === 'else') {
          i++;
          els = seq(['end-if']);
        }
        if (items[i]?.k !== 'end-if')
          problems.push({
            code: 'unbalanced_block',
            at: it.at,
            message: `[[IF ${it.cond}]] is never closed with [[END IF]].`,
          });
        else i++;
        out.push({ t: 'if', cond: it.cond, then, ...(els ? { else: els } : {}) });
      } else if (it.k === 'open-each') {
        const body = seq(['end-each']);
        if (items[i]?.k !== 'end-each')
          problems.push({
            code: 'unbalanced_block',
            at: it.at,
            message: `[[FOR EACH ${it.alias} IN ${it.list}]] is never closed.`,
          });
        else i++;
        out.push({ t: 'each', alias: it.alias, list: it.list, ...(it.where ? { where: it.where } : {}), body });
      } else {
        const name = { else: 'ELSE', 'end-if': 'END IF', 'end-each': 'END FOR EACH' }[it.k];
        problems.push({ code: 'unbalanced_block', at: it.at, message: `[[${name}]] has nothing to close.` });
      }
    }
    return out;
  }
  const blocks = seq([]);
  return { blocks, marks };
}

// ---------- ids ----------

/**
 * Ids come from docsmart bookmarks when present. A block without one gets an id derived from the
 * template, its kind and its content, with a counter for repeats, so the same file always gives the
 * same ids. A second block carrying an already-used bookmark (a pasted copy) gets a new id.
 */
function assignIds(template: string, blocks: Block[], marks: Map<Block, string[]>): ImportResult['ids'] {
  const result: ImportResult['ids'] = { from_bookmark: [], derived: [], duplicates: [] };
  const used = new Set<string>();
  const repeats = new Map<string, number>();
  const visit = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === 'if') {
        visit(b.then);
        if (b.else) visit(b.else);
        continue;
      }
      if (b.t === 'each') {
        visit(b.body);
        continue;
      }
      const mark = (marks.get(b) ?? []).find((n) => n.startsWith(BOOKMARK_PREFIX))?.slice(BOOKMARK_PREFIX.length);
      if (mark && !used.has(mark)) {
        b.id = mark;
        result.from_bookmark.push(mark);
      } else {
        const { id: _, ...content } = b;
        const basis = `${template}|${JSON.stringify(content)}`;
        const n = (repeats.get(basis) ?? 0) + 1;
        repeats.set(basis, n);
        let id = `b${createHash('sha256').update(`${basis}|${n}`).digest('hex').slice(0, 12)}`;
        while (used.has(id)) id = `b${createHash('sha256').update(id).digest('hex').slice(0, 12)}`;
        b.id = id;
        if (mark) result.duplicates.push({ id, bookmark: mark });
        else result.derived.push(id);
      }
      used.add(b.id);
    }
  };
  visit(blocks);
  return result;
}
