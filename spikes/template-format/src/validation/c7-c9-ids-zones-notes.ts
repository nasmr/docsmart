// C7: clause ids. C8: AI zone and locked designation. C9: counsel notes as HTML comments.
// For each id carrier: does the id survive parse, DOM serialisation, DOM -> markdown -> DOM,
// and generation?
// Run: node src/validation/c7-c9-ids-zones-notes.ts
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { generate, modelManager, parse, save, TemplateMarkTransformer, TemplateMarkInterpreter, firstLine } from './harness.ts';

const require = createRequire(import.meta.url);
const canonMod = require('canonicalize');
const canonicalize = (canonMod.default ?? canonMod) as (v: unknown) => string;
const hash = (v: unknown) => createHash('sha256').update(canonicalize(v)).digest('hex').slice(0, 16);

const NS = 'org.docsmart.v@1.0.0';
const CTO = `
namespace ${NS}
concept Umbrella { o String legal_name }
concept Portfolio { o String legal_name }
concept ClauseC21 { }
@Id("c_2_1")
concept Locked { o String umbrella_name  o String portfolio_name }
concept Zone { o String text }
@template
concept D {
  o Umbrella umbrella
  o Portfolio portfolio
  @ClauseId("c_2_1")
  o ClauseC21 c_2_1
  @Locked
  o Locked contracting_party
  @AiZone("issuer_description")
  o Zone issuer_description
}
`;
const data = {
  $class: `${NS}.D`,
  umbrella: { $class: `${NS}.Umbrella`, legal_name: 'Meridian Horizon SPC Limited' },
  portfolio: { $class: `${NS}.Portfolio`, legal_name: 'Atlas Segregated Portfolio' },
  c_2_1: { $class: `${NS}.ClauseC21` },
  contracting_party: { $class: `${NS}.Locked`, umbrella_name: 'Meridian Horizon SPC Limited', portfolio_name: 'Atlas Segregated Portfolio' },
  issuer_description: { $class: `${NS}.Zone`, text: 'Kestrel Grid Systems Limited designs grid-scale battery controllers.' },
};
const t = new TemplateMarkTransformer();
const results: Record<string, unknown> = {};

// Round trip: markdown -> DOM -> markdown -> DOM, then generate. Report where an id is visible.
async function trip(id: string, label: string, md: string, needle: RegExp, kind: 'contract' | 'clause' = 'contract') {
  const r: Record<string, unknown> = { label, kind };
  const p = parse(CTO, md, kind);
  r.parse = p.ok ? 'ok' : p.err;
  if (!p.ok) {
    console.log(`${id} ${label} [${kind}]: PARSE-ERR ${p.err}`);
    results[id + '/' + kind] = r;
    return;
  }
  r.idInDom = needle.test(JSON.stringify(p.dom));
  let md2 = '';
  try {
    md2 = t.toMarkdownTemplate(p.dom);
    r.idInMarkdownBack = needle.test(md2);
    const p2 = parse(CTO, md2, kind);
    r.reparse = p2.ok ? 'ok' : p2.err;
    r.domStable = p2.ok ? hash(p.dom) === hash(p2.dom) : false;
    r.md2 = md2;
  } catch (e) {
    r.toMarkdownTemplate = firstLine(e);
  }
  const g = await generate(CTO, p.dom, data);
  r.generate = g.ok ? 'ok' : g.err;
  r.idInOutput = g.ok ? needle.test(JSON.stringify(g.out)) : false;
  r.text = g.text;
  results[id + '/' + kind] = r;
  console.log(`${id} ${label} [${kind}]: parse ok, id in DOM ${r.idInDom}, md->DOM->md keeps id ${r.idInMarkdownBack}, reparse ${r.reparse}, DOM hash stable ${r.domStable}, generate ${r.generate === 'ok' ? 'ok' : 'ERR ' + r.generate}, id in output ${r.idInOutput}`);
  if (g.ok) console.log(`      text: ${JSON.stringify(g.text)}`);
}

// C7
await trip('C7.1', '#clause whose name is not a model property', '{{#clause c_9_9}}\nA segregated portfolio be created.\n{{/clause}}', /c_9_9/);
await trip('C7.1', '#clause whose name is not a model property', '{{#clause c_9_9}}\nA segregated portfolio be created.\n{{/clause}}', /c_9_9/, 'clause');
await trip('C7.2', '#clause over an empty concept property per clause', '{{#clause c_2_1}}\n2.1 A segregated portfolio of the Company be created.\n{{/clause}}', /c_2_1/);
await trip('C7.2b', '#clause per clause: root field inside it', '{{#clause c_2_1}}\n2.1 A portfolio of {{#with umbrella}}{{legal_name}}{{/with}} be created.\n{{/clause}}', /c_2_1/);
await trip('C7.3', 'id in an HTML comment before the paragraph', '<!-- id: c_2_1 -->\n2.1 A segregated portfolio of the Company be created.', /c_2_1/);
await trip('C7.3b', 'id in an inline HTML comment inside the paragraph', '2.1 <!-- id: c_2_1 -->A segregated portfolio of the Company be created.', /c_2_1/);
await trip('C7.4', 'id carried by heading text', '## 2 Creation of the Portfolio {#c_2}\n\nBody.', /c_2/);

// C7.5: decorators on the model property reach the DOM node of a #clause
{
  const p = parse(CTO, '{{#clause c_2_1}}\nText.\n{{/clause}}');
  const s = JSON.stringify(p.dom);
  const p2 = parse(CTO, '{{#clause contracting_party}}\n{{umbrella_name}}\n{{/clause}}');
  const s2 = JSON.stringify(p2.dom);
  const g = await generate(CTO, p2.dom, data);
  results['C7.5'] = { propertyDecoratorInDom: /ClauseId/.test(s), conceptDecoratorInDom: /"name":"Id"/.test(s2), conceptDecoratorInOutput: /"name":"Id"/.test(JSON.stringify(g.out)), conceptDecoratorArgInDom: /c_2_1/.test(s2) };
  console.log(`C7.5 decorators: on the property (@ClauseId) reaches the #clause node ${/ClauseId/.test(s)}; on the concept (@Id("c_2_1")) reaches the node ${/"name":"Id"/.test(s2)}, survives generation ${/"name":"Id"/.test(JSON.stringify(g.out))}`);
}

// C7.6: an extra id attribute on ordinary DOM nodes (paragraph, heading)
{
  const p = parse(CTO, '## Heading\n\nA paragraph.');
  const dom = structuredClone(p.dom);
  dom.nodes[0].nodes[0].id = 'h_1';
  dom.nodes[0].nodes[1].id = 'p_1';
  const r: Record<string, unknown> = {};
  try {
    const back = t.getSerializer().toJSON(t.getSerializer().fromJSON(dom));
    r.serialiser = 'accepted; id kept: ' + /p_1/.test(JSON.stringify(back));
  } catch (e) {
    r.serialiser = 'rejected: ' + firstLine(e);
  }
  try {
    r.toMarkdownTemplate = t.toMarkdownTemplate(dom);
  } catch (e) {
    r.toMarkdownTemplate = 'failed: ' + firstLine(e);
  }
  const g = await generate(CTO, dom, data);
  r.generate = g.ok ? 'ok; id in output ' + /p_1/.test(JSON.stringify(g.out)) : 'rejected: ' + g.err;
  results['C7.6'] = r;
  console.log('C7.6 extra "id" property on Paragraph/Heading DOM nodes:', JSON.stringify(r));
}

// C7.7: can a table carry an id? (#clause around a table)
await trip('C7.7', 'table inside a #clause', '{{#clause c_2_1}}\n| Term | Value |\n|---|---|\n| Name | Atlas |\n{{/clause}}', /c_2_1/);

// C8: AI zone and locked designation
await trip('C8.1', 'AI zone as a #clause over a Zone concept (text supplied as data)', '{{#clause issuer_description}}\n{{text}}\n{{/clause}}', /issuer_description/);
await trip('C8.2', 'locked designation as a #clause over a Locked concept', '{{#clause contracting_party}}\n**{{umbrella_name}} for and on behalf of {{portfolio_name}}**\n{{/clause}}', /contracting_party/);
await trip('C8.3', 'locked designation as two #with blocks (inline)', '**{{#with umbrella}}{{legal_name}}{{/with}} for and on behalf of {{#with portfolio}}{{legal_name}}{{/with}}**', /for and on behalf of/);
await trip('C8.4', 'locked designation as a formula (code)', '{{% return umbrella.legal_name + " for and on behalf of " + portfolio.legal_name %}}', /for and on behalf of/);
// Does anything stop the locked wording being edited? Edit the text inside the locked clause and parse again.
{
  const edited = '{{#clause contracting_party}}\n**{{umbrella_name}} acting for {{portfolio_name}}**\n{{/clause}}';
  const p = parse(CTO, edited);
  const g = p.ok ? await generate(CTO, p.dom, data) : undefined;
  results['C8.5'] = { parse: p.ok ? 'ok' : p.err, generate: g?.ok, text: g?.text };
  console.log(`C8.5 locked wording edited ("acting for"): parse ${p.ok ? 'ok' : p.err}, generate ${g?.ok ? 'ok' : g?.err}: ${JSON.stringify(g?.text)}`);
}

// C9: counsel note as an HTML comment
await trip('C9.1', 'counsel note as an HTML block comment', 'Text before.\n\n<!-- COUNSEL NOTE n_1: which article permits written resolutions? -->\n\nText after.', /COUNSEL NOTE/);
await trip('C9.2', 'counsel note inside a #clause', '{{#clause c_2_1}}\nText.\n\n<!-- COUNSEL NOTE n_2: confirm the wording -->\n{{/clause}}', /COUNSEL NOTE/);
await trip('C9.3', 'counsel note inline in a paragraph', 'Text <!-- COUNSEL NOTE n_3: check --> after.', /COUNSEL NOTE/);
// Can notes be stripped reliably at assembly? Remove every HtmlBlock / HtmlInline node from the output.
{
  const p = parse(CTO, 'Text before.\n\n<!-- COUNSEL NOTE n_1: q -->\n\nText <!-- COUNSEL NOTE n_3: check --> after.');
  const g = await generate(CTO, p.dom, data);
  const strip = (n: any): any => (Array.isArray(n) ? n.filter((x) => !/\.Html(Block|Inline)$/.test(x?.$class ?? '')).map(strip) : n && typeof n === 'object' ? Object.fromEntries(Object.entries(n).map(([k, v]) => [k, strip(v)])) : n);
  const stripped = strip(g.out);
  results['C9.4'] = { before: /COUNSEL/.test(JSON.stringify(g.out)), after: /COUNSEL/.test(JSON.stringify(stripped)) };
  console.log(`C9.4 strip Html nodes from output: note present before ${/COUNSEL/.test(JSON.stringify(g.out))}, after ${/COUNSEL/.test(JSON.stringify(stripped))}`);
}
// An engine-level check: does TemplateMarkInterpreter treat the comment as anything special?
void TemplateMarkInterpreter;
void modelManager;
save('c7-c9-ids-zones-notes', results);
