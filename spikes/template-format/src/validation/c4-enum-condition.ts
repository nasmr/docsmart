// C4: enum equality conditions and the one aggregate condition (any director.is_interested).
// The idiomatic code form, from the upstream test template
// accordproject/template-engine test/templates/good/full/template.md, is
// {{#if <property> condition="return <ts>"}} and {{#clause <property> condition="return <ts>"}}.
// The open-block regex needs a name before the attributes
// (node_modules/@accordproject/markdown-it-template/lib/template_re.js:28-33), so the
// probe's {{#if condition="..."}} parses "condition" as the property name.
// Run: node src/validation/c4-enum-condition.ts
import { type Case, runAll } from './harness.ts';

const NS = 'org.docsmart.v@1.0.0';
const CTO = `
namespace ${NS}
enum AcquisitionSource { o issuer_primary  o market_secondary  o gp_sourced }
concept ProjectAsset { o String issuer_name  o AcquisitionSource acquisition_source  o String valuer_name }
concept Director { o String name  o Boolean is_interested  o String interest_description optional }
concept GpSourced { o String valuer_name }
concept Interests { o Director[] interested }
@template
concept D {
  o ProjectAsset asset
  o Director[] directors
  // view-model fields, prepared by our code
  o Boolean asset_is_gp_sourced
  o GpSourced gp_sourced optional
  o Boolean any_director_interested
  o Interests interests optional
}
`;
function data(src: string, anyInterested: boolean) {
  const dirs = [
    { $class: `${NS}.Director`, name: 'Amara Okafor', is_interested: false },
    { $class: `${NS}.Director`, name: 'Henrik Solberg', is_interested: anyInterested, ...(anyInterested ? { interest_description: 'a director of the Seller' } : {}) },
  ];
  return {
    $class: `${NS}.D`,
    asset: { $class: `${NS}.ProjectAsset`, issuer_name: 'Kestrel Grid Systems Limited', acquisition_source: src, valuer_name: 'Northgate Valuation Advisers LLP' },
    directors: dirs,
    asset_is_gp_sourced: src === 'gp_sourced',
    ...(src === 'gp_sourced' ? { gp_sourced: { $class: `${NS}.GpSourced`, valuer_name: 'Northgate Valuation Advisers LLP' } } : {}),
    any_director_interested: anyInterested,
    ...(anyInterested ? { interests: { $class: `${NS}.Interests`, interested: dirs.filter((d) => d.is_interested) } } : {}),
  };
}
const GP = data('gp_sourced', true);
const PR = data('issuer_primary', false);
const TABLED = 'The valuation was tabled.';

const cases: Case[] = [
  { id: 'C4.1', name: 'probe form {{#if condition="..."}} (no property name)', cto: CTO, data: GP, md: `A.{{#if condition="return asset.acquisition_source === 'gp_sourced'"}} ${TABLED}{{/if}}`, expected: `A. ${TABLED}` },
  { id: 'C4.2a', name: 'idiomatic {{#if asset condition="return ..."}}, gp_sourced', cto: CTO, data: GP, md: `A.{{#if asset condition="return asset.acquisition_source === 'gp_sourced'"}} ${TABLED}{{/if}}`, expected: `A. ${TABLED}` },
  { id: 'C4.2b', name: 'idiomatic {{#if asset condition="return ..."}}, issuer_primary', cto: CTO, data: PR, md: `A.{{#if asset condition="return asset.acquisition_source === 'gp_sourced'"}} ${TABLED}{{/if}}`, expected: 'A.' },
  { id: 'C4.2c', name: 'idiomatic, with else', cto: CTO, data: PR, md: `A.{{#if asset condition="return asset.acquisition_source === 'gp_sourced'"}} ${TABLED}{{else}} No valuation.{{/if}}`, expected: 'A. No valuation.' },
  { id: 'C4.2d', name: 'idiomatic, inside #with asset', cto: CTO, data: GP, md: `{{#with asset}}{{issuer_name}}.{{#if acquisition_source condition="return asset.acquisition_source === 'gp_sourced'"}} ${TABLED}{{/if}}{{/with}}`, expected: `Kestrel Grid Systems Limited. ${TABLED}` },
  { id: 'C4.2e', name: 'idiomatic, field inside the code condition body', cto: CTO, data: GP, md: `A.{{#if asset condition="return asset.acquisition_source === 'gp_sourced'"}} Valued by {{valuer_name}}.{{/if}}`, expected: 'A. Valued by Northgate Valuation Advisers LLP.' },
  { id: 'C4.3a', name: '{{#clause asset condition="return ..."}} block, gp_sourced', cto: CTO, data: GP, md: `{{#clause asset condition="return asset.acquisition_source === 'gp_sourced'"}}\n5.2 The valuation by {{valuer_name}} was tabled.\n\n5.3 The Independent Directors approved it.\n{{/clause}}`, expected: '5.2 The valuation by Northgate Valuation Advisers LLP was tabled.\n5.3 The Independent Directors approved it.' },
  { id: 'C4.3b', name: '{{#clause asset condition="return ..."}} block, issuer_primary', cto: CTO, data: PR, md: `{{#clause asset condition="return asset.acquisition_source === 'gp_sourced'"}}\n5.2 The valuation by {{valuer_name}} was tabled.\n{{/clause}}`, expected: '' },
  { id: 'C4.4', name: 'formula returning text', cto: CTO, data: GP, md: `A.{{% return asset.acquisition_source === 'gp_sourced' ? ' ${TABLED}' : '' %}}`, expected: `A. ${TABLED}` },
  { id: 'C4.5a', name: 'data: derived Boolean asset_is_gp_sourced, true', cto: CTO, data: GP, md: `A.{{#if asset_is_gp_sourced}} ${TABLED}{{/if}}`, expected: `A. ${TABLED}` },
  { id: 'C4.5b', name: 'data: derived Boolean asset_is_gp_sourced, false', cto: CTO, data: PR, md: `A.{{#if asset_is_gp_sourced}} ${TABLED}{{/if}}`, expected: 'A.' },
  { id: 'C4.6a', name: 'data: optional concept gp_sourced as a block with fields, present', cto: CTO, data: GP, md: `{{#clause gp_sourced}}\n5.2 The valuation by {{valuer_name}} was tabled.\n{{/clause}}`, expected: '5.2 The valuation by Northgate Valuation Advisers LLP was tabled.' },
  { id: 'C4.6b', name: 'data: optional concept gp_sourced as a block with fields, absent', cto: CTO, data: PR, md: `{{#clause gp_sourced}}\n5.2 The valuation by {{valuer_name}} was tabled.\n{{/clause}}`, expected: '' },
  { id: 'C4.7', name: 'enum value printed as a variable', cto: CTO, data: GP, md: '{{#with asset}}Source: {{acquisition_source}}.{{/with}}', expected: 'Source: gp_sourced.' },
  // Aggregate: [[IF any director.is_interested]] … [[ELSE]] … [[END IF]]
  { id: 'C4.8a', name: 'aggregate, code: {{#if directors condition="return directors.some(...)"}}', cto: CTO, data: GP, md: `Interests.{{#if directors condition="return directors.some(d => d.is_interested)"}} Declared.{{else}} None.{{/if}}`, expected: 'Interests. Declared.' },
  { id: 'C4.8b', name: 'aggregate, data: derived Boolean any_director_interested', cto: CTO, data: PR, md: `Interests.{{#if any_director_interested}} Declared.{{else}} None.{{/if}}`, expected: 'Interests. None.' },
  { id: 'C4.8c', name: 'aggregate, data: optional concept with the interested list, present', cto: CTO, data: GP, md: `{{#clause interests}}\n{{#ulist interested}}\n- {{name}} declared an interest.\n{{/ulist}}\n{{/clause}}`, expected: 'Henrik Solberg declared an interest.' },
  { id: 'C4.8d', name: 'aggregate, data: optional concept, absent (else branch needs a second concept)', cto: CTO, data: PR, md: `{{#clause interests}}\n{{#ulist interested}}\n- {{name}} declared an interest.\n{{/ulist}}\n{{/clause}}`, expected: '' },
  { id: 'C4.8e', name: 'aggregate, data: optional concept guarded by #clause, absent, list moved out of the clause', cto: CTO, data: PR, md: `{{#clause interests}}\nInterests were declared.\n{{/clause}}\n\nAfter.`, expected: 'After.' },
];

await runAll('c4-enum-condition', cases, true);
