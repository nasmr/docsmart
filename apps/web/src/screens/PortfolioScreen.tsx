/**
 * One portfolio (design: Portfolio artboard): the locked contracting party, its stage, its records as
 * forms, and its documents.
 */
import { useMemo } from 'react';
import { RecordForm } from '../components/RecordForm.js';
import { CLASS_NAMES, DocumentState, Failed, Loading, LockedStrip, Stages, Top } from '../components/ui.js';
import type { Entity } from '../lib/api.js';
import { printCount, printDate, printMoney, printRate } from '../lib/format.js';
import {
  ACQUISITION_SOURCES,
  accountForm,
  assetForm,
  type Context,
  type FormSpec,
  offerForm,
  portfolioForm,
  termsForm,
} from '../lib/forms.js';
import { href, type PortfolioTab } from '../lib/route.js';
import { useWorkspace } from '../lib/useWorkspace.js';
import { type PortfolioEntry, portfolioName, RECORD_PARTS } from '../lib/workspace.js';

const TABS: Record<Exclude<PortfolioTab, 'summary'>, { spec: FormSpec; entity: Entity; part: keyof PortfolioEntry }> = {
  portfolio: { spec: portfolioForm, entity: 'portfolio', part: 'portfolio' },
  terms: { spec: termsForm, entity: 'portfolio_terms', part: 'terms' },
  offer: { spec: offerForm, entity: 'offer', part: 'offer' },
  asset: { spec: assetForm, entity: 'asset', part: 'asset' },
  account: { spec: accountForm, entity: 'subscription_account', part: 'account' },
};

export function PortfolioScreen({ id, tab }: { id: string; tab: PortfolioTab }) {
  const { ws, error, reload } = useWorkspace();
  const p = ws?.portfolios.find((x) => x.id === id);
  const ctx = useMemo<Context>(
    () => ({
      portfolio_id: id,
      umbrella_id: ws?.umbrella?.id,
      currency: String(p?.portfolio.data.base_currency ?? 'USD'),
    }),
    [id, ws?.umbrella?.id, p?.portfolio.data.base_currency],
  );
  if (error && !ws) return <Failed error={error} />;
  if (!ws) return <Loading />;
  if (!p) return <Failed error={`There is no portfolio ${id}.`} />;

  const form = tab === 'summary' ? undefined : TABS[tab];
  const record = form && (p[form.part] as PortfolioEntry['terms']);
  return (
    <>
      <Top
        crumbs={
          <>
            <a href={href({ screen: 'overview' })}>{String(ws.umbrella?.data.legal_name ?? 'Umbrella')}</a> / Portfolios
          </>
        }
        title={portfolioName(p)}
      >
        <a className="btn" href={href({ screen: 'new-document', portfolio: id, scope: 'portfolio' })}>
          + New document
        </a>
      </Top>
      <div className="content">
        <LockedStrip umbrellaName={ws.umbrella?.data.legal_name} portfolioName={p.portfolio.data.legal_name} />
        <Stages status={p.portfolio.data.status} />
        <nav className="tabs" aria-label="Portfolio records">
          <a
            href={href({ screen: 'portfolio', id, tab: 'summary' })}
            aria-current={tab === 'summary' ? 'page' : undefined}
          >
            Summary
          </a>
          {RECORD_PARTS.map(([key, label]) => {
            const t = (key === 'portfolio' ? 'portfolio' : key) as PortfolioTab;
            return (
              <a
                key={key}
                href={href({ screen: 'portfolio', id, tab: t })}
                aria-current={tab === t ? 'page' : undefined}
              >
                <span className={`dot${p[key] ? ' on' : ''}`} />
                {label}
                <span className="sr">{p[key] ? '(entered)' : '(not entered)'}</span>
              </a>
            );
          })}
        </nav>
        {form ? (
          <RecordForm
            key={`${tab}:${record?.id ?? 'new'}`}
            spec={form.spec}
            entity={form.entity}
            ctx={ctx}
            initial={record?.data}
            version={record?.version}
            onSaved={() => void reload()}
          />
        ) : (
          <Summary p={p} />
        )}
      </div>
    </>
  );
}

function Summary({ p }: { p: PortfolioEntry }) {
  const a = p.asset?.data;
  const o = p.offer?.data;
  const t = p.terms?.data;
  const edit = (tab: PortfolioTab, entered: unknown) => (
    <a href={href({ screen: 'portfolio', id: p.id, tab })}>{entered ? 'Edit' : 'Enter'}</a>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section className="card">
          <div className="card-head">
            <h2>Asset</h2>
            {a && (
              <span className={a.acquisition_source === 'gp_sourced' ? 'chip wait' : 'chip'}>
                {ACQUISITION_SOURCES.find(([v]) => v === a.acquisition_source)?.[1]}
              </span>
            )}
            {edit('asset', a)}
          </div>
          {a ? (
            <dl className="facts card-body" style={{ gridTemplateColumns: '150px minmax(0,1fr)' }}>
              <dt>Issuer</dt>
              <dd>
                {String(a.issuer_name)} ({String(a.issuer_jurisdiction)})
              </dd>
              <dt>Instrument</dt>
              <dd>{String(a.instrument)}</dd>
              <dt>Shares</dt>
              <dd className="num">{printCount(a.quantity)}</dd>
              <dt>Price per share</dt>
              <dd className="num">{printMoney(a.price_per_share)}</dd>
              <dt>Seller</dt>
              <dd>{String(a.seller_name)}</dd>
              {a.gp_cost_basis_per_share !== undefined && (
                <>
                  <dt>Sponsor's cost</dt>
                  <dd className="num">
                    {printMoney(a.gp_cost_basis_per_share)} per share · bought {printDate(a.gp_acquisition_date)}
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p className="empty">Not entered.</p>
          )}
          <p className="small muted card-body" style={{ margin: 0, borderTop: '1px solid var(--line-soft)' }}>
            Total consideration and markup are worked out by the calculation service when a document is assembled.
          </p>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Terms</h2>
            {edit('terms', t)}
          </div>
          {t ? (
            <dl className="facts card-body" style={{ gridTemplateColumns: '170px minmax(0,1fr)' }}>
              <dt>Minimum subscription</dt>
              <dd className="num">{printMoney(t.min_subscription)}</dd>
              <dt>Price per share</dt>
              <dd className="num">{printMoney(t.subscription_price)}</dd>
              <dt>Management fee</dt>
              <dd className="num">{printRate(t.mgmt_fee_rate)} a year</dd>
              <dt>Performance fee</dt>
              <dd className="num">
                {printRate(t.perf_fee_rate)}
                {t.has_hurdle === true && ` over a ${printRate(t.hurdle_rate)} hurdle`}
              </dd>
              <dt>Term</dt>
              <dd>
                {String(t.term_years)} years{Number(t.extension_years) > 0 && ` + ${String(t.extension_years)}`}
              </dd>
            </dl>
          ) : (
            <p className="empty">Not entered.</p>
          )}
        </section>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section className="card">
          <div className="card-head">
            <h2>Offer</h2>
            {o && (
              <span className="small muted">
                {printDate(o.open_date)} to {printDate(o.close_date)}
              </span>
            )}
            {edit('offer', o)}
          </div>
          {o ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
              {(
                [
                  ['Target', o.target_size],
                  ['Hard cap', o.hard_cap],
                  ['Minimum to close', o.minimum_close_amount],
                ] as const
              ).map(([label, m], i) => (
                <div
                  key={label}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    borderRight: i < 2 ? '1px solid var(--line-soft)' : undefined,
                  }}
                >
                  <span className="small muted">{label}</span>
                  <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>
                    {printMoney(m)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Not entered.</p>
          )}
          {o && (
            <p className="small muted card-body" style={{ margin: 0, borderTop: '1px solid var(--line-soft)' }}>
              Funding deadline {printDate(o.funding_deadline)}. Allocation is typed in on each subscription request
              until the allocation engine exists.
            </p>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <h2>{portfolioName(p)} documents</h2>
            <a href={href({ screen: 'new-document', portfolio: p.id, scope: 'portfolio' })}>New document</a>
          </div>
          {p.documents.length === 0 ? (
            <p className="empty">None yet.</p>
          ) : (
            p.documents.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) 200px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--line-soft)',
                }}
              >
                <span>
                  <a href={href({ screen: 'document', id: d.id })}>{CLASS_NAMES[d.class]}</a>{' '}
                  <span className="mono small muted">{d.id}</span>
                </span>
                <DocumentState doc={d} />
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

export function NewPortfolioScreen() {
  const { ws, error, reload } = useWorkspace();
  const ctx = useMemo<Context>(() => ({ umbrella_id: ws?.umbrella?.id }), [ws?.umbrella?.id]);
  if (error && !ws) return <Failed error={error} />;
  if (!ws) return <Loading />;
  if (!ws.umbrella) return <Failed error="Enter the umbrella company before its portfolios." />;
  return (
    <>
      <Top
        crumbs={
          <>
            <a href={href({ screen: 'overview' })}>{String(ws.umbrella.data.legal_name)}</a> / Portfolios
          </>
        }
        title="New portfolio"
      />
      <div className="content">
        <p className="muted" style={{ margin: 0 }}>
          Start with the portfolio itself. Its terms, offer, asset and subscription account follow, each on its own tab.
        </p>
        <RecordForm
          spec={portfolioForm}
          entity="portfolio"
          ctx={ctx}
          onSaved={async (_, id) => {
            await reload();
            window.location.hash = href({ screen: 'portfolio', id, tab: 'terms' });
          }}
        />
      </div>
    </>
  );
}
