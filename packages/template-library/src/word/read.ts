/**
 * Reads a Word file into paragraphs and tables, with the text Word would show, the bookmarks, the
 * heading level from styles and the number from automatic numbering. Refuses tracked changes
 * (decision 0010).
 */
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { ImportFailure, type ImportProblem } from './problems.js';

type Node = Record<string, unknown>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

const tagOf = (n: Node) => Object.keys(n).find((k) => k !== ':@') ?? '';
const kids = (n: Node): Node[] => (n[tagOf(n)] as Node[] | undefined) ?? [];
const attr = (n: Node | undefined, name: string): string | undefined =>
  (n?.[':@'] as Record<string, string> | undefined)?.[name];
const child = (n: Node | undefined, tag: string) => (n ? kids(n).find((c) => tagOf(c) === tag) : undefined);
const children = (n: Node, tag: string) => kids(n).filter((c) => tagOf(c) === tag);
const val = (n: Node | undefined, tag: string) => attr(child(n, tag), 'w:val');

export interface WordParagraph {
  kind: 'p';
  /** Position in the document body, from 1, for error messages. */
  index: number;
  text: string;
  bookmarks: string[];
  /** From a heading style or an outline level. */
  heading_level?: number;
  /** Paragraph style name, e.g. "Title". */
  style_name?: string;
  /** The number Word shows from automatic numbering, e.g. "2.1". */
  number?: string;
  /** Automatic numbering in a bullet format. */
  bullet: boolean;
  center: boolean;
  bold: boolean;
  size?: number;
  keep_next: boolean;
  bordered: boolean;
  page_break: boolean;
}

export interface WordTable {
  kind: 'tbl';
  index: number;
  /** Cell texts; a cell's paragraphs are joined with a line break. */
  rows: string[][];
  bookmarks: string[];
}

export type WordBlock = WordParagraph | WordTable;

/** A short description of a place in the document, for problems. */
export function where(b: WordBlock): string {
  const text = b.kind === 'p' ? b.text : (b.rows[0]?.join(' | ') ?? '');
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 50);
  return `${b.kind === 'p' ? 'paragraph' : 'table'} ${b.index}${snippet ? ` (“${snippet}${text.length > 50 ? '…' : ''}”)` : ''}`;
}

// ---------- styles ----------

interface Style {
  name?: string;
  basedOn?: string;
  numId?: string;
  ilvl?: string;
  outlineLvl?: number;
  center?: boolean;
}

function readStyles(xml: string | undefined): Map<string, Style> {
  const styles = new Map<string, Style>();
  if (!xml) return styles;
  const root = (parser.parse(xml) as Node[]).find((n) => tagOf(n) === 'w:styles');
  for (const s of root ? children(root, 'w:style') : []) {
    const id = attr(s, 'w:styleId');
    if (!id) continue;
    const ppr = child(s, 'w:pPr');
    const numPr = child(ppr, 'w:numPr');
    const outline = val(ppr, 'w:outlineLvl');
    const st: Style = {};
    const name = val(s, 'w:name');
    const basedOn = val(s, 'w:basedOn');
    const numId = val(numPr, 'w:numId');
    const ilvl = val(numPr, 'w:ilvl');
    if (name) st.name = name;
    if (basedOn) st.basedOn = basedOn;
    if (numId) st.numId = numId;
    if (ilvl) st.ilvl = ilvl;
    if (outline !== undefined) st.outlineLvl = Number(outline);
    if (val(ppr, 'w:jc') === 'center') st.center = true;
    styles.set(id, st);
  }
  return styles;
}

/** A style property, looked up through the basedOn chain. */
function styleProp<K extends keyof Style>(
  styles: Map<string, Style>,
  id: string | undefined,
  key: K,
): Style[K] | undefined {
  for (let i = 0, s = id; s && i < 20; i++) {
    const st = styles.get(s);
    if (!st) return undefined;
    if (st[key] !== undefined) return st[key];
    s = st.basedOn;
  }
  return undefined;
}

// ---------- numbering ----------

interface Level {
  start: number;
  format: string;
  text: string;
}

class Numbering {
  private abstracts = new Map<string, Map<number, Level>>();
  private nums = new Map<string, { abstract: string; starts: Map<number, number> }>();
  private counters = new Map<string, Array<number | undefined>>();
  private started = new Set<string>();

  constructor(xml: string | undefined) {
    if (!xml) return;
    const root = (parser.parse(xml) as Node[]).find((n) => tagOf(n) === 'w:numbering');
    if (!root) return;
    for (const a of children(root, 'w:abstractNum')) {
      const levels = new Map<number, Level>();
      for (const l of children(a, 'w:lvl')) {
        levels.set(Number(attr(l, 'w:ilvl')), {
          start: Number(val(l, 'w:start') ?? '1'),
          format: val(l, 'w:numFmt') ?? 'decimal',
          text: val(l, 'w:lvlText') ?? '',
        });
      }
      this.abstracts.set(attr(a, 'w:abstractNumId') ?? '', levels);
    }
    for (const n of children(root, 'w:num')) {
      const starts = new Map<number, number>();
      for (const o of children(n, 'w:lvlOverride')) {
        const s = val(o, 'w:startOverride');
        if (s !== undefined) starts.set(Number(attr(o, 'w:ilvl')), Number(s));
      }
      this.nums.set(attr(n, 'w:numId') ?? '', { abstract: val(n, 'w:abstractNumId') ?? '', starts });
    }
  }

  /** Advances the list and returns what Word shows, or "bullet". Lists sharing an abstract definition share counters. */
  next(numId: string, ilvl: number): string | 'bullet' | undefined {
    const num = this.nums.get(numId);
    const levels = num && this.abstracts.get(num.abstract);
    const level = levels?.get(ilvl);
    if (!num || !levels || !level) return undefined;
    if (level.format === 'bullet') return 'bullet';
    const counters = this.counters.get(num.abstract) ?? Array<number | undefined>(9).fill(undefined);
    if (!this.started.has(numId)) {
      // A list instance with a start override restarts those levels.
      for (const [l, s] of num.starts) counters[l] = s - 1;
      this.started.add(numId);
    }
    counters[ilvl] = (counters[ilvl] ?? level.start - 1) + 1;
    for (let deeper = ilvl + 1; deeper < 9; deeper++) counters[deeper] = undefined;
    this.counters.set(num.abstract, counters);
    return level.text.replace(/%([1-9])/g, (_, d: string) => {
      const l = Number(d) - 1;
      const lv = levels.get(l);
      return format(counters[l] ?? lv?.start ?? 1, lv?.format ?? 'decimal');
    });
  }
}

function format(n: number, fmt: string): string {
  switch (fmt) {
    case 'lowerLetter':
      return letters(n);
    case 'upperLetter':
      return letters(n).toUpperCase();
    case 'lowerRoman':
      return roman(n).toLowerCase();
    case 'upperRoman':
      return roman(n);
    case 'decimalZero':
      return String(n).padStart(2, '0');
    case 'none':
      return '';
    default:
      return String(n);
  }
}
// Word repeats the letter: a … z, aa … zz.
const letters = (n: number) => String.fromCharCode(97 + ((n - 1) % 26)).repeat(Math.floor((n - 1) / 26) + 1);
function roman(n: number): string {
  const table: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of table)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
}

// ---------- document ----------

const TRACKED = new Set(['w:ins', 'w:del', 'w:moveFrom', 'w:moveTo']);
const CONTAINERS = new Set([
  'w:hyperlink',
  'w:smartTag',
  'w:customXml',
  'w:fldSimple',
  'w:sdtContent',
  'w:dir',
  'w:bdo',
]);

export async function readWord(docx: Uint8Array): Promise<WordBlock[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(docx);
  } catch {
    throw new ImportFailure([{ code: 'not_word', at: 'file', message: 'The file is not a Word document.' }]);
  }
  const part = (name: string) => zip.file(name)?.async('string');
  const documentXml = await part('word/document.xml');
  if (!documentXml)
    throw new ImportFailure([{ code: 'not_word', at: 'file', message: 'The file has no word/document.xml.' }]);
  const styles = readStyles(await part('word/styles.xml'));
  const numbering = new Numbering(await part('word/numbering.xml'));
  const root = (parser.parse(documentXml) as Node[]).find((n) => tagOf(n) === 'w:document');
  const body = child(root, 'w:body');
  if (!body) throw new ImportFailure([{ code: 'not_word', at: 'file', message: 'The document has no body.' }]);

  const problems: ImportProblem[] = [];
  const out: WordBlock[] = [];
  let index = 0;

  function paragraph(p: Node, inTable: boolean): WordParagraph {
    const ppr = child(p, 'w:pPr');
    const r: WordParagraph = {
      kind: 'p',
      index: inTable ? index : ++index,
      text: '',
      bookmarks: [],
      bullet: false,
      center: false,
      bold: false,
      keep_next: !!child(ppr, 'w:keepNext'),
      bordered: !!child(ppr, 'w:pBdr'),
      page_break: false,
    };
    let anyText = false;
    let allBold = true;
    let tracked = false;
    const runs = (nodes: Node[]) => {
      for (const c of nodes) {
        const tag = tagOf(c);
        if (TRACKED.has(tag)) tracked = true;
        else if (tag === 'w:bookmarkStart') r.bookmarks.push(attr(c, 'w:name') ?? '');
        else if (tag === 'w:sdt') runs(kids(child(c, 'w:sdtContent') ?? {}));
        else if (CONTAINERS.has(tag)) runs(kids(c));
        else if (tag === 'w:r') {
          const rpr = child(c, 'w:rPr');
          const bold = !!child(rpr, 'w:b') && val(rpr, 'w:b') !== '0' && val(rpr, 'w:b') !== 'false';
          for (const x of kids(c)) {
            const xt = tagOf(x);
            if (xt === 'w:t') {
              const s = kids(x)
                .map((y) => String(y['#text'] ?? ''))
                .join('');
              if (s.trim()) {
                anyText = true;
                if (!bold) allBold = false;
                const sz = val(rpr, 'w:sz');
                if (sz && r.size === undefined) r.size = Number(sz);
              }
              r.text += s;
            } else if (xt === 'w:tab') r.text += '\t';
            else if (xt === 'w:br' || xt === 'w:cr') {
              if (attr(x, 'w:type') === 'page') r.page_break = true;
              else r.text += '\n';
            } else if (xt === 'w:noBreakHyphen') r.text += '-';
          }
        }
      }
    };
    runs(kids(p));
    // An inserted or deleted paragraph mark is a tracked change too.
    const markRpr = child(ppr, 'w:rPr');
    if (markRpr && kids(markRpr).some((x) => TRACKED.has(tagOf(x)))) tracked = true;
    r.bold = anyText && allBold;

    const styleId = val(ppr, 'w:pStyle');
    const name = styleProp(styles, styleId, 'name');
    if (name) r.style_name = name;
    const heading = name?.match(/^heading ([1-9])$/i);
    const outline = val(ppr, 'w:outlineLvl') ?? styleProp(styles, styleId, 'outlineLvl');
    if (heading) r.heading_level = Number(heading[1]);
    else if (outline !== undefined && Number(outline) < 9) r.heading_level = Number(outline) + 1;
    r.center =
      val(ppr, 'w:jc') === 'center' || (val(ppr, 'w:jc') === undefined && !!styleProp(styles, styleId, 'center'));

    const numPr = child(ppr, 'w:numPr');
    const numId = val(numPr, 'w:numId') ?? styleProp(styles, styleId, 'numId');
    const ilvl = Number(val(numPr, 'w:ilvl') ?? styleProp(styles, styleId, 'ilvl') ?? '0');
    if (numId && numId !== '0') {
      const n = numbering.next(numId, ilvl);
      if (n === 'bullet') r.bullet = true;
      else if (n) r.number = n.trim();
    }
    if (tracked) {
      problems.push({
        code: 'tracked_change',
        at: where(r),
        message: 'Has tracked changes. Accept or reject them in Word, then upload again.',
      });
    }
    return r;
  }

  function table(t: Node): WordTable {
    const w: WordTable = { kind: 'tbl', index: ++index, rows: [], bookmarks: [] };
    for (const tr of children(t, 'w:tr')) {
      const row: string[] = [];
      for (const tc of children(tr, 'w:tc')) {
        if (children(tc, 'w:tbl').length) {
          problems.push({
            code: 'nested_table',
            at: where(w),
            message: 'Has a table inside a table, which templates cannot use.',
          });
        }
        const paras = children(tc, 'w:p').map((p) => paragraph(p, true));
        for (const p of paras) w.bookmarks.push(...p.bookmarks);
        row.push(paras.map((p) => p.text).join('\n'));
      }
      w.rows.push(row);
    }
    return w;
  }

  const walk = (nodes: Node[]) => {
    for (const c of nodes) {
      const tag = tagOf(c);
      if (tag === 'w:p') out.push(paragraph(c, false));
      else if (tag === 'w:tbl') out.push(table(c));
      else if (tag === 'w:sdt') walk(kids(child(c, 'w:sdtContent') ?? {}));
      else if (tag === 'w:customXml') walk(kids(c));
      else if (TRACKED.has(tag)) {
        problems.push({
          code: 'tracked_change',
          at: `after ${out.length ? where(out[out.length - 1] as WordBlock) : 'the start'}`,
          message: 'Has tracked changes. Accept or reject them in Word, then upload again.',
        });
      }
    }
  };
  walk(kids(body));
  if (problems.length) throw new ImportFailure(problems);
  return out;
}
