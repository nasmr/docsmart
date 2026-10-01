// C10: does the entity name Asset (and other names from our model) clash with Concerto?
// Run: node src/validation/c10-names.ts
import { generate, modelManager, parse, save, firstLine } from './harness.ts';

const results: Record<string, string> = {};
const names = ['Asset', 'Participant', 'Transaction', 'Event', 'Concept', 'Portfolio', 'Investor', 'Umbrella', 'Director', 'Subscription', 'Resolution', 'ProjectAsset'];
for (const ns of ['org.docsmart.v@1.0.0', 'org.docsmart.assets@1.0.0']) {
  for (const n of names) {
    const cto = `namespace ${ns}\nconcept ${n} { o String issuer_name }\n@template\nconcept D { o ${n} asset }`;
    let r: string;
    try {
      modelManager(cto);
      const p = parse(cto, '{{#with asset}}Issuer: {{issuer_name}}.{{/with}}');
      if (!p.ok) r = 'parse error: ' + p.err;
      else {
        const g = await generate(cto, p.dom, { $class: `${ns}.D`, asset: { $class: `${ns}.${n}`, issuer_name: 'Kestrel' } });
        r = g.ok ? 'ok: ' + JSON.stringify(g.text) : 'generate error: ' + g.err;
      }
    } catch (e) {
      r = 'model error: ' + firstLine(e);
    }
    results[`${ns} concept ${n}`] = r;
    console.log(`${ns.padEnd(28)} concept ${n.padEnd(13)} ${r}`);
  }
}
// Declared with the Concerto keyword instead of `concept`
for (const kw of ['asset', 'participant', 'transaction', 'event']) {
  const ns = 'org.docsmart.v@1.0.0';
  const cto = `namespace ${ns}\n${kw} Thing identified by id { o String id  o String issuer_name }\n@template\nconcept D { o Thing asset }`;
  let r: string;
  try {
    modelManager(cto);
    r = 'model ok';
  } catch (e) {
    r = 'model error: ' + firstLine(e);
  }
  results[`keyword ${kw}`] = r;
  console.log(`keyword ${kw.padEnd(12)} ${r}`);
}
save('c10-names', results);
