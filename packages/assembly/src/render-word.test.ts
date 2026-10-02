import { idBlocks, importWord } from '@docsmart/template-library';
import JSZip from 'jszip';
import { describe, expect, test } from 'vitest';
import { assemble } from './assemble.js';
import { renderWord } from './render-word.js';
import { ATLAS_INVESTORS, FIXTURE_DOCUMENTS, input } from './test/fixtures.js';

async function parts(docx: Uint8Array) {
  const zip = await JSZip.loadAsync(docx);
  const xml = async (name: string) => (await zip.file(name)?.async('string')) ?? '';
  const document = await xml('word/document.xml');
  const headers = (
    await Promise.all(
      Object.keys(zip.files)
        .filter((f) => /^word\/header\d*\.xml$/.test(f))
        .map(xml),
    )
  ).join('');
  const text = [...document.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  const bookmarks = [...document.matchAll(/w:name="dsc_([^"]+)"/g)].map((m) => m[1]);
  return { document, headers, text, bookmarks };
}

describe('Word rendering', () => {
  test('carries the assembled text, the designation and the draft banner', async () => {
    const r = assemble(await input('doc_lumen_d12'));
    const p = await parts(await renderWord(r.document));
    expect(p.text).toContain('for a total consideration not exceeding USD 3,000,000.00');
    expect(p.text).toContain('Meridian Horizon SPC Limited for and on behalf of Lumen Segregated Portfolio');
    expect(p.text).toContain('3.1');
    expect(p.headers).toContain('D12-A · draft for review · not legal advice');
  });

  test('writes every block id as a bookmark (decision 0008)', async () => {
    const r = assemble(await input('doc_atlas2_d12'));
    const p = await parts(await renderWord(r.document));
    expect(p.bookmarks).toEqual(r.document.body.map((b) => b.id));
  });

  test('the template importer reads the ids back from an assembled document', async () => {
    for (const id of ['doc_lumen_d12', 'doc_atlas_d13', 'doc_atlas2_d12']) {
      const r = assemble(await input(id));
      const back = await importWord(await renderWord(r.document), r.document.template);
      expect(
        [...idBlocks(back.tree.body)].map((b) => b.id),
        id,
      ).toEqual(r.document.body.map((b) => b.id));
    }
  });

  test('blanks print as signing lines, and a missing value prints as a marker, never as nothing', async () => {
    const i = await input('doc_lumen_d12');
    const portfolio = structuredClone(i.records.portfolio);
    if (!portfolio) throw new Error('fixture');
    delete (portfolio.portfolio as { share_class_name?: string }).share_class_name;
    const p = await parts(await renderWord(assemble({ ...i, records: { ...i.records, portfolio } }).document));
    expect(p.text).toContain('[missing: portfolio.share_class_name]');
    expect(p.text).toContain('Date: ____________');
  });

  test('AI zones say they are not yet drafted', async () => {
    const p = await parts(await renderWord(assemble(await input('doc_lumen_d13')).document));
    expect(p.text).toContain('AI-DRAFTED ZONE · issuer_descriptionNot yet drafted.');
  });

  test('the same document always renders the same body', async () => {
    const r = assemble(await input('doc_atlas_d12'));
    const [a, b] = [await parts(await renderWord(r.document)), await parts(await renderWord(r.document))];
    expect(a.document).toBe(b.document);
  });

  test('every fixture document and subscription agreement renders', async () => {
    for (const id of FIXTURE_DOCUMENTS)
      expect((await renderWord(assemble(await input(id)).document)).length).toBeGreaterThan(5000);
    for (const party of ATLAS_INVESTORS.slice(0, 5)) {
      expect((await renderWord(assemble(await input('batch_atlas_d1sp', { party })).document)).length).toBeGreaterThan(
        5000,
      );
    }
  });
});
