// Builds small Word files for tests with the docx library (decision 0006).
import {
  AlignmentType,
  Bookmark,
  DeletedTextRun,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  InsertedTextRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';

export {
  AlignmentType,
  Bookmark,
  DeletedTextRun,
  ExternalHyperlink,
  HeadingLevel,
  InsertedTextRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
};

export const NUMBERING = {
  config: [
    {
      reference: 'legal',
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', start: 1 },
        { level: 1, format: LevelFormat.DECIMAL, text: '%1.%2', start: 1 },
        { level: 2, format: LevelFormat.LOWER_LETTER, text: '(%3)', start: 1 },
        { level: 3, format: LevelFormat.LOWER_ROMAN, text: '(%4)', start: 1 },
      ],
    },
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•' }] },
  ],
};

export async function word(children: Array<Paragraph | Table>): Promise<Uint8Array> {
  const doc = new Document({ numbering: NUMBERING, sections: [{ children }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

export const p = (text: string) => new Paragraph({ children: [new TextRun(text)] });
export const heading = (text: string, level: 1 | 2 = 1) =>
  new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    children: [new TextRun(text)],
  });
export const numbered = (text: string, level: number, instance?: number) =>
  new Paragraph({
    numbering: { reference: 'legal', level, ...(instance ? { instance } : {}) },
    children: [new TextRun(text)],
  });
export const bullet = (text: string) =>
  new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun(text)] });
/** A paragraph carrying a bookmark, as the renderer writes them (decision 0008). */
export const marked = (bookmark: string, text: string) =>
  new Paragraph({ children: [new Bookmark({ id: bookmark, children: [new TextRun(text)] })] });
export const table = (rows: string[][]) =>
  new Table({ rows: rows.map((r) => new TableRow({ children: r.map((c) => new TableCell({ children: [p(c)] })) })) });
