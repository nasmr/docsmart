// Probe: can Accord TemplateMark express what the first-pass templates use?
// Each feature is tried on its own so one failure does not hide the others.
// Run: node src/templatemark-probe.ts
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { TemplateMarkTransformer } = require('@accordproject/markdown-template');
const { ModelManager } = require('@accordproject/concerto-core');

const MODEL = `
namespace org.docsmart.spike@1.0.0

concept Director {
  o String name
  o Boolean is_interested
}
concept Umbrella {
  o String legal_name
  o Boolean is_regulated_fund
  o String fund_category
  o Director[] directors
}
concept Portfolio {
  o String legal_name
  o String share_class_name
}
enum AcquisitionSource {
  o issuer_primary
  o market_secondary
  o gp_sourced
}
concept ProjectAsset {
  o String issuer_name
  o AcquisitionSource acquisition_source
}
@template
concept D12 {
  o Umbrella umbrella
  o Portfolio portfolio
  o ProjectAsset asset
}
`;

const probes: Record<string, string> = {
  'F1 nested field, dotted path': 'The Company is {{umbrella.legal_name}}.',
  'F1 nested field, with block': '{{#with umbrella}}The Company is {{legal_name}}.{{/with}}',
  'F2 boolean condition, inline': '{{#with umbrella}}The Company is a segregated portfolio company{{#if is_regulated_fund}} and is recognised as a {{fund_category}}{{/if}}.{{/with}}',
  'F2 boolean condition with else, block': [
    '{{#with umbrella}}',
    '{{#if is_regulated_fund}}',
    'Apply to the Financial Services Commission for approval.',
    '{{else}}',
    'Notify the Financial Services Commission within 14 days.',
    '{{/if}}',
    '{{/with}}',
  ].join('\n'),
  'F3 enum equality condition': '{{#with asset}}{{#if condition="acquisition_source === \'gp_sourced\'"}}The valuation was tabled.{{/if}}{{/with}}',
  'F4 loop over list': '{{#with umbrella}}{{#ulist directors}}{{name}}, Director{{/ulist}}{{/with}}',
  'F4 loop with filter (WHERE)': '{{#with umbrella}}{{#ulist directors where="is_interested"}}{{name}} declared an interest.{{/ulist}}{{/with}}',
  'F4 loop producing several paragraphs per item': [
    '{{#with umbrella}}',
    '{{#ulist directors}}',
    '______________________',
    '',
    '{{name}}',
    '',
    'Director',
    '{{/ulist}}',
    '{{/with}}',
  ].join('\n'),
  'F5 AI zone as a named clause': '{{#clause issuer_description}}\nDrafted text goes here.\n{{/clause}}',
  'F6 locked designation as a formula': '{{% return umbrella.legal_name + " for and on behalf of " + portfolio.legal_name %}}',
  'F7 counsel note as an HTML comment': 'Text before.\n\n<!-- COUNSEL NOTE: which article permits written resolutions? -->\n\nText after.',
  'F8 clause with an explicit id': '{{#clause c_2_1}}\nA segregated portfolio of the Company be created.\n{{/clause}}',
};

const results: Array<[string, string, string]> = [];
for (const [name, content] of Object.entries(probes)) {
  const mm = new ModelManager({ strict: true });
  mm.addCTOModel(MODEL, 'model.cto');
  const t = new TemplateMarkTransformer();
  try {
    const dom = t.fromMarkdownTemplate({ content }, mm, 'contract', {});
    const types = new Set<string>();
    JSON.stringify(dom, (k, v) => {
      if (k === '$class' && typeof v === 'string') types.add(v.split('.').pop() ?? v);
      return v;
    });
    results.push([name, 'parsed', [...types].filter((x) => /Definition|Html/.test(x)).join(', ') || 'no template nodes']);
  } catch (e) {
    results.push([name, 'ERROR', String((e as Error).message).split('\n')[0]?.slice(0, 160) ?? '']);
  }
}
for (const [n, s, d] of results) console.log(`${s.padEnd(6)} | ${n} | ${d}`);
