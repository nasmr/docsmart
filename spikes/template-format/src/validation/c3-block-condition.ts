// C3: boolean condition with else, as a block. Both branches, and the block content the
// templates need: several paragraphs, a heading, a list, a nested condition, a named clause.
// #if is an inline-only rule: node_modules/@accordproject/markdown-it-template/lib/names.json
// lists blocks ["clause","ulist","olist"] and inlines ["if","optional","with","join"].
// Run: node src/validation/c3-block-condition.ts
import { type Case, runAll } from './harness.ts';

const NS = 'org.docsmart.v@1.0.0';
const CTO = `
namespace ${NS}
concept Regulated { o String approver }
concept Unregulated { o String days }
concept Item { o String text }
@template
concept D {
  o Boolean is_regulated_fund
  o Boolean has_hurdle
  o Regulated regulated optional
  o Unregulated unregulated optional
  o Item[] items
}
`;
const d = (reg: boolean) => ({
  $class: `${NS}.D`,
  is_regulated_fund: reg,
  has_hurdle: true,
  ...(reg ? { regulated: { $class: `${NS}.Regulated`, approver: 'the Financial Services Commission' } } : { unregulated: { $class: `${NS}.Unregulated`, days: '14' } }),
  items: [{ $class: `${NS}.Item`, text: 'one' }, { $class: `${NS}.Item`, text: 'two' }],
});
const R = d(true);
const U = d(false);
const P1 = 'Apply to the Financial Services Commission for approval.';
const P2 = 'Notify the Financial Services Commission within 14 days.';

const cases: Case[] = [
  { id: 'C3.1a', name: 'one-paragraph #if/else on separate lines, true', cto: CTO, data: R, md: `{{#if is_regulated_fund}}\n${P1}\n{{else}}\n${P2}\n{{/if}}`, expected: P1 },
  { id: 'C3.1b', name: 'one-paragraph #if/else on separate lines, false', cto: CTO, data: U, md: `{{#if is_regulated_fund}}\n${P1}\n{{else}}\n${P2}\n{{/if}}`, expected: P2 },
  { id: 'C3.2', name: '#if containing two paragraphs (blank line inside)', cto: CTO, data: R, md: `{{#if is_regulated_fund}}\n${P1}\n\nNo shares are issued until approval.\n{{/if}}`, expected: `${P1}\nNo shares are issued until approval.` },
  { id: 'C3.2b', name: '#if containing two paragraphs, condition FALSE', cto: CTO, data: U, md: `{{#if is_regulated_fund}}\n${P1}\n\nNo shares are issued until approval.\n{{/if}}`, expected: '' },
  { id: 'C3.3', name: '#if containing a heading', cto: CTO, data: R, md: `{{#if is_regulated_fund}}\n## 3 Regulatory approval\n{{/if}}\n\nBody.`, expected: '3 Regulatory approval\nBody.' },
  { id: 'C3.4', name: '#if containing a list', cto: CTO, data: R, md: `{{#if is_regulated_fund}}\n- first\n- second\n{{/if}}`, expected: 'first\nsecond' },
  { id: 'C3.5', name: 'nested #if (inline)', cto: CTO, data: R, md: `A{{#if is_regulated_fund}} B{{#if has_hurdle}} C{{/if}}{{/if}}.`, expected: 'A B C.' },
  { id: 'C3.6', name: 'named #clause inside #if', cto: CTO, data: R, md: `{{#if is_regulated_fund}}\n{{#clause regulated}}\nApply to {{approver}}.\n{{/clause}}\n{{/if}}`, expected: 'Apply to the Financial Services Commission.' },
  // The idiomatic block form: a clause per branch over an optional concept (data only).
  { id: 'C3.7a', name: 'two #clause blocks over optional concepts, regulated', cto: CTO, data: R, md: `{{#clause regulated}}\n## 3 Regulatory approval\n\n3.1 Apply to {{approver}} for approval.\n\n- no shares issued before approval\n{{/clause}}\n\n{{#clause unregulated}}\n## 3 Regulatory notification\n\n3.1 Notify the Financial Services Commission within {{days}} days.\n{{/clause}}`, expected: '3 Regulatory approval\n3.1 Apply to the Financial Services Commission for approval.\nno shares issued before approval' },
  { id: 'C3.7b', name: 'two #clause blocks over optional concepts, unregulated', cto: CTO, data: U, md: `{{#clause regulated}}\n## 3 Regulatory approval\n\n3.1 Apply to {{approver}} for approval.\n\n- no shares issued before approval\n{{/clause}}\n\n{{#clause unregulated}}\n## 3 Regulatory notification\n\n3.1 Notify the Financial Services Commission within {{days}} days.\n{{/clause}}`, expected: '3 Regulatory notification\n3.1 Notify the Financial Services Commission within 14 days.' },
  { id: 'C3.7c', name: '#if nested inside a #clause block', cto: CTO, data: R, md: `{{#clause regulated}}\nApply to {{approver}}.\n{{/clause}}\n\nFee{{#if has_hurdle}} plus a hurdle{{/if}}.`, expected: 'Apply to the Financial Services Commission.\nFee plus a hurdle.' },
  { id: 'C3.7d', name: 'root list used inside a #clause block (no parent access)', cto: CTO, data: R, md: `{{#clause regulated}}\nApply to {{approver}}.\n\n{{#ulist items}}\n- {{text}}\n{{/ulist}}\n{{/clause}}`, expected: 'Apply to the Financial Services Commission.\none\ntwo', note: 'items is a property of the template concept, not of Regulated' },
  // The code form: #clause with condition=.
  { id: 'C3.8a', name: '#clause with condition= (code), true', cto: CTO, data: R, md: `{{#clause regulated condition="return is_regulated_fund"}}\nApply to {{approver}}.\n\nSecond paragraph.\n{{/clause}}`, expected: 'Apply to the Financial Services Commission.\nSecond paragraph.' },
  { id: 'C3.9', name: 'root field used inside a #clause block (no parent access)', cto: CTO, data: R, md: `{{#clause regulated}}\nApply to {{approver}}; hurdle {{has_hurdle}}.\n{{/clause}}`, expected: 'Apply to the Financial Services Commission; hurdle true.' },
];

await runAll('c3-block-condition', cases, true);
