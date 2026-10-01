// Atlas Segregated Portfolio values for the ports, from the invented fixture
// fixtures/meridian-horizon (never fixtures/private). Every value is a string taken from a
// record; nothing is computed. Money is "<currency> <amount>" as recorded. The two
// calculated fields (catalogue gap G9) are placeholders, as the fixture README says.
// Also: a reference renderer for the clause tree, so both formats render the same values.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Block, Inline } from '../../tree.ts';

const FX = path.resolve(import.meta.dirname, '../../../../../fixtures/meridian-horizon');
const j = (f: string) => JSON.parse(readFileSync(path.join(FX, f), 'utf8'));
const umb = j('umbrella.json');
const spn = j('sponsor.json');
const atlas = j('portfolios/atlas.json');
const docs = j('documents.json').documents;
const d12 = docs.find((d: any) => d.id === 'doc_atlas_d12').inputs;
const d13 = docs.find((d: any) => d.id === 'doc_atlas_d13').inputs;
const d15 = docs.find((d: any) => d.id === 'doc_atlas_d15').inputs;
const money = (m: { amount: string; currency: string }) => `${m.currency} ${m.amount}`;
const P = atlas.portfolio, T = atlas.terms, O = atlas.offer, A = atlas.asset;

export const values: Record<string, string | boolean> = {
  'umbrella.legal_name': umb.legal_name,
  'umbrella.company_number': umb.company_number,
  'umbrella.fund_category': umb.fund_category,
  'umbrella.is_regulated_fund': umb.is_regulated_fund,
  'umbrella.investor_basis_description': umb.investor_basis_description,
  'umbrella.om_date': umb.offering_memorandum.date,
  'umbrella.om_requires_related_party_consent': umb.offering_memorandum.requires_related_party_consent,
  'umbrella.related_party_consent_clause': umb.offering_memorandum.related_party_consent_clause,
  'umbrella.administrator_name': umb.service_providers.administrator.name,
  'umbrella.cost_rule_ref': umb.cost_allocation_rules[0].ref,
  'sponsor.legal_name': spn.legal_name,
  'portfolio.legal_name': P.legal_name,
  'portfolio.share_class_name': P.share_class_name,
  'portfolio.share_par_value': money(P.share_par_value),
  'portfolio.base_currency': P.base_currency,
  'portfolio.allocation_method_description': P.allocation_policy.description,
  'portfolio.subscription_price': money(T.subscription_price),
  'portfolio.min_subscription': money(T.min_subscription),
  'portfolio.mgmt_fee_rate': T.mgmt_fee_rate,
  'portfolio.fee_basis': T.fee_basis,
  'portfolio.fee_frequency': T.fee_frequency,
  'portfolio.perf_fee_rate': T.perf_fee_rate,
  'portfolio.has_hurdle': T.has_hurdle,
  'portfolio.hurdle_rate': T.hurdle_rate ?? '[not set: no hurdle]',
  'portfolio.org_expense_cap': money(T.org_expense_cap),
  'portfolio.term_years': String(T.term_years),
  'portfolio.extension_years': String(T.extension_years),
  'portfolio.max_offer': money(O.hard_cap),
  'portfolio.minimum_close_amount': money(O.minimum_close_amount),
  'portfolio.offer_open_date': O.open_date,
  'portfolio.offer_close_date': O.close_date,
  'portfolio.funding_deadline': O.funding_deadline,
  'portfolio.supplement_number': String(d13.supplement_number),
  'asset.issuer_name': A.issuer_name,
  'asset.issuer_jurisdiction': A.issuer_jurisdiction,
  'asset.instrument': A.instrument,
  'asset.acquisition_source': A.acquisition_source,
  'asset.max_quantity': String(A.quantity),
  'asset.price_per_share': money(A.price_per_share),
  'asset.seller_name': A.seller_name,
  'asset.sponsor_cost_per_share': money(A.gp_cost_basis_per_share),
  'asset.sponsor_acquisition_date': A.gp_acquisition_date,
  'asset.sponsor_retains_shares': A.sponsor_retains_shares,
  'asset.sponsor_retained_quantity': String(A.sponsor_retained_quantity),
  'asset.valuer_name': A.valuation.valuer_name,
  'asset.valuation_date': A.valuation.date,
  'asset.valuation_range': `${A.valuation.range_per_share.currency} ${A.valuation.range_per_share.low} to ${A.valuation.range_per_share.high}`,
  'asset.consent_status': A.consent_status,
  'asset.total_consideration': '[calculated: asset.total_consideration]',
  'asset.markup_pct': '[calculated: asset.markup_pct]',
  'resolution.date': d12.resolution_date,
  'resolution.effective_date': d12.effective_date,
  // Derived by our code from two recorded dates (catalogue: "derived boolean").
  'resolution.effective_date_differs': d12.effective_date !== d12.resolution_date,
  'supplement.date': d13.date,
  'conflict_disclosure.date': d15.date,
};

export interface Director { name: string; is_interested: boolean; abstains: boolean; interest_description?: string; signed_date: string }
export const directors: Director[] = umb.directors.map((d: any) => {
  const i = d12.director_interests.find((x: any) => x.director_id === d.id);
  return { name: d.name, is_interested: !!i?.is_interested, abstains: !!i?.abstains, ...(i ? { interest_description: i.description } : {}), signed_date: '[signed at execution]' };
});
export const lists: Record<string, Record<string, string | boolean | undefined>[]> = { 'umbrella.directors': directors as any };
export const zoneText = (zone: string) => `[AI draft: ${zone}]`;

// ---- reference renderer for the clause tree (what our renderer would produce, as text) ----
type Scope = Record<string, Record<string, unknown>>;
function lookup(name: string, scope: Scope): unknown {
  const [head, ...rest] = name.split('.');
  if (head && scope[head]) return rest.reduce((o: any, k) => o?.[k], scope[head]);
  if (!(name in values)) throw new Error('no value for ' + name);
  return values[name];
}
function cond(c: string, scope: Scope): boolean {
  let m: RegExpMatchArray | null;
  { const a = c.match(/^any\s+(\w+)\.(\w+)$/); if (a) return (lists["umbrella.directors"] ?? []).some((d) => !!d[a[2] as string]); }
  if ((m = c.match(/^([\w.]+)\s*=\s*(\w+)$/))) return lookup(m[1] as string, scope) === m[2];
  return !!lookup(c, scope);
}
function inl(xs: Inline[], scope: Scope): string {
  return xs.map((x) => {
    if (x.t === 'text' || x.t === 'raw') return x.v;
    if (x.t === 'slot') return String(lookup(x.name, scope));
    if (x.t === 'if') return cond(x.cond, scope) ? inl(x.then, scope) : x.else ? inl(x.else, scope) : '';
    return (lists[x.list] ?? []).map((it) => ({ ...scope, [x.alias]: it })).filter((s) => !x.where || cond(x.where, s)).map((s) => inl(x.body, s)).join(' ');
  }).join('');
}
export function renderTree(bs: Block[], scope: Scope = {}): string[] {
  const out: string[] = [];
  for (const b of bs) {
    switch (b.t) {
      case 'if': out.push(...(cond(b.cond, scope) ? renderTree(b.then, scope) : b.else ? renderTree(b.else, scope) : [])); break;
      case 'each':
        for (const it of lists[b.list] ?? []) {
          const s = { ...scope, [b.alias]: it as Record<string, unknown> };
          if (!b.where || cond(b.where, s)) out.push(...renderTree(b.body, s));
        }
        break;
      case 'heading': out.push(((b.number ? b.number + ' ' : '') + inl(b.text, scope)).trim()); break;
      case 'clause': out.push(`${b.number} ${inl(b.text, scope)}`); break;
      case 'para': case 'locked': out.push(inl(b.text, scope)); break;
      case 'zone': out.push(zoneText(b.zone)); break;
      case 'note': break; // counsel notes are removed at assembly
      case 'table':
        for (const r of b.rows) {
          if (r.t === 'row') out.push(r.cells.map((c) => inl(c, scope)).join(' | '));
          else for (const it of lists[r.list] ?? []) out.push(r.cells.map((c) => inl(c, { ...scope, [r.alias]: it as Record<string, unknown> })).join(' | '));
        }
        break;
    }
  }
  return out.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
