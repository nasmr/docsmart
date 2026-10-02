/** The umbrella at a glance (design: Main artboard): what needs doing, the portfolios, umbrella documents. */
import { CLASS_NAMES, DocumentState, Failed, Loading, PortfolioStatus, Top } from '../components/ui.js';
import { printMoney } from '../lib/format.js';
import { ACQUISITION_SOURCES, FUND_CATEGORIES } from '../lib/forms.js';
import { href } from '../lib/route.js';
import { useWorkspace } from '../lib/useWorkspace.js';
import { missingParts, type PortfolioEntry, portfolioName, RECORD_PARTS } from '../lib/workspace.js';

function nextStep(p: PortfolioEntry): { text: string; to: string } {
  const missing = RECORD_PARTS.find(([key]) => !p[key]);
  if (missing) {
    const tab = missing[0] === 'portfolio' ? 'portfolio' : missing[0];
    return { text: `Enter ${missing[1].toLowerCase()}`, to: href({ screen: 'portfolio', id: p.id, tab }) };
  }
  if (!p.documents.length)
    return { text: 'Create a document', to: href({ screen: 'new-document', portfolio: p.id, scope: 'portfolio' }) };
  const open = p.documents.find((d) => d.state === 'ASSEMBLED' || d.state === 'DRAFTING');
  if (open)
    return { text: `Review ${CLASS_NAMES[open.class].toLowerCase()}`, to: href({ screen: 'document', id: open.id }) };
  return { text: 'Documents', to: href({ screen: 'portfolio', id: p.id, tab: 'summary' }) };
}

export function Overview() {
  const { ws, error } = useWorkspace();
  if (error && !ws) return <Failed error={error} />;
  if (!ws) return <Loading />;
  const u = ws.umbrella?.data;

  const waiting = [
    ...(u
      ? []
      : [
          {
            key: 'umbrella',
            tag: 'Umbrella',
            text: 'Enter the umbrella company first.',
            to: href({ screen: 'umbrella' }),
            link: 'Enter umbrella',
          },
        ]),
    ...ws.portfolios
      .filter((p) => missingParts(p).length)
      .map((p) => ({
        key: p.id,
        tag: 'Records',
        text: (
          <>
            <strong>{portfolioName(p)}</strong> needs {missingParts(p).join(', ').toLowerCase()} before its documents
            can be assembled.
          </>
        ),
        to: nextStep(p).to,
        link: nextStep(p).text,
      })),
    ...ws.documents
      .filter((d) => d.state === 'ASSEMBLED')
      .map((d) => ({
        key: d.id,
        tag: 'Document',
        text: (
          <>
            <strong>{CLASS_NAMES[d.class]}</strong> <span className="mono small">{d.id}</span> is assembled: review its
            checks and mark it ready for submission.
          </>
        ),
        to: href({ screen: 'document', id: d.id }),
        link: 'Review document',
      })),
  ];

  return (
    <>
      <Top title="Overview">
        <a className="btn" href={href({ screen: 'new-portfolio' })}>
          + New portfolio
        </a>
      </Top>
      <div className="content">
        <section className="card" aria-labelledby="needs">
          <div className="card-head">
            <h2 id="needs">Waiting on you</h2>
            <span className="small muted">
              {waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'item' : 'items'}` : 'Nothing right now'}
            </span>
          </div>
          {waiting.map((w) => (
            <div
              key={w.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px minmax(0,1fr) 200px',
                gap: 16,
                alignItems: 'center',
                padding: '12px 20px',
                borderBottom: '1px solid var(--line-soft)',
              }}
            >
              <span className="chip wait" style={{ justifySelf: 'start' }}>
                {w.tag}
              </span>
              <span>{w.text}</span>
              <a href={w.to} style={{ justifySelf: 'end', fontWeight: 500 }}>
                {w.link}
              </a>
            </div>
          ))}
        </section>

        <section className="card" aria-labelledby="ports">
          <div className="card-head">
            <h2 id="ports">Portfolios</h2>
            <span className="small muted">
              Each portfolio is ring-fenced: its own asset, terms, investors and documents
            </span>
          </div>
          {ws.portfolios.length === 0 ? (
            <p className="empty">
              No portfolios yet. <a href={href({ screen: 'new-portfolio' })}>Create the first one</a>.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Portfolio</th>
                  <th scope="col">Asset</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Records</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Target / hard cap
                  </th>
                  <th scope="col">Next step</th>
                </tr>
              </thead>
              <tbody>
                {ws.portfolios.map((p) => {
                  const a = p.asset?.data;
                  const o = p.offer?.data;
                  const source = ACQUISITION_SOURCES.find(([v]) => v === a?.acquisition_source)?.[1];
                  const done = RECORD_PARTS.filter(([key]) => p[key]).length;
                  const step = nextStep(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <a
                          href={href({ screen: 'portfolio', id: p.id, tab: 'summary' })}
                          style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}
                        >
                          {portfolioName(p)}
                        </a>
                        <span className="small muted" style={{ display: 'block' }}>
                          {String(p.portfolio.data.legal_name)}
                        </span>
                      </td>
                      <td>
                        {a ? (
                          <>
                            <span style={{ display: 'block' }}>
                              {String(a.issuer_name)}, {String(a.instrument)}
                            </span>
                            {source && (
                              <span
                                className={a.acquisition_source === 'gp_sourced' ? 'chip wait' : 'chip'}
                                style={{ marginTop: 6 }}
                              >
                                {source}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="muted">Not entered</span>
                        )}
                      </td>
                      <td>
                        <PortfolioStatus status={p.portfolio.data.status} />
                      </td>
                      <td>
                        <span className="pips" role="img" aria-label={`${done} of 5 records entered`}>
                          {RECORD_PARTS.map(([key]) => (
                            <span key={key} className={p[key] ? 'on' : undefined} />
                          ))}
                        </span>
                        <span className="small muted">{done === 5 ? 'Complete' : `${done} of 5`}</span>
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {o ? (
                          <>
                            {printMoney(o.target_size) ?? '–'}
                            <span className="small muted" style={{ display: 'block' }}>
                              cap {printMoney(o.hard_cap) ?? '–'}
                            </span>
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td>
                        <a href={step.to}>{step.text}</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 20 }}>
          <section className="card" aria-labelledby="umb-docs">
            <div className="card-head">
              <h2 id="umb-docs">Umbrella documents</h2>
              <span className="small muted">Shared by every portfolio</span>
            </div>
            {ws.umbrellaDocuments.length === 0 ? (
              <p className="empty">
                None yet. The subscription terms (U3) are not drafted (decision 0004), so subscription agreements can't
                pass the submission gate yet.
              </p>
            ) : (
              ws.umbrellaDocuments.map((d) => (
                <div key={d.id} className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="mono small muted">{d.class}</span>
                  <a href={href({ screen: 'document', id: d.id })} style={{ flexGrow: 1 }}>
                    {CLASS_NAMES[d.class]}
                  </a>
                  <DocumentState doc={d} />
                </div>
              ))
            )}
          </section>
          <section className="card" aria-labelledby="umb">
            <div className="card-head">
              <h2 id="umb">Umbrella</h2>
              <a href={href({ screen: 'umbrella' })}>Edit</a>
            </div>
            {u ? (
              <dl className="facts card-body" style={{ gridTemplateColumns: '130px minmax(0,1fr)' }}>
                <dt>Legal name</dt>
                <dd>{String(u.legal_name)}</dd>
                <dt>Company number</dt>
                <dd className="mono">{String(u.company_number)}</dd>
                <dt>Category</dt>
                <dd>{FUND_CATEGORIES.find(([v]) => v === u.fund_category)?.[1] ?? String(u.fund_category)}</dd>
                <dt>Directors</dt>
                <dd>{(u.directors as unknown[]).length}</dd>
                <dt>Sponsor</dt>
                <dd>{String(ws.sponsor?.data.legal_name ?? '–')}</dd>
              </dl>
            ) : (
              <p className="empty">
                Not entered. <a href={href({ screen: 'umbrella' })}>Enter the umbrella</a>.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
