// Second pass: fairer forms of the features that failed in templatemark-probe.ts.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { TemplateMarkTransformer } = require('@accordproject/markdown-template');
const { ModelManager } = require('@accordproject/concerto-core');

const MODEL = `
namespace org.docsmart.spike@1.0.0
concept Director { o String name  o Boolean is_interested }
concept Terms { o Boolean has_hurdle  o Double hurdle_rate }
concept Zone { o String instructions }
@template
concept D13 {
  o Terms terms
  o Director[] directors
  o Zone issuer_description
  o String legal_name
}
`;
const probes: Record<string, string> = {
  'dotted path makes a variable?': 'The Portfolio is {{terms.hurdle_rate}}.',
  'variable inside a condition (block)': '{{#with terms}}\n{{#if has_hurdle}}\nplus a return of {{hurdle_rate}} a year\n{{/if}}\n{{/with}}',
  'variable inside a condition (inline)': '{{#with terms}}fee{{#if has_hurdle}} plus {{hurdle_rate}}{{/if}}.{{/with}}',
  'ulist at block level': '{{#ulist directors}}\n{{name}}\n{{/ulist}}',
  'join (inline list)': 'Present: {{#join directors separator=", "}}{{name}}{{/join}}.',
  'clause typed by a concept property': '{{#clause issuer_description}}\n{{instructions}}\n{{/clause}}',
  'optional block': '{{#optional legal_name}}Name: {{this}}{{else}}none{{/optional}}',
};
for (const [name, content] of Object.entries(probes)) {
  const mm = new ModelManager({ strict: true }); mm.addCTOModel(MODEL, 'model.cto');
  try {
    const dom = new TemplateMarkTransformer().fromMarkdownTemplate({ content }, mm, 'contract', {});
    const types = new Set<string>();
    JSON.stringify(dom, (k, v) => { if (k === '$class') types.add(String(String(v).split('.').pop())); return v; });
    console.log('parsed | ' + name + ' | ' + [...types].filter((x) => /Definition/.test(x)).join(', '));
  } catch (e) { console.log('ERROR  | ' + name + ' | ' + String((e as Error).message).split('\n')[0]?.slice(0, 150)); }
}
