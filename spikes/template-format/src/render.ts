// Clause tree → Word, using the generator's helpers (the docx library, decision 0006), with
// each block's id written as a hidden bookmark so it survives a trip through Word.
import { mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { BOOKMARK_PREFIX } from './import-docx.ts';
import type { Block, Inline, TemplateTree } from './tree.ts';

const require = createRequire(import.meta.url);
const gen = path.resolve(import.meta.dirname, '../../../templates/generator');
const L = require(path.join(gen, 'lib.js'));
const JSZip = require('jszip');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');

const opts = { preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', trimValues: false, parseTagValue: false, parseAttributeValue: false, suppressEmptyNode: true };
export const xmlParser = new XMLParser(opts);
export const xmlBuilder = new XMLBuilder(opts);

// Inline tree → the template markup it came from.
export function markup(xs: Inline[]): string {
  return xs
    .map((x) => {
      switch (x.t) {
        case 'text':
        case 'raw':
          return x.v;
        case 'slot':
          return `{{${x.name}}}`;
        case 'if':
          return `[[IF ${x.cond}]]${markup(x.then)}${x.else ? `[[ELSE]]${markup(x.else)}` : ''}[[END IF]]`;
        case 'each':
          return `[[FOR EACH ${x.alias} IN ${x.list}${x.where ? ` WHERE ${x.where}` : ''}]]${markup(x.body)}[[END FOR EACH]]`;
      }
    })
    .join('');
}

type El = { el: unknown; id?: string };

function emit(blocks: Block[], out: El[]) {
  const push = (el: unknown, id?: string) => out.push(id ? { el, id } : { el });
  for (const b of blocks) {
    switch (b.t) {
      case 'if':
        push(L.COND(`[[IF ${b.cond}]]`));
        emit(b.then, out);
        if (b.else) {
          push(L.COND('[[ELSE]]'));
          emit(b.else, out);
        }
        push(L.COND('[[END IF]]'));
        break;
      case 'each':
        push(L.COND(`[[FOR EACH ${b.alias} IN ${b.list}${b.where ? ` WHERE ${b.where}` : ''}]]`));
        emit(b.body, out);
        push(L.COND('[[END FOR EACH]]'));
        break;
      case 'heading':
        push(L.H((b.number ? `${b.number} ` : '') + markup(b.text)), b.id);
        break;
      case 'clause':
        push(L.P(`${b.number} ${markup(b.text)}`, 1), b.id);
        break;
      case 'para': {
        const m = markup(b.text);
        const el =
          b.style === 'title' ? L.T(m) : b.style === 'subtitle' ? L.ST(m) : b.style === 'bullet' ? L.BUL([m])[0] : b.style === 'check' ? L.CHECK([m])[0] : L.P(m);
        push(el, b.id);
        break;
      }
      case 'note':
        push(L.N(markup(b.text)), b.id);
        break;
      case 'zone':
        push(L.AI(b.zone, markup(b.instructions)), b.id);
        break;
      case 'locked':
        push(L.LOCK(markup(b.text)), b.id);
        break;
      case 'table': {
        const n = Math.max(...b.rows.map((r) => r.cells.length));
        const w = Math.floor(L.W / n);
        const rows = b.rows.map((r) => {
          const cells = r.cells.map((c) => markup(c));
          if (r.t === 'each_row') {
            const open = `[[FOR EACH ${r.alias} IN ${r.list}${r.where ? ` WHERE ${r.where}` : ''}]] `;
            cells[0] = open + cells[0];
            cells[cells.length - 1] = cells[cells.length - 1] + ' [[END FOR EACH]]';
          }
          return cells.map((c) => (c.includes('\n') ? c.split('\n') : c));
        });
        push(L.TABLE(rows, Array(n).fill(w)), b.id);
        break;
      }
    }
  }
}

const tagOf = (n: Record<string, unknown>) => Object.keys(n).find((k) => k !== ':@') ?? '';

function bookmark(id: string, n: number) {
  return [
    { 'w:bookmarkStart': [], ':@': { 'w:id': String(n), 'w:name': BOOKMARK_PREFIX + id } },
    { 'w:bookmarkEnd': [], ':@': { 'w:id': String(n) } },
  ];
}

// Put a bookmark at the start of a paragraph (after its properties).
function markParagraph(p: Record<string, unknown>, id: string, n: number) {
  const kids = p['w:p'] as Record<string, unknown>[];
  const at = kids.length && tagOf(kids[0] as Record<string, unknown>) === 'w:pPr' ? 1 : 0;
  kids.splice(at, 0, ...bookmark(id, n));
}

export async function renderDocx(tree: TemplateTree, meta: Record<string, unknown>): Promise<Buffer> {
  const els: El[] = [];
  emit(tree.body, els);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'spike-render-'));
  const file: string = await L.build({ ...meta, file: 'out.docx' }, els.map((e) => e.el), dir);
  const zip = await JSZip.loadAsync(readFileSync(file));
  const doc = xmlParser.parse(await zip.file('word/document.xml').async('string'));
  const document = doc.find((n: Record<string, unknown>) => tagOf(n) === 'w:document');
  const body = (document['w:document'] as Record<string, unknown>[]).find((n) => tagOf(n) === 'w:body') as Record<string, unknown>;
  const children = (body['w:body'] as Record<string, unknown>[]).filter((n) => ['w:p', 'w:tbl'].includes(tagOf(n)));
  // The body elements are the last els.length paragraphs and tables; the cover comes first.
  const start = children.length - els.length;
  let n = 1000;
  els.forEach((e, i) => {
    if (!e.id) return;
    const node = children[start + i] as Record<string, unknown>;
    if (tagOf(node) === 'w:p') markParagraph(node, e.id, n++);
    else {
      // Tables: bookmark the first paragraph of the first cell.
      const tr = (node['w:tbl'] as Record<string, unknown>[]).find((c) => tagOf(c) === 'w:tr') as Record<string, unknown>;
      const tc = (tr['w:tr'] as Record<string, unknown>[]).find((c) => tagOf(c) === 'w:tc') as Record<string, unknown>;
      const p = (tc['w:tc'] as Record<string, unknown>[]).find((c) => tagOf(c) === 'w:p') as Record<string, unknown>;
      markParagraph(p, e.id, n++);
    }
  });
  zip.file('word/document.xml', xmlBuilder.build(doc));
  return zip.generateAsync({ type: 'nodebuffer' });
}
