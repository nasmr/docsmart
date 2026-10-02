/**
 * Assembled document → Word (decision 0006), with each block's id as a hidden bookmark so ids survive
 * counsel's edits (decision 0008). The Word file is for people to read; the content hash is taken over
 * the assembled content, not over this file.
 */
import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import JSZip from 'jszip';
import type { AssembledBlock, AssembledDocument, Piece } from './assembled.js';

/** Word limits bookmark names to 40 characters. */
const BOOKMARK_MAX = 40;
export const BOOKMARK_PREFIX = 'dsc_';

const SERIF = 'Georgia';
const SANS = 'Arial';
const BODY = 21; // 10.5pt, as the first-pass templates
const WIDTH = 9026; // A4 text width at 1" margins

// The box labels are the template conventions (templates/README.md), so the template importer can
// read an assembled document back, as the counsel slice will need.
const LOCKED_LABEL = 'LOCKED · CONTRACTING PARTY · generated from the registry, cannot be edited';
const ZONE_LABEL = 'AI-DRAFTED ZONE · ';

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
  }
}

function runs(
  pieces: readonly Piece[],
  base: { bold?: boolean; size?: number; font?: string; color?: string } = {},
): TextRun[] {
  const font = base.font ?? SERIF;
  const size = base.size ?? BODY;
  return pieces.map((p) => {
    if (p.t === 'blank') return new TextRun({ text: '____________', font, size });
    if (p.t === 'missing')
      return new TextRun({ text: `[missing: ${p.field}]`, font, size, bold: true, color: 'A63D2F' });
    return new TextRun({
      text: p.v,
      font,
      size,
      ...(base.bold ? { bold: true } : {}),
      ...(base.color ? { color: base.color } : {}),
    });
  });
}

/** Wraps a paragraph's runs in the block's bookmark. */
function marked(id: string, children: TextRun[]): Array<TextRun | Bookmark> {
  const name = BOOKMARK_PREFIX + id;
  if (name.length > BOOKMARK_MAX) throw new RenderError(`Block id ${id} is too long for a Word bookmark.`);
  return [new Bookmark({ id: name, children: children.length ? children : [new TextRun('')] })];
}

function box(label: string, id: string, pieces: Piece[], fill: string, line: string): Paragraph {
  const border = { style: BorderStyle.SINGLE, size: 8, color: line, space: 6 };
  return new Paragraph({
    spacing: { before: 120, after: 160 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill },
    border: { top: border, left: border, bottom: border, right: border },
    children: marked(id, [
      new TextRun({ text: label, font: SANS, size: 16, bold: true }),
      new TextRun({ break: 1 }),
      ...runs(pieces, { bold: true }),
    ]),
  });
}

function block(b: AssembledBlock): Paragraph | Table {
  const numbered = (number: string | undefined, pieces: Piece[], bold = false) => [
    ...(number
      ? [
          new TextRun({ text: number, font: SERIF, size: bold ? 23 : BODY, bold }),
          new TextRun({ text: '\t', font: SERIF }),
        ]
      : []),
    ...runs(pieces, bold ? { bold: true, size: 23 } : {}),
  ];
  switch (b.t) {
    case 'heading':
      return new Paragraph({
        heading:
          [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][Math.min(b.level, 3) - 1] ??
          HeadingLevel.HEADING_3,
        keepNext: true,
        spacing: { before: 240, after: 100 },
        children: marked(b.id, numbered(b.number, b.text, true)),
      });
    case 'clause':
      return new Paragraph({
        spacing: { after: 120, line: 300 },
        indent: { left: 709, hanging: 709 },
        tabStops: [{ type: 'left', position: 709 }],
        children: marked(b.id, numbered(b.number, b.text)),
      });
    case 'para':
      if (b.style === 'title')
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: marked(b.id, runs(b.text, { bold: true, size: 28 })),
        });
      if (b.style === 'subtitle')
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: marked(b.id, runs(b.text, { size: 20, color: '505A63' })),
        });
      if (b.style === 'bullet')
        return new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          spacing: { after: 80 },
          children: marked(b.id, runs(b.text)),
        });
      if (b.style === 'check')
        return new Paragraph({
          spacing: { after: 100 },
          children: marked(b.id, [new TextRun({ text: '☐  ', font: SERIF, size: BODY }), ...runs(b.text)]),
        });
      return new Paragraph({ spacing: { after: 120, line: 300 }, children: marked(b.id, runs(b.text)) });
    case 'table': {
      const columns = Math.max(...b.rows.map((r) => r.length));
      const width = Math.floor(WIDTH / columns);
      return new Table({
        width: { size: WIDTH, type: WidthType.DXA },
        columnWidths: Array(columns).fill(width),
        rows: b.rows.map(
          (row, i) =>
            new TableRow({
              children: row.map(
                (cell, j) =>
                  new TableCell({
                    width: { size: width, type: WidthType.DXA },
                    children: [new Paragraph({ children: i === 0 && j === 0 ? marked(b.id, runs(cell)) : runs(cell) })],
                  }),
              ),
            }),
        ),
      });
    }
    case 'zone':
      // Empty until drafted (build plan B8); the label says so.
      return box(
        `${ZONE_LABEL}${b.zone}`,
        b.id,
        b.text.length ? b.text : [{ t: 'text', v: 'Not yet drafted.' }],
        'E3ECF7',
        '2F5D9E',
      );
    case 'locked':
      return box(LOCKED_LABEL, b.id, b.text, 'EEF0EC', '1A1F24');
  }
}

export async function renderWord(doc: AssembledDocument): Promise<Uint8Array> {
  const banner = `${doc.template} · draft for review · not legal advice`;
  const word = new Document({
    creator: 'Singularity Document Factory',
    title: `${doc.template} ${doc.document_id}`,
    styles: { default: { document: { run: { font: SERIF, size: BODY } } } },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: banner, font: SANS, size: 15, color: '505A63' })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Page ', font: SANS, size: 15 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 15 }),
                  new TextRun({ text: ' of ', font: SANS, size: 15 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: SANS, size: 15 }),
                ],
              }),
            ],
          }),
        },
        children: doc.body.map(block),
      },
    ],
  });
  return stableBookmarks(new Uint8Array(await Packer.toBuffer(word)));
}

/**
 * The docx library numbers bookmarks from a counter shared by every document in the process, so a
 * second render would number them differently. Renumber from 1 in document order, so the same
 * document always renders the same body. (docProps/core.xml still records the time of rendering.)
 */
async function stableBookmarks(docx: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(docx);
  const part = zip.file('word/document.xml');
  if (!part) throw new RenderError('The rendered file has no document part.');
  const ids = new Map<string, string>();
  const xml = (await part.async('string')).replace(
    /(<w:bookmark(?:Start|End)\b[^>]*\bw:id=")(\d+)"/g,
    (_, head: string, id: string) => {
      if (!ids.has(id)) ids.set(id, String(ids.size + 1));
      return `${head}${ids.get(id)}"`;
    },
  );
  zip.file('word/document.xml', xml);
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
}
