/**
 * Building an assembly request (POST /documents/{id}/versions) from what the sponsor entered for a
 * document: its template, its own inputs, the investor, and the documents it is built on.
 */
import type { Assembly, DocumentView, Template } from './api.js';
import type { Data } from './paths.js';

/** When each first-pass template is used (templates/README.md). */
export const TEMPLATE_USE: Record<string, string> = {
  'D12-A': "Directors' written resolutions; asset bought from the issuer or an unrelated seller",
  'D12-B': 'Written resolutions approving a purchase from a sponsor affiliate',
  'D12-C': 'Minutes of a board meeting',
  'D13-A': 'Portfolio subscribes for new shares in a financing round',
  'D13-B': 'Portfolio buys existing shares from a sponsor affiliate (conflict disclosure)',
  'D13-C': 'Portfolio buys existing shares from unrelated holders',
  'D1SP-A': 'Individual investor',
  'D1SP-B': 'Company, partnership or trust',
  'D1SP-C': 'Investor already holds another portfolio',
};

/**
 * A starting choice of template, from the facts templates/README.md names. Only a default for the
 * form: the sponsor chooses, and selection rules as policy (build plan B3) are not served yet.
 */
export function suggestTemplate(
  cls: string,
  facts: { acquisition_source?: unknown; party_type?: unknown },
): string | undefined {
  if (cls === 'D12') return facts.acquisition_source === 'gp_sourced' ? 'D12-B' : 'D12-A';
  if (cls === 'D13')
    return { issuer_primary: 'D13-A', gp_sourced: 'D13-B', market_secondary: 'D13-C' }[
      String(facts.acquisition_source)
    ];
  if (cls === 'D1-SP') return facts.party_type === 'entity' ? 'D1SP-B' : facts.party_type ? 'D1SP-A' : undefined;
  return undefined;
}

/** The approved, current versions of a class's templates, newest first. */
export function approvedTemplates(templates: readonly Template[], cls: string): Template[] {
  const approved = templates.filter((t) => t.class === cls && t.status === 'approved');
  const superseded = new Set(approved.map((t) => t.approval?.supersedes).filter(Boolean));
  return approved
    .filter((t) => !superseded.has(t.id))
    .sort((a, b) => a.template.localeCompare(b.template) || b.version - a.version);
}

/** "atlas_d12", or "atlas_d12_2" when that is taken. */
export function suggestDocumentId(portfolioId: string | undefined, cls: string, taken: readonly string[]): string {
  const base = `${(portfolioId ?? 'umbrella').replace(/^pf_/, '')}_${cls.toLowerCase().replace(/-/g, '')}`;
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base}_${n}`)) return `${base}_${n}`;
}

export interface Draft {
  template_version_id: string;
  inputs: Data;
  subscription_id?: string;
  party_id?: string;
  /** Document ids; the request names their current versions. */
  d13?: string;
  u3?: string;
  d15_date?: string;
  earlier?: { portfolio_legal_name?: string; executed_date?: string; ref?: string };
}

/** Removes what was not entered: empty strings, undefined, and objects left empty. Keeps false and 0. */
export function pruneBlank(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(pruneBlank).filter((x) => x !== undefined);
  if (v && typeof v === 'object') {
    const out = Object.fromEntries(
      Object.entries(v)
        .map(([k, x]) => [k, pruneBlank(x)] as const)
        .filter(([, x]) => x !== undefined),
    );
    return Object.keys(out).length ? out : undefined;
  }
  return v === '' || v === undefined || v === null ? undefined : v;
}

export class DraftProblem extends Error {}

export function buildRequest(draft: Draft, documents: readonly DocumentView[]): Assembly {
  const pointer = (id: string | undefined, what: string) => {
    if (!id) return undefined;
    const doc = documents.find((d) => d.id === id);
    if (!doc?.current_version) throw new DraftProblem(`The ${what} ${id} has no assembled version to build on.`);
    return { document_id: doc.id, version_id: doc.current_version.id };
  };
  const D13 = pointer(draft.d13, 'portfolio supplement');
  const U3 = pointer(draft.u3, 'subscription terms');
  const earlier = pruneBlank(draft.earlier) as Draft['earlier'];
  if (earlier && !(earlier.portfolio_legal_name && earlier.executed_date && earlier.ref))
    throw new DraftProblem("The earlier agreement needs its portfolio's legal name, its date and its reference.");
  return {
    template_version_id: draft.template_version_id,
    inputs: (pruneBlank(draft.inputs) as Data | undefined) ?? {},
    ...(draft.party_id ? { party_id: draft.party_id } : {}),
    ...(draft.subscription_id ? { subscription_id: draft.subscription_id } : {}),
    references: {
      ...(D13 ? { D13 } : {}),
      ...(U3 ? { U3 } : {}),
      ...(draft.d15_date ? { D15: { date: draft.d15_date } } : {}),
      ...(earlier ? { earlier_agreement: earlier as Required<NonNullable<Draft['earlier']>> } : {}),
    },
  };
}

/** One entry per director, none interested, for a creation resolution's declarations of interest. */
export function blankInterests(directors: ReadonlyArray<{ id: string }>): Data[] {
  return directors.map((d) => ({ director_id: d.id, is_interested: false, abstains: false, description: '' }));
}
