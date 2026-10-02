/** Small shared pieces: header, chips, the locked contracting-party strip. */
import { DESIGNATION_WORDING_STATUS, designation } from '@docsmart/domain/names';
import type { ReactNode } from 'react';
import type { DocumentView } from '../lib/api.js';
import { PORTFOLIO_STATUSES } from '../lib/forms.js';

export function Top({ crumbs, title, children }: { crumbs?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="top">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
        {crumbs && (
          <nav aria-label="Breadcrumb" className="crumbs">
            {crumbs}
          </nav>
        )}
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}

export const CLASS_NAMES: Record<DocumentView['class'], string> = {
  U3: 'Subscription terms',
  D12: 'Creation resolution',
  D13: 'Portfolio supplement',
  'D1-SP': 'Subscription agreement',
};

export function DocumentState({ doc }: { doc: DocumentView }) {
  const v = doc.current_version ? ` · version ${doc.current_version.number}` : '';
  switch (doc.state) {
    case 'DRAFTING':
      return <span className="chip outline">Not assembled yet</span>;
    case 'ASSEMBLED':
      return <span className="chip">Assembled{v}</span>;
    case 'READY_FOR_SUBMISSION':
      return <span className="chip pass">Ready for submission{v}</span>;
    case 'WITHDRAWN':
      return <span className="chip outline">Withdrawn</span>;
  }
}

export function PortfolioStatus({ status }: { status: unknown }) {
  const label = PORTFOLIO_STATUSES.find(([v]) => v === status)?.[1] ?? String(status);
  const cls = status === 'OPEN' ? 'chip dark' : status === 'PROPOSED' ? 'chip outline' : 'chip';
  return <span className={cls}>{label}</span>;
}

export function Stages({ status }: { status: unknown }) {
  const at = PORTFOLIO_STATUSES.findIndex(([v]) => v === status);
  return (
    <ol className="stages" aria-label="Portfolio stage">
      {PORTFOLIO_STATUSES.map(([v, label], i) => (
        <li key={v} className={i <= at ? 'done' : undefined} aria-current={i === at ? 'step' : undefined}>
          {label}
        </li>
      ))}
    </ol>
  );
}

const LockIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/**
 * The contracting party on every document of the portfolio (DF-P10, INV-9): generated from the
 * umbrella and portfolio legal names, never typed, never editable here.
 */
export function LockedStrip({ umbrellaName, portfolioName }: { umbrellaName: unknown; portfolioName: unknown }) {
  let wording: string;
  try {
    wording = designation(String(umbrellaName ?? ''), String(portfolioName ?? ''));
  } catch (e) {
    return (
      <div className="notice block">
        The contracting-party wording can't be generated: {(e as Error).message}. Fix the legal name on the record.
      </div>
    );
  }
  return (
    <div className="locked">
      <LockIcon />
      <span className="label">Contracting party on every document of this portfolio</span>
      <span className="wording">{wording}</span>
      <span className="why">
        Generated from the records · can't be edited
        {DESIGNATION_WORDING_STATUS !== 'confirmed' && ' · wording awaits BVI counsel (decision 0003)'}
      </span>
    </div>
  );
}

export function Loading() {
  return <div className="content muted">Loading…</div>;
}

export function Failed({ error }: { error: string }) {
  return (
    <div className="content">
      <div className="notice block" role="alert">
        <strong>Couldn't load this.</strong> {error}
        {/not running/.test(error) && (
          <p className="small" style={{ margin: '6px 0 0' }}>
            Start the API with <code>pnpm api</code> in another terminal.
          </p>
        )}
      </div>
    </div>
  );
}
