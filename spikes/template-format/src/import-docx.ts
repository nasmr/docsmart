// Word (.docx) → clause tree. Spike importer for the first-pass template conventions.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Block, Inline, ParaStyle, TableRow, TemplateTree } from './tree.ts';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

type X = Record<string, unknown>; // a preserveOrder node: { tag: children[], ':@': attrs }

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

const tagOf = (n: X) => Object.keys(n).find((k) => k !== ':@') ?? '';
const kids = (n: X): X[] => (n[tagOf(n)] as X[]) ?? [];
const attrs = (n: X) => (n[':@'] as Record<string, string>) ?? {};
const find = (n: X, tag: string) => kids(n).find((c) => tagOf(c) === tag);
const findAll = (n: X, tag: string) => kids(n).filter((c) => tagOf(c) === tag);

// ---------- raw paragraphs ----------

interface RawPara {
  kind: 'p';
  text: string; // runs joined; tabs as \t, breaks as \n
  bold: boolean; // every non-empty run bold
  size?: number;
  keepNext: boolean;
  center: boolean;
  bordered: boolean;
  numbered: boolean;
  pageBreak: boolean;
  bookmarks: string[];
}
interface RawTable {
  kind: 'tbl';
  rows: string[][]; // cell texts (cell paragraphs joined with \n)
  bookmarks: string[];
}
type Raw = RawPara | RawTable;

function readPara(p: X): RawPara {
  const ppr = find(p, 'w:pPr');
  let text = '';
  let allBold = true;
  let any = false;
  let size: number | undefined;
  let pageBreak = false;
  const bookmarks: string[] = [];
  for (const c of kids(p)) {
    const tag = tagOf(c);
    if (tag === 'w:bookmarkStart') bookmarks.push(attrs(c)['w:name'] ?? '');
    if (tag !== 'w:r') continue;
    const rpr = find(c, 'w:rPr');
    const bold = !!(rpr && find(rpr, 'w:b'));
    const sz = rpr && find(rpr, 'w:sz');
    for (const r of kids(c)) {
      const rt = tagOf(r);
      if (rt === 'w:t') {
        const s = kids(r)
          .map((x) => String((x as Record<string, unknown>)['#text'] ?? ''))
          .join('');
        if (s.trim()) {
          any = true;
          if (!bold) allBold = false;
          if (sz && size === undefined) size = Number(attrs(sz)['w:val']);
        }
        text += s;
      } else if (rt === 'w:tab') text += '\t';
      else if (rt === 'w:br') {
        if (attrs(r)['w:type'] === 'page') pageBreak = true;
        else text += '\n';
      }
    }
  }
  const jc = ppr && find(ppr, 'w:jc');
  return {
    kind: 'p',
    text,
    bold: any && allBold,
    ...(size !== undefined ? { size } : {}),
    keepNext: !!(ppr && find(ppr, 'w:keepNext')),
    center: !!(jc && attrs(jc)['w:val'] === 'center'),
    bordered: !!(ppr && find(ppr, 'w:pBdr')),
    numbered: !!(ppr && find(ppr, 'w:numPr')),
    pageBreak,
    bookmarks,
  };
}

function readTable(t: X): RawTable {
  const bookmarks: string[] = [];
  const rows = findAll(t, 'w:tr').map((tr) =>
    findAll(tr, 'w:tc').map((tc) =>
      findAll(tc, 'w:p')
        .map((p) => {
          const rp = readPara(p);
          bookmarks.push(...rp.bookmarks);
          return rp.text;
        })
        .join('\n'),
    ),
  );
  return { kind: 'tbl', rows, bookmarks };
}

export async function readRaw(docx: Buffer): Promise<Raw[]> {
  const zip = await JSZip.loadAsync(docx);
  const xml: string = await zip.file('word/document.xml').async('string');
  const doc = parser.parse(xml) as X[];
  const document = doc.find((n) => tagOf(n) === 'w:document');
  if (!document) throw new Error('no w:document');
  const body = find(document, 'w:body');
  if (!body) throw new Error('no w:body');
  const out: Raw[] = [];
  for (const c of kids(body)) {
    if (tagOf(c) === 'w:p') out.push(readPara(c));
    else if (tagOf(c) === 'w:tbl') out.push(readTable(c));
  }
  return out;
}

// ---------- inline tokens ----------

type Tok = { k: 'text'; v: string } | { k: 'slot'; name: string } | { k: 'block'; v: string };

function tokens(s: string): Tok[] {
  const out: Tok[] = [];
  for (const part of s.split(/(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/)) {
    if (!part) continue;
    if (part.startsWith('{{')) out.push({ k: 'slot', name: part.slice(2, -2).trim() });
    else if (part.startsWith('[[')) out.push({ k: 'block', v: part.slice(2, -2).trim() });
    else out.push({ k: 'text', v: part });
  }
  return out;
}

const EACH = /^FOR EACH\s+(\w+)\s+IN\s+([\w.]+)(?:\s+WHERE\s+(.+))?$/;

// Parses inline tokens into a tree. Throws if blocks are unbalanced.
function inlines(ts: Tok[]): Inline[] {
  let i = 0;
  function seq(stop: string[]): Inline[] {
    const out: Inline[] = [];
    while (i < ts.length) {
      const t = ts[i] as Tok;
      if (t.k === 'block' && stop.includes(t.v)) return out;
      i++;
      if (t.k === 'text') out.push({ t: 'text', v: t.v });
      else if (t.k === 'slot') out.push({ t: 'slot', name: t.name });
      else {
        let m: RegExpMatchArray | null;
        if ((m = t.v.match(/^IF\s+(.+)$/))) {
          const then = seq(['ELSE', 'END IF']);
          let els: Inline[] | undefined;
          if ((ts[i] as { v?: string } | undefined)?.v === 'ELSE') {
            i++;
            els = seq(['END IF']);
          }
          if ((ts[i] as { v?: string } | undefined)?.v !== 'END IF') throw new Error('unclosed inline IF ' + m[1]);
          i++;
          out.push({ t: 'if', cond: (m[1] as string).trim(), then, ...(els ? { else: els } : {}) });
        } else if ((m = t.v.match(EACH))) {
          const body = seq(['END FOR EACH']);
          if ((ts[i] as { v?: string } | undefined)?.v !== 'END FOR EACH') throw new Error('unclosed inline FOR EACH');
          i++;
          out.push({ t: 'each', alias: m[1] as string, list: m[2] as string, ...(m[3] ? { where: m[3].trim() } : {}), body });
        } else {
          out.push({ t: 'raw', v: `[[${t.v}]]` });
        }
      }
    }
    return out;
  }
  const r = seq([]);
  if (i < ts.length) throw new Error('unbalanced inline block: ' + JSON.stringify(ts[i]));
  return r;
}

const inl = (s: string) => inlines(tokens(s));

// ---------- blocks ----------

const LABEL = {
  note: 'COUNSEL NOTE (removed on assembly)',
  zone: 'AI-DRAFTED ZONE · ',
  locked: 'LOCKED · CONTRACTING PARTY',
};

type Item =
  | { k: 'open-if'; cond: string }
  | { k: 'else' }
  | { k: 'end-if' }
  | { k: 'open-each'; alias: string; list: string; where?: string }
  | { k: 'end-each' }
  | { k: 'block'; b: Block; bookmarks: string[] };

function classify(r: Raw): Item {
  const pending = (b: Block) => ({ k: 'block' as const, b, bookmarks: r.bookmarks });
  if (r.kind === 'tbl') {
    const rows: TableRow[] = r.rows.map((cells) => {
      // A FOR EACH that opens in the first cell and closes in the last repeats the row.
      const first = cells[0] ?? '';
      const last = cells[cells.length - 1] ?? '';
      const open = first.match(/^\s*\[\[(FOR EACH [^\]]+)\]\]\s*/);
      const close = last.match(/\s*\[\[END FOR EACH\]\]\s*$/);
      if (open && close && cells.length > 1) {
        const m = (open[1] as string).match(EACH) as RegExpMatchArray;
        const trimmed = cells.map((c, j) => {
          let s = c;
          if (j === 0) s = s.slice(open[0].length);
          if (j === cells.length - 1) s = s.slice(0, s.length - close[0].length);
          return inl(s);
        });
        return { t: 'each_row', alias: m[1] as string, list: m[2] as string, ...(m[3] ? { where: m[3].trim() } : {}), cells: trimmed };
      }
      return { t: 'row', cells: cells.map(inl) };
    });
    return pending({ t: 'table', id: '', rows });
  }
  const text = r.text;
  const only = text.trim().match(/^\[\[([^\]]+)\]\]$/);
  if (only) {
    const v = (only[1] as string).trim();
    let m: RegExpMatchArray | null;
    if ((m = v.match(/^IF\s+(.+)$/))) return { k: 'open-if', cond: (m[1] as string).trim() };
    if (v === 'ELSE') return { k: 'else' };
    if (v === 'END IF') return { k: 'end-if' };
    if ((m = v.match(EACH))) return { k: 'open-each', alias: m[1] as string, list: m[2] as string, ...(m[3] ? { where: m[3].trim() } : {}) };
    if (v === 'END FOR EACH') return { k: 'end-each' };
  }
  if (r.bordered && text.startsWith(LABEL.note)) return pending({ t: 'note', id: '', text: inl(text.slice(LABEL.note.length).replace(/^\n/, '')) });
  if (r.bordered && text.startsWith(LABEL.zone)) {
    const [head, ...rest] = text.slice(LABEL.zone.length).split('\n');
    return pending({ t: 'zone', id: '', zone: (head as string).trim(), instructions: inl(rest.join('\n')) });
  }
  if (r.bordered && text.startsWith(LABEL.locked)) {
    const body = text.split('\n').slice(1).join('\n');
    return pending({ t: 'locked', id: '', kind: 'contracting_party', text: inl(body) });
  }
  const num = text.match(/^(\d+(?:\.\d+)+)\t([\s\S]*)$/);
  if (num) return pending({ t: 'clause', id: '', number: num[1] as string, text: inl(num[2] as string) });
  if (r.keepNext && r.bold && r.size === 23) {
    const h = text.match(/^(\d+)\s+(.*)$/);
    return pending({ t: 'heading', id: '', ...(h ? { number: h[1] as string } : {}), text: inl(h ? (h[2] as string) : text) });
  }
  let style: ParaStyle = 'body';
  if (r.center) style = r.bold ? 'title' : 'subtitle';
  else if (text.startsWith('☐')) style = 'check';
  else if (r.numbered) style = 'bullet';
  else if (/^_{10,}$/.test(text.trim())) style = 'signature';
  const t = style === 'check' ? text.replace(/^☐\s*/, '') : text;
  return pending({ t: 'para', id: '', style, text: inl(t) });
}

// Nest the flat item list into blocks.
function nest(items: Item[]): { blocks: Block[]; bookmarks: Map<Block, string[]> } {
  const bookmarks = new Map<Block, string[]>();
  let i = 0;
  function seq(stops: string[]): Block[] {
    const out: Block[] = [];
    while (i < items.length) {
      const it = items[i] as Item;
      if (stops.includes(it.k)) return out;
      i++;
      if (it.k === 'block') {
        bookmarks.set(it.b, it.bookmarks);
        out.push(it.b);
      } else if (it.k === 'open-if') {
        const then = seq(['else', 'end-if']);
        let els: Block[] | undefined;
        if (items[i]?.k === 'else') {
          i++;
          els = seq(['end-if']);
        }
        if (items[i]?.k !== 'end-if') throw new Error('unclosed IF ' + it.cond);
        i++;
        out.push({ t: 'if', cond: it.cond, then, ...(els ? { else: els } : {}) });
      } else if (it.k === 'open-each') {
        const body = seq(['end-each']);
        if (items[i]?.k !== 'end-each') throw new Error('unclosed FOR EACH ' + it.list);
        i++;
        out.push({ t: 'each', alias: it.alias, list: it.list, ...(it.where ? { where: it.where } : {}), body });
      } else {
        throw new Error('unexpected ' + it.k);
      }
    }
    return out;
  }
  const blocks = seq([]);
  if (i < items.length) throw new Error('unbalanced block at item ' + i);
  return { blocks, bookmarks };
}

// ---------- ids ----------

export const BOOKMARK_PREFIX = 'dsc_';

// Blocks that carried a docsmart bookmark already used earlier in the document (a pasted
// copy), mapped to that id. reconcile() uses this to decide which copy keeps the id.
export const duplicateOf = new WeakMap<object, string>();

// Ids come from docsmart bookmarks when present; otherwise from a hash of the template,
// the block's kind and its text, with a counter for repeats. Duplicate bookmarks (a pasted
// copy of a clause) keep the first occurrence's id; later copies get a new one.
function assignIds(template: string, blocks: Block[], bookmarks: Map<Block, string[]>) {
  const used = new Set<string>();
  const seen = new Map<string, number>();
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === 'if') {
        walk(b.then);
        if (b.else) walk(b.else);
        continue;
      }
      if (b.t === 'each') {
        walk(b.body);
        continue;
      }
      const marked = (bookmarks.get(b) ?? []).find((n) => n.startsWith(BOOKMARK_PREFIX));
      const fromMark = marked?.slice(BOOKMARK_PREFIX.length);
      if (fromMark && !used.has(fromMark)) {
        b.id = fromMark;
      } else {
        if (fromMark) duplicateOf.set(b, fromMark);
        const basis = template + '|' + b.t + '|' + JSON.stringify(b.t === 'zone' ? b.zone : 'text' in b ? b.text : b.t === 'table' ? b.rows : '');
        const n = (seen.get(basis) ?? 0) + 1;
        seen.set(basis, n);
        let id = createHash('sha256').update(basis + '|' + n).digest('hex').slice(0, 10);
        while (used.has(id)) id = createHash('sha256').update(id).digest('hex').slice(0, 10);
        b.id = id;
      }
      used.add(b.id);
    }
  };
  walk(blocks);
}

export async function importDocx(docx: Buffer, template: string): Promise<TemplateTree> {
  const raw = await readRaw(docx);
  // The cover page (when, who signs, questions for counsel) ends at the first page break.
  const coverEnd = raw.findIndex((r) => r.kind === 'p' && r.pageBreak);
  const bodyRaw = raw.slice(coverEnd + 1).filter((r) => !(r.kind === 'p' && r.text.trim() === '' && r.bookmarks.length === 0));
  const { blocks, bookmarks } = nest(bodyRaw.map((r) => classify(r)));
  assignIds(template, blocks, bookmarks);
  return { format: 'docsmart.clause-tree/0', template, body: blocks };
}

export async function importFile(path: string, template: string) {
  return importDocx(readFileSync(path), template);
}
