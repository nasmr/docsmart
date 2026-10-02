/**
 * What the sponsor workspace shows, gathered from the record and document lists. One umbrella per
 * tenant in this slice.
 */
import type { DocumentView, ListedRecord } from './api.js';
import type { Data } from './paths.js';

export interface Versioned {
  id: string;
  version: number;
  data: Data;
}

export interface PortfolioEntry {
  id: string;
  portfolio: Versioned;
  terms?: Versioned | undefined;
  offer?: Versioned | undefined;
  asset?: Versioned | undefined;
  account?: Versioned | undefined;
  documents: DocumentView[];
}

export interface Workspace {
  umbrella?: Versioned | undefined;
  sponsor?: Versioned | undefined;
  portfolios: PortfolioEntry[];
  umbrellaDocuments: DocumentView[];
  documents: DocumentView[];
}

export interface Lists {
  umbrella: ListedRecord[];
  sponsor: ListedRecord[];
  portfolio: ListedRecord[];
  portfolio_terms: ListedRecord[];
  offer: ListedRecord[];
  asset: ListedRecord[];
  subscription_account: ListedRecord[];
  documents: DocumentView[];
}

const v = (r: ListedRecord): Versioned => ({ id: r.id, version: r.version, data: r.data });

export function buildWorkspace(l: Lists): Workspace {
  const umbrella = l.umbrella[0];
  const sponsorId = umbrella?.data.sponsor_id;
  const sponsor = l.sponsor.find((s) => s.id === sponsorId) ?? l.sponsor[0];
  // Terms and the subscription account are kept under the portfolio's id; the offer and asset name it.
  const byPortfolioField = (list: ListedRecord[], id: string) => list.find((r) => r.data.portfolio_id === id);
  const portfolios = l.portfolio.map((p): PortfolioEntry => {
    const terms = l.portfolio_terms.find((r) => r.id === p.id);
    const account = l.subscription_account.find((r) => r.id === p.id);
    const offer = byPortfolioField(l.offer, p.id);
    const asset = byPortfolioField(l.asset, p.id);
    return {
      id: p.id,
      portfolio: v(p),
      terms: terms && v(terms),
      offer: offer && v(offer),
      asset: asset && v(asset),
      account: account && v(account),
      documents: l.documents.filter((d) => d.portfolio_id === p.id),
    };
  });
  return {
    umbrella: umbrella && v(umbrella),
    sponsor: sponsor && v(sponsor),
    portfolios,
    umbrellaDocuments: l.documents.filter((d) => d.scope === 'umbrella'),
    documents: l.documents,
  };
}

export const RECORD_PARTS = [
  ['portfolio', 'Portfolio'],
  ['terms', 'Terms'],
  ['offer', 'Offer'],
  ['asset', 'Asset'],
  ['account', 'Subscription account'],
] as const;

/** The records a portfolio still needs before its documents can be assembled. */
export function missingParts(p: PortfolioEntry): string[] {
  return RECORD_PARTS.filter(([key]) => !p[key]).map(([, label]) => label);
}

/** "Atlas SP" for screens: the short name, or the legal name. */
export function portfolioName(p: PortfolioEntry | Versioned): string {
  const data = 'portfolio' in p ? p.portfolio.data : p.data;
  return String(data.short_name ?? data.legal_name ?? p.id);
}
