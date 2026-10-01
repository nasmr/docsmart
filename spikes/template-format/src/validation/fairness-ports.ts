// Fairness test: D12-B and D13-B ported to TemplateMark, data-only and code-allowed variants.
// For each port and each data scenario: parse, run the static "no code nodes" check, generate
// through template-engine, and compare the text with the clause tree rendered from the same
// values by the reference renderer in ports/atlas.ts (ignoring layout: whitespace, table bars,
// bullets, and a space before punctuation).
// Scenarios: "atlas" is the invented fixture as recorded. "flipped" is the same with every
// condition reversed (synthetic values, labelled as such) so the other branches are exercised.
// Run: node src/validation/fairness-ports.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { importFile } from '../import-docx.ts';
import { idBlocks } from '../tree.ts';
import { codeNodes, generate, OUT, parse, save } from './harness.ts';
import { directors, type Director, renderTree, values } from './ports/atlas.ts';
import * as d12b from './ports/d12b.ts';
import * as d13b from './ports/d13b.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
type V = Record<string, string | boolean>;

const flippedValues: V = {
  ...values,
  'umbrella.is_regulated_fund': false,
  'umbrella.fund_category': 'none',
  'umbrella.om_requires_related_party_consent': false,
  'portfolio.has_hurdle': true,
  'portfolio.hurdle_rate': '0.08 [synthetic]',
  'asset.sponsor_retains_shares': false,
  'resolution.effective_date_differs': false,
};
const flippedDirectors: Director[] = directors.map((d) => ({ name: d.name, is_interested: false, abstains: false, signed_date: d.signed_date }));
const scenarios = [
  { name: 'atlas', v: values, dirs: directors },
  { name: 'flipped', v: flippedValues, dirs: flippedDirectors },
];

// renderTree reads the module-level values/lists, so swap them per scenario.
import * as A from './ports/atlas.ts';
function treeText(body: any, v: V, dirs: Director[]): string[] {
  const keepV = { ...A.values };
  const keepL = A.lists['umbrella.directors'];
  Object.assign(A.values, v);
  A.lists['umbrella.directors'] = dirs as any;
  try {
    return renderTree(body);
  } finally {
    Object.assign(A.values, keepV);
    A.lists['umbrella.directors'] = keepL as any;
  }
}

const norm = (l: string) => l.replace(/\|/g, ' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').replace(/\s+([.,;:)])/g, '$1').trim();
function diff(a: string[], b: string[]) {
  // LCS line diff.
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const at = (x: number, y: number) => L[x]![y]!;
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++; }
    else if (at(i + 1, j) >= at(i, j + 1)) out.push('- tree: ' + a[i++]);
    else out.push('+ tmk:  ' + b[j++]);
  }
  while (i < n) out.push('- tree: ' + a[i++]);
  while (j < m) out.push('+ tmk:  ' + b[j++]);
  return out;
}

const ports = [
  { id: 'D12-B', file: 'D12-B_Creation_Resolution_Written_Sponsor_Asset.docx', mod: d12b },
  { id: 'D13-B', file: 'D13-B_Supplement_Sponsor_Secondary.docx', mod: d13b },
];
const report: Record<string, unknown> = {};
for (const p of ports) {
  const tree = await importFile(path.join(root, 'templates/first-pass', p.file), p.id);
  const treeIds = [...idBlocks(tree.body)].length;
  for (const [variant, port] of [['data-only', p.mod.dataOnly], ['code-allowed', p.mod.codeAllowed]] as const) {
    const key = `${p.id} ${variant}`;
    const parsed = parse(port.cto, port.md);
    const r: Record<string, unknown> = { invented: port.invented, inventedCount: port.invented.length };
    if (!parsed.ok) {
      r.parse = parsed.err;
      console.log(`${key}: PARSE-ERR ${parsed.err}`);
      report[key] = r;
      continue;
    }
    const code = codeNodes(parsed.dom);
    const domStr = JSON.stringify(parsed.dom);
    r.codeNodes = code.length;
    r.staticCheck = code.length === 0 ? 'pass' : 'reject';
    r.clauseIds = (domStr.match(/templatemark@0\.5\.0\.ClauseDefinition"/g) ?? []).length - 0; // includes none for the root ContractDefinition
    r.treeIdBlocks = treeIds;
    console.log(`${key}: parse ok; static no-code check ${r.staticCheck} (${code.length} code nodes); #clause nodes ${r.clauseIds} vs ${treeIds} id-bearing blocks in the tree; invented view-model fields ${port.invented.length}`);
    for (const sc of scenarios) {
      const expected = treeText(tree.body, sc.v, sc.dirs).map(norm).filter(Boolean);
      const g = await generate(port.cto, parsed.dom, port.data(sc.v, sc.dirs));
      if (!g.ok) {
        r[sc.name] = { generate: g.err };
        console.log(`   ${sc.name}: GEN-ERR ${g.err}`);
        continue;
      }
      const actual = (g.text ?? '').split('\n').map(norm).filter(Boolean);
      const d = diff(expected, actual);
      r[sc.name] = { match: d.length === 0, expectedLines: expected.length, actualLines: actual.length, diff: d, leakedBraces: actual.filter((l) => /\{\{|\[\[/.test(l)) };
      console.log(`   ${sc.name}: ${d.length === 0 ? 'TEXT MATCHES the clause-tree rendering' : `TEXT DIFFERS (${d.length} diff lines)`} (${expected.length} tree lines, ${actual.length} TemplateMark lines)`);
      for (const l of d) console.log('      ' + l.slice(0, 260));
    }
    report[key] = r;
  }
}
// Negative control: the comparison must notice a wrong branch. Generate D12-B data-only with the
// atlas data and compare it with the tree rendered for the flipped data.
{
  const tree = await importFile(path.join(root, 'templates/first-pass', ports[0]!.file), 'D12-B');
  const port = d12b.dataOnly;
  const g = await generate(port.cto, parse(port.cto, port.md).dom, port.data(values, directors));
  const d = diff(treeText(tree.body, flippedValues, flippedDirectors).map(norm).filter(Boolean), (g.text ?? '').split('\n').map(norm).filter(Boolean));
  report.negativeControl = { diffLines: d.length };
  console.log(`negative control (atlas output vs flipped tree): ${d.length} diff lines (must be > 0)`);
}
// Keep the port sources next to the results so they can be read without running anything.
mkdirSync(path.join(OUT, 'ports'), { recursive: true });
for (const p of ports) for (const [variant, port] of [['data-only', p.mod.dataOnly], ['code-allowed', p.mod.codeAllowed]] as const) {
  writeFileSync(path.join(OUT, 'ports', `${p.id}.${variant}.tem.md`), port.md);
  writeFileSync(path.join(OUT, 'ports', `${p.id}.${variant}.cto`), port.cto);
}
save('fairness-ports', report);
