// C1: dotted paths, #with, #clause scoping, and whether an unknown token is ever reported.
// Run: node src/validation/c1-nested-fields.ts
import { type Case, nodeTypes, parse, runAll } from './harness.ts';

const CTO = `
namespace org.docsmart.v@1.0.0
concept Om { o String date }
concept Umbrella { o String legal_name  o Om om }
concept Portfolio { o String legal_name }
@template
concept D { o Umbrella umbrella  o Portfolio portfolio  o String legal_name  o String only_top }
`;
const data = {
  $class: 'org.docsmart.v@1.0.0.D',
  umbrella: { $class: 'org.docsmart.v@1.0.0.Umbrella', legal_name: 'Meridian Horizon SPC Limited', om: { $class: 'org.docsmart.v@1.0.0.Om', date: '15 September 2026' } },
  portfolio: { $class: 'org.docsmart.v@1.0.0.Portfolio', legal_name: 'Atlas Segregated Portfolio' },
  legal_name: 'top-level name',
  only_top: 'a field only on the template concept',
};

const cases: Case[] = [
  { id: 'C1.1', name: 'dotted path {{umbrella.legal_name}}', cto: CTO, data, md: 'The Company is {{umbrella.legal_name}}.', expected: 'The Company is Meridian Horizon SPC Limited.' },
  { id: 'C1.2', name: 'dotted path with spaces {{ umbrella.legal_name }}', cto: CTO, data, md: 'The Company is {{ umbrella.legal_name }}.', expected: 'The Company is Meridian Horizon SPC Limited.' },
  { id: 'C1.3', name: '#with umbrella', cto: CTO, data, md: '{{#with umbrella}}The Company is {{legal_name}}.{{/with}}', expected: 'The Company is Meridian Horizon SPC Limited.' },
  { id: 'C1.4', name: 'nested #with (umbrella > om)', cto: CTO, data, md: 'Offering memorandum dated {{#with umbrella}}{{#with om}}{{date}}{{/with}}{{/with}}.', expected: 'Offering memorandum dated 15 September 2026.' },
  { id: 'C1.5', name: 'two #with in one sentence (locked wording)', cto: CTO, data, md: '{{#with umbrella}}{{legal_name}}{{/with}} for and on behalf of {{#with portfolio}}{{legal_name}}{{/with}}', expected: 'Meridian Horizon SPC Limited for and on behalf of Atlas Segregated Portfolio' },
  { id: 'C1.6', name: '#clause umbrella as a block scope', cto: CTO, data, md: '{{#clause umbrella}}\nThe Company is {{legal_name}}.\n\nA second paragraph naming {{legal_name}} again.\n{{/clause}}', expected: 'The Company is Meridian Horizon SPC Limited.\nA second paragraph naming Meridian Horizon SPC Limited again.' },
  { id: 'C1.7', name: 'nested #clause (umbrella > om)', cto: CTO, data, md: '{{#clause umbrella}}\n{{#clause om}}\nDated {{date}}.\n{{/clause}}\n{{/clause}}', expected: 'Dated 15 September 2026.' },
  { id: 'C1.8', name: 'control: misspelt plain variable {{legal_nmae}}', cto: CTO, data, md: 'Name: {{legal_nmae}}.', expected: '(an error is the desired result)' },
  { id: 'C1.9', name: 'control: misspelt variable inside #with', cto: CTO, data, md: '{{#with umbrella}}Name: {{legal_nmae}}.{{/with}}', expected: '(an error is the desired result)' },
  { id: 'C1.10', name: 'misspelt dotted path {{umbrela.legal_name}}', cto: CTO, data, md: 'Name: {{umbrela.legal_name}}.', expected: '(an error is the desired result)' },
  { id: 'C1.11', name: 'single-letter variable {{x}} (identifier needs 2+ chars)', cto: CTO, data, md: 'Name: {{x}}.', expected: '(an error is the desired result)' },
  { id: 'C1.12', name: 'clause kind: #clause does not change the typing scope, but does change the data scope', cto: CTO, data, kind: 'clause', md: '{{#clause umbrella}}\nValue: {{only_top}}.\n{{/clause}}', expected: '(typing and runtime should agree)' },
  { id: 'C1.13', name: 'contract kind: same template', cto: CTO, data, kind: 'contract', md: '{{#clause umbrella}}\nValue: {{only_top}}.\n{{/clause}}', expected: '(an error is the desired result)' },
];

const results = await runAll('c1-nested-fields', cases, true);

// Does any DOM for a dotted path contain a VariableDefinition, or the literal braces?
const p = parse(CTO, 'The Company is {{umbrella.legal_name}}.');
console.log('\nC1.1 DOM node types:', nodeTypes(p.dom).join(', '));
const leaked = results.filter((r) => r.actual?.includes('{{')).map((r) => `${r.id}/${r.kind}`);
console.log('cases whose generated text contains literal "{{":', leaked.join(', ') || 'none');
