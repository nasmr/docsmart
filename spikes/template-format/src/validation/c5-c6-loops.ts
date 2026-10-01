// C5: loops (ulist, olist, join) and what the templates need from them.
// C6: loop filters (WHERE).
// Block names are fixed in node_modules/@accordproject/markdown-it-template/lib/names.json;
// the ulist/olist rules read only the `name` attribute
// (node_modules/@accordproject/markdown-template/lib/templaterules.js:212-241).
// Run: node src/validation/c5-c6-loops.ts
import { type Case, generate, norm, parse, runAll, save } from './harness.ts';

const NS = 'org.docsmart.v@1.0.0';
const CTO = `
namespace ${NS}
concept Address { o String city }
concept Interest { o String description }
concept Director {
  o String name
  o Boolean is_interested
  o Boolean abstains
  o String interest_description optional
  o Interest interest optional
  o Address address
}
concept Person { o String name  o String role  o String ownership }
concept Umbrella { o String legal_name  o Director[] directors }
concept Entity { o Person[] signatories }
@template
concept D {
  o Umbrella umbrella
  o Director[] directors
  o Director[] interested_directors
  o Person[] controllers
  o Entity entity optional
  o String[] names
}
`;
const dir = (name: string, interested: boolean) => ({
  $class: `${NS}.Director`, name, is_interested: interested, abstains: interested,
  ...(interested ? { interest_description: 'a director of the Seller', interest: { $class: `${NS}.Interest`, description: 'a director of the Seller' } } : {}),
  address: { $class: `${NS}.Address`, city: 'Road Town' },
});
const dirs = [dir('Amara Okafor', false), dir('Henrik Solberg', true), dir('Priya Raman', false)];
const person = (name: string, role: string, ownership: string) => ({ $class: `${NS}.Person`, name, role, ownership });
const data = {
  $class: `${NS}.D`,
  umbrella: { $class: `${NS}.Umbrella`, legal_name: 'Meridian Horizon SPC Limited', directors: dirs },
  directors: dirs,
  interested_directors: dirs.filter((d) => d.is_interested), // prepared by our code
  controllers: [person('Chen Oyelaran', 'Director', '60%'), person('Ama Boateng', 'Shareholder', '40%')],
  entity: { $class: `${NS}.Entity`, signatories: [person('Chen Oyelaran', 'Director', '60%')] },
  names: ['Amara Okafor', 'Henrik Solberg'],
};
const noInterested = { ...data, interested_directors: [] };

const cases: Case[] = [
  // C5: the README's forms
  { id: 'C5.1', name: 'ulist at block level', cto: CTO, data, md: '{{#ulist directors}}\n- {{name}}\n{{/ulist}}', expected: 'Amara Okafor\nHenrik Solberg\nPriya Raman' },
  { id: 'C5.2', name: 'olist at block level', cto: CTO, data, md: '{{#olist directors}}\n1. {{name}}\n{{/olist}}', expected: 'Amara Okafor\nHenrik Solberg\nPriya Raman' },
  { id: 'C5.3', name: 'join inline', cto: CTO, data, md: 'Present: {{#join directors separator=", "}}{{name}}{{/join}}.', expected: 'Present: Amara Okafor, Henrik Solberg, Priya Raman.' },
  { id: 'C5.3b', name: 'join of strings with {{this}}', cto: CTO, data, md: 'Present: {{#join names separator=" and "}}{{this}}{{/join}}.', expected: 'Present: Amara Okafor and Henrik Solberg.' },
  // C5: what the templates need
  { id: 'C5.4a', name: 'several paragraphs per item, list markers, no underscores', cto: CTO, data, md: '{{#ulist directors}}\n- Signature line\n\n  {{name}}\n\n  Director\n{{/ulist}}', expected: 'Signature line\nAmara Okafor\nDirector\nSignature line\nHenrik Solberg\nDirector\nSignature line\nPriya Raman\nDirector' },
  { id: 'C5.4c', name: 'several paragraphs per item, no list marker, no underscores', cto: CTO, data, md: '{{#ulist directors}}\nSignature line\n\n{{name}}\n\nDirector\n{{/ulist}}', expected: 'Signature line\nAmara Okafor\nDirector\nSignature line\nHenrik Solberg\nDirector\nSignature line\nPriya Raman\nDirector' },
  { id: 'C5.4', name: 'several paragraphs per item (signature block, underscore rule as in the Word master)', cto: CTO, data, md: '{{#ulist directors}}\n- ______________________\n\n  {{name}}\n\n  Director\n{{/ulist}}', expected: '______________________\nAmara Okafor\nDirector\n______________________\nHenrik Solberg\nDirector\n______________________\nPriya Raman\nDirector' },
  { id: 'C5.4b', name: 'several paragraphs per item, no list marker', cto: CTO, data, md: '{{#ulist directors}}\n______________________\n\n{{name}}\n\nDirector\n{{/ulist}}', expected: '______________________\nAmara Okafor\nDirector\n______________________\nHenrik Solberg\nDirector\n______________________\nPriya Raman\nDirector' },
  { id: 'C5.5', name: 'nested field of the item (#with inside item)', cto: CTO, data, md: '{{#ulist directors}}\n- {{name}}, of {{#with address}}{{city}}{{/with}}\n{{/ulist}}', expected: 'Amara Okafor, of Road Town\nHenrik Solberg, of Road Town\nPriya Raman, of Road Town' },
  { id: 'C5.6', name: 'loop inside a condition (#clause over optional concept)', cto: CTO, data, md: '{{#clause entity}}\nSigned for the entity by:\n\n{{#ulist signatories}}\n- {{name}}, {{role}}\n{{/ulist}}\n{{/clause}}', expected: 'Signed for the entity by:\nChen Oyelaran, Director' },
  { id: 'C5.7a', name: 'condition inside a loop item, no field in the body', cto: CTO, data, md: '{{#ulist directors}}\n- {{name}}{{#if abstains}} (did not vote){{/if}}\n{{/ulist}}', expected: 'Amara Okafor\nHenrik Solberg (did not vote)\nPriya Raman' },
  { id: 'C5.7b', name: 'condition inside a loop item, field in the body (#if)', cto: CTO, data, md: '{{#ulist directors}}\n- {{name}}{{#if is_interested}}, interested as {{interest_description}}{{/if}}\n{{/ulist}}', expected: 'Amara Okafor\nHenrik Solberg, interested as a director of the Seller\nPriya Raman' },
  { id: 'C5.7c', name: 'condition inside a loop item, field in the body (#optional)', cto: CTO, data, md: '{{#ulist directors}}\n- {{name}}{{#optional interest_description}}, interested as {{this}}{{/optional}}\n{{/ulist}}', expected: 'Amara Okafor\nHenrik Solberg, interested as a director of the Seller\nPriya Raman' },
  { id: 'C5.8', name: 'loop producing table rows', cto: CTO, data, md: '| Name | Role | Ownership |\n|---|---|---|\n{{#ulist controllers}}\n| {{name}} | {{role}} | {{ownership}} |\n{{/ulist}}', expected: 'Name | Role | Ownership |\nChen Oyelaran | Director | 60% |\nAma Boateng | Shareholder | 40% |' },
  { id: 'C5.8b', name: 'control: a table with variables in cells, no loop', cto: CTO, data, md: '| Name | City |\n|---|---|\n| {{#with umbrella}}{{legal_name}}{{/with}} | Road Town |', expected: 'Name | City |\nMeridian Horizon SPC Limited | Road Town |' },
  { id: 'C5.9a', name: 'list through a nested path: {{#ulist umbrella.directors}}', cto: CTO, data, md: '{{#ulist umbrella.directors}}\n- {{name}}\n{{/ulist}}', expected: 'Amara Okafor\nHenrik Solberg\nPriya Raman' },
  { id: 'C5.9b', name: 'list through a nested path: #clause umbrella > #ulist directors', cto: CTO, data, md: '{{#clause umbrella}}\n{{#ulist directors}}\n- {{name}}\n{{/ulist}}\n{{/clause}}', expected: 'Amara Okafor\nHenrik Solberg\nPriya Raman' },
  { id: 'C5.9c', name: 'list through a nested path, inline: #with umbrella > #join directors', cto: CTO, data, md: 'Directors: {{#with umbrella}}{{#join directors separator=", "}}{{name}}{{/join}}{{/with}}.', expected: 'Directors: Amara Okafor, Henrik Solberg, Priya Raman.' },
  { id: 'C5.10', name: '{{#foreach}} block (in the TemplateMark model, upstream test skipped as "currently broken")', cto: CTO, data, md: '{{#foreach directors}}\n{{name}}\n{{/foreach}}', expected: 'Amara Okafor\nHenrik Solberg\nPriya Raman' },
  // C6: filters
  { id: 'C6.1', name: 'ulist with where= attribute', cto: CTO, data, md: '{{#ulist directors where="is_interested"}}\n- {{name}} declared an interest.\n{{/ulist}}', expected: 'Henrik Solberg declared an interest.' },
  { id: 'C6.2', name: 'join with where= attribute', cto: CTO, data, md: 'Interested: {{#join directors where="is_interested" separator=", "}}{{name}}{{/join}}.', expected: 'Interested: Henrik Solberg.' },
  { id: 'C6.3', name: 'filter by #if inside the item', cto: CTO, data, md: '{{#ulist directors}}\n- {{#if is_interested}}{{name}} declared an interest.{{/if}}\n{{/ulist}}', expected: 'Henrik Solberg declared an interest.' },
  { id: 'C6.4', name: 'filter by #optional inside the item', cto: CTO, data, md: '{{#ulist directors}}\n- {{#optional interest}}Interest: {{description}}.{{/optional}}\n{{/ulist}}', expected: 'Interest: a director of the Seller.' },
  { id: 'C6.5', name: 'code: #if item condition= inside the item', cto: CTO, data, md: '{{#ulist directors}}\n- {{name}}{{#if is_interested condition="return data.is_interested"}} declared an interest{{/if}}.\n{{/ulist}}', expected: 'Henrik Solberg declared an interest.' },
  { id: 'C6.5b', name: 'code: #if item condition= inside the item, with a cast', cto: CTO, data, md: '{{#ulist directors}}\n- {{name}}{{#if is_interested condition="return (data as any).is_interested"}} declared an interest{{/if}}.\n{{/ulist}}', expected: 'Amara Okafor.\nHenrik Solberg declared an interest.\nPriya Raman.', note: 'still one bullet per director: a condition inside the item cannot drop the item' },
  { id: 'C6.6', name: 'code: formula over the whole list', cto: CTO, data, md: 'Interested: {{% return directors.filter(d => d.is_interested).map(d => d.name).join(", ") %}}.', expected: 'Interested: Henrik Solberg.' },
  { id: 'C6.7a', name: 'data: pre-filtered list interested_directors', cto: CTO, data, md: '{{#ulist interested_directors}}\n- {{name}} declared an interest as {{#optional interest_description}}{{this}}{{/optional}}.\n{{/ulist}}', expected: 'Henrik Solberg declared an interest as a director of the Seller.' },
  { id: 'C6.7b', name: 'data: pre-filtered list, empty', cto: CTO, data: noInterested, md: 'Before.\n\n{{#ulist interested_directors}}\n- {{name}} declared an interest.\n{{/ulist}}\n\nAfter.', expected: 'Before.\nAfter.' },
];

await runAll('c5-c6-loops', cases, false);

// C5.8 structural check: does the loop produce table rows, or something else?
{
  const md = '| Name | Role | Ownership |\n|---|---|---|\n{{#ulist controllers}}\n| {{name}} | {{role}} | {{ownership}} |\n{{/ulist}}';
  const g = await generate(CTO, parse(CTO, md).dom, data);
  const s = JSON.stringify(g.out);
  const count = (re: RegExp) => (s.match(re) ?? []).length;
  console.log(`C5.8 structure: TableRow nodes ${count(/commonmark@0.5.0.TableRow"/g)}, List nodes ${count(/commonmark@0.5.0.List"/g)}, Item nodes ${count(/commonmark@0.5.0.Item"/g)} (2 data rows expected as TableRow; header row is 1)`);
  save('c5-table-loop-output', g.out);
}

// C5.11: hand-built ForeachDefinition (the node type exists in the TemplateMark model).
const p = parse(CTO, '{{#ulist directors}}\n{{name}}\n{{/ulist}}');
const fe = JSON.parse(JSON.stringify(p.dom).replace(/ListBlockDefinition/g, 'ForeachDefinition'));
const g = await generate(CTO, fe, data);
const r = { ok: g.ok, err: g.err, text: g.text, match: g.ok && norm(g.text ?? '') === norm('Amara Okafor Henrik Solberg Priya Raman') };
console.log('C5.11 hand-built ForeachDefinition:', r.ok ? (r.match ? 'MATCH' : 'MISMATCH ' + JSON.stringify(r.text)) : 'GEN-ERR ' + r.err);
save('c5-foreach-hand-built', r);
