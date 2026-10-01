// C13 (criterion 3, time-boxed): Word import and a deterministic hash for TemplateMark.
// 1. Is the serialised TemplateMark DOM deterministic (same input, same canonical JSON hash)?
// 2. Does any Accord package convert Word to TemplateMark/CiceroMark? The only candidate is
//    @accordproject/markdown-docx 0.16.26, marked deprecated "Not maintained" on npm. It is
//    installed only in the scratch directory (npm install --ignore-scripts), never in the repo.
// Run: node src/validation/c13-criterion3.ts
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parse, save, SCRATCH, TemplateMarkTransformer } from './harness.ts';

const require = createRequire(import.meta.url);
const canonMod = require('canonicalize');
const canonicalize = (canonMod.default ?? canonMod) as (v: unknown) => string;
const hash = (v: unknown) => createHash('sha256').update(canonicalize(v)).digest('hex');
const out: Record<string, unknown> = {};

const CTO = `namespace org.docsmart.v@1.0.0\nconcept Umbrella { o String legal_name }\n@template\nconcept D { o Umbrella umbrella  o Boolean flag }`;
const md = '# Title\n\n{{#with umbrella}}The Company is {{legal_name}}.{{/with}}{{#if flag}} Yes.{{/if}}\n\n<!-- COUNSEL NOTE: x -->\n\n- a\n- b';
const h1 = hash(parse(CTO, md).dom);
const h2 = hash(parse(CTO, md).dom);
const back = new TemplateMarkTransformer().toMarkdownTemplate(parse(CTO, md).dom);
const h3 = hash(parse(CTO, back).dom);
out.domHash = { first: h1, second: h2, same: h1 === h2, afterMarkdownRoundTrip: h3, sameAfterRoundTrip: h1 === h3 };
console.log(`1. same markdown parsed twice gives the same DOM hash: ${h1 === h2} (${h1.slice(0, 12)}); after DOM -> markdown -> DOM: ${h1 === h3}`);

const docxPkg = path.join(SCRATCH, 'c13/node_modules/@accordproject/markdown-docx');
if (!existsSync(docxPkg)) {
  console.log('2. markdown-docx is not installed in the scratch directory; step skipped');
  out.docx = 'skipped: not installed';
} else {
  const sreq = createRequire(path.join(SCRATCH, 'c13/package.json'));
  const { DocxTransformer } = sreq('@accordproject/markdown-docx');
  const version = sreq('@accordproject/markdown-docx/package.json').version;
  const root = path.resolve(import.meta.dirname, '../../../..');
  const res: Record<string, unknown> = { version };
  for (const f of ['D12-B_Creation_Resolution_Written_Sponsor_Asset.docx', 'D13-B_Supplement_Sponsor_Secondary.docx']) {
    const buf = readFileSync(path.join(root, 'templates/first-pass', f));
    const a = await new DocxTransformer().toCiceroMark(buf, 'json');
    const b = await new DocxTransformer().toCiceroMark(buf, 'json');
    const s = JSON.stringify(a);
    const r = {
      sameHashTwice: hash(a) === hash(b),
      nodes: (s.match(/\$class/g) ?? []).length,
      tables: (s.match(/\.Table"/g) ?? []).length,
      templateNodes: (s.match(/templatemark@/g) ?? []).length,
      literalFieldTokens: (s.match(/\{\{/g) ?? []).length,
      literalBlockTokens: (s.match(/\[\[/g) ?? []).length,
      bookmarks: /dsc_/.test(s),
    };
    res[f] = r;
    console.log(`2. markdown-docx ${version} on ${f}: ${JSON.stringify(r)}`);
  }
  out.docx = res;
}
save('c13-criterion3', out);
