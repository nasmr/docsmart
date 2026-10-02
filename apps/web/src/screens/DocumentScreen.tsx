/**
 * A document version, read-only (build plan B7; design: Draft artboard). Every piece of text shows
 * where it came from: template text plain, values from records underlined, values the calculation
 * service worked out dashed, signing blanks as lines, and missing values marked. The checks panel
 * holds the findings and the submission gate.
 */
import { DESIGNATION_WORDING_STATUS } from '@docsmart/domain/names';
import { useCallback, useEffect, useState } from 'react';
import { CLASS_NAMES, DocumentState, Failed, Loading, Top } from '../components/ui.js';
import {
  ApiError,
  type ApiErrorBody,
  api,
  type DocumentView,
  type Finding,
  message,
  type Package,
  type Version,
} from '../lib/api.js';
import { href } from '../lib/route.js';
import { useWorkspace } from '../lib/useWorkspace.js';
import { portfolioName } from '../lib/workspace.js';

type Block = Version['content']['body'][number];
type Piece = Extract<Block, { t: 'clause' }>['text'][number];

interface Loaded {
  doc: DocumentView;
  version?: Version;
  findings: Finding[];
  pkg?: Package;
}

export function DocumentScreen({ id }: { id: string }) {
  const { ws, reload: reloadWorkspace } = useWorkspace();
  const [loaded, setLoaded] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    try {
      const doc = await api.document(id);
      if (!doc.current_version) return setLoaded({ doc, findings: [] });
      const [version, findings, pkg] = await Promise.all([
        api.version(id, doc.current_version.id),
        api.findings(id, doc.current_version.id),
        doc.ready_version_id ? api.package(id) : Promise.resolve(undefined),
      ]);
      setLoaded({ doc, version, findings, ...(pkg ? { pkg } : {}) });
    } catch (e) {
      setError(message(e));
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Failed error={error} />;
  if (!loaded) return <Loading />;
  const { doc, version, findings, pkg } = loaded;
  const p = ws?.portfolios.find((x) => x.id === doc.portfolio_id);
  const body = version?.content.body ?? [];
  const headings = body.filter((b): b is Extract<Block, { t: 'heading' }> => b.t === 'heading' && b.level === 1);
  const blocking = findings.filter((f) => f.severity === 'blocks').length;
  const review = findings.length - blocking;

  return (
    <>
      <Top
        crumbs={
          <>
            <a href={p ? href({ screen: 'portfolio', id: p.id, tab: 'summary' }) : href({ screen: 'overview' })}>
              {p ? portfolioName(p) : 'Umbrella'}
            </a>{' '}
            / Documents
          </>
        }
        title={
          <>
            {CLASS_NAMES[doc.class]} {version && <span className="muted small mono">{version.content.template}</span>}
          </>
        }
      >
        <DocumentState doc={doc} />
        {version && (
          <button
            type="button"
            className="btn2"
            onClick={() => void api.downloadWord(doc.id, version.id).catch((e) => setError(message(e)))}
          >
            Download Word
          </button>
        )}
        {doc.state !== 'WITHDRAWN' && (
          <a className="btn2" href={href({ screen: 'assemble', id: doc.id })}>
            {version ? 'New version' : 'Assemble'}
          </a>
        )}
      </Top>
      <div className="banner">Prepared for review by qualified counsel. Not a legal opinion and not legal advice.</div>
      {!version ? (
        <div className="content">
          <p className="muted">
            Not assembled yet. <a href={href({ screen: 'assemble', id: doc.id })}>Assemble the first version</a>.
          </p>
        </div>
      ) : (
        <div className="docgrid">
          <nav className="doc-outline" aria-label="Document outline">
            <span className="small muted" style={{ marginBottom: 6 }}>
              Outline
            </span>
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#/documents/${doc.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`blk-${h.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {h.number ? `${h.number} ` : ''}
                {plain(h.text)}
              </a>
            ))}
          </nav>
          <div className="well">
            <div className="legend">
              <span>
                <span className="k-record" />
                Filled from your records
              </span>
              <span>
                <span className="k-record" style={{ borderBottomStyle: 'dashed' }} />
                Worked out by the calculation service
              </span>
              <span>
                <span className="k-template" />
                Approved template text
              </span>
              <span>
                <span className="k-missing" />
                Missing
              </span>
              <span>
                <span className="k-ai" />
                Assistant drafting (not in this slice)
              </span>
            </div>
            <div className="small muted">
              Version {version.number} · <span className="mono">{version.content_hash.slice(0, 12)}…</span> · frozen:
              any change makes a new version
            </div>
            <article className="doc">
              {body.map((b) => (
                <BlockView key={b.id} b={b} />
              ))}
            </article>
          </div>
          <Checks
            doc={doc}
            findings={findings}
            blocking={blocking}
            review={review}
            pkg={pkg}
            onChange={async () => {
              await load();
              await reloadWorkspace();
            }}
          />
        </div>
      )}
    </>
  );
}

const plain = (pieces: readonly Piece[]) =>
  pieces.map((x) => (x.t === 'text' || x.t === 'value' ? x.v : x.t === 'blank' ? '____' : `[${x.field}]`)).join('');

function Pieces({ pieces }: { pieces: readonly Piece[] }) {
  return (
    <>
      {pieces.map((x, i) => {
        const key = `${i}`;
        switch (x.t) {
          case 'text':
            return <span key={key}>{x.v}</span>;
          case 'value':
            return (
              <span
                key={key}
                className={x.origin === 'calculated' ? 'slot calc' : 'slot'}
                title={`${x.field} · ${x.origin === 'calculated' ? 'worked out by the calculation service' : `from ${x.origin}`}`}
              >
                {x.v}
              </span>
            );
          case 'blank':
            return <span key={key} className="blank" title={`${x.field} · completed at signing`} />;
          case 'missing':
            return (
              <span key={key} className="missing" title={x.reason}>
                {x.field} missing
              </span>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  const id = `blk-${b.id}`;
  switch (b.t) {
    case 'heading':
      return (
        <h3 id={id} style={b.level > 1 ? { fontSize: 15 } : undefined}>
          {b.number && `${b.number} `}
          <Pieces pieces={b.text} />
        </h3>
      );
    case 'clause':
      return (
        <div id={id} className="clause">
          <span>{b.number}</span>
          <p>
            <Pieces pieces={b.text} />
          </p>
        </div>
      );
    case 'para': {
      const cls = {
        title: 'd-title',
        subtitle: 'd-subtitle',
        body: undefined,
        bullet: 'bullet',
        check: 'check-line',
        signature: 'signature',
      }[b.style];
      return (
        <p id={id} className={cls}>
          <Pieces pieces={b.text} />
        </p>
      );
    }
    case 'table':
      return (
        <table id={id}>
          <tbody>
            {b.rows.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows of a frozen version never move
              <tr key={i}>
                {r.map((c, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells of a frozen version never move
                  <td key={j}>
                    <Pieces pieces={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'zone':
      return (
        <div id={id} className="zone">
          {b.text.length ? (
            <Pieces pieces={b.text} />
          ) : (
            <>
              <strong>Drafting zone “{b.zone}”.</strong> Left empty: assistant drafting is not part of this slice.
              Anything written here later is marked as the assistant's and checked against your sources.
            </>
          )}
        </div>
      );
    case 'locked':
      return (
        <div id={id} className="locked-line">
          <span className="wording">
            <Pieces pieces={b.text} />
          </span>
          <span className="why">
            Locked{DESIGNATION_WORDING_STATUS !== 'confirmed' ? ' · wording awaits counsel' : ''}
          </span>
        </div>
      );
  }
}

function Checks({
  doc,
  findings,
  blocking,
  review,
  pkg,
  onChange,
}: {
  doc: DocumentView;
  findings: Finding[];
  blocking: number;
  review: number;
  pkg?: Package | undefined;
  onChange: () => Promise<void>;
}) {
  const [gate, setGate] = useState<{ busy?: boolean; refused?: ApiErrorBody['gate']; error?: string }>({});
  const ready = doc.state === 'READY_FOR_SUBMISSION';

  async function markReady() {
    setGate({ busy: true });
    try {
      await api.markReady(doc.id);
      setGate({});
      await onChange();
    } catch (e) {
      if (e instanceof ApiError && e.body.error === 'gate_refused') setGate({ refused: e.body.gate });
      else setGate({ error: message(e) });
    }
  }

  return (
    <aside className="checks" aria-labelledby="checks">
      <div className="checks-head">
        <h2 id="checks">Checks</h2>
        <span className="small muted">
          {findings.length === 0
            ? 'Nothing found'
            : [blocking && `${blocking} blocking`, review && `${review} to review`].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="checks-list">
        {findings.length === 0 && (
          <div className="finding" style={{ borderColor: '#bfdccb', background: '#f1f8f3' }}>
            <span className="sev" style={{ color: 'var(--pass)' }}>
              Passed
            </span>
            <span className="small">
              Every required value is filled and the contracting party is generated from the records.
            </span>
          </div>
        )}
        {findings.map((f) => (
          <FindingCard key={f.id} f={f} docId={doc.id} />
        ))}
        <p className="small muted" style={{ margin: 0 }}>
          Only the required-value and contracting-party checks run in this slice.
        </p>
      </div>
      <div className="gate">
        {ready && pkg ? (
          <div className="notice pass">
            <strong>Ready for submission</strong>
            <dl className="facts small" style={{ gridTemplateColumns: '90px minmax(0,1fr)', marginTop: 8 }}>
              <dt>Version</dt>
              <dd className="mono">{pkg.version_id}</dd>
              <dt>Passed by</dt>
              <dd>{pkg.passed_by}</dd>
              <dt>Package</dt>
              <dd className="mono" style={{ wordBreak: 'break-all' }}>
                {pkg.package_hash}
              </dd>
            </dl>
            <p className="small" style={{ margin: '8px 0 0' }}>
              Frozen. Changing the records does not change it; a new version would need the gate again. Counsel review
              comes in the next slice.
            </p>
          </div>
        ) : doc.state === 'WITHDRAWN' ? (
          <div className="notice">Withdrawn.</div>
        ) : (
          <>
            <button type="button" className="btn" disabled={gate.busy || blocking > 0} onClick={() => void markReady()}>
              Mark ready for submission
            </button>
            <span className="small muted">
              {blocking > 0
                ? 'Fix the blocking findings first: correct the records or entries, then assemble a new version.'
                : 'Runs the submission gate on this version. Nothing goes to counsel from here in this slice.'}
            </span>
            {gate.refused && (
              <div className="notice block" role="alert">
                <strong>The gate refused it</strong>
                <ul className="small">
                  {gate.refused.failures.map((x) => (
                    <li key={`${x.condition}:${x.message}`}>
                      <span className="mono">({x.condition})</span> {x.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gate.error && (
              <div className="notice block" role="alert">
                {gate.error}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

const CHECK_NAMES: Record<string, string> = {
  required_slot: 'Required value',
  contracting_party: 'Contracting party',
};

function FindingCard({ f, docId }: { f: Finding; docId: string }) {
  const [reason, setReason] = useState('');
  const [state, setState] = useState<{ done?: string; error?: string }>({});
  const go = () => {
    const el = document.getElementById(`blk-${f.at}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  };
  const dispose = async (body: Parameters<typeof api.dispose>[1]) => {
    try {
      await api.dispose(f.id, body);
      setState({ done: body.decision === 'keep' ? 'Kept, with your reason.' : 'Marked to fix in a new version.' });
    } catch (e) {
      setState({ error: message(e) });
    }
  };
  return (
    <div className={`finding ${f.severity}`}>
      <div className="row">
        <span className="sev">{f.severity === 'blocks' ? 'Blocking' : 'Needs your review'}</span>
        <span className="kind">{CHECK_NAMES[f.check] ?? f.check}</span>
      </div>
      <span className="small">{f.message}</span>
      <div className="row small">
        <button type="button" className="linkish" onClick={go}>
          Show in document
        </button>
        {f.severity === 'blocks' && <a href={href({ screen: 'assemble', id: docId })}>Fix in a new version</a>}
      </div>
      {f.severity === 'review' && !state.done && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input placeholder="Why it can stay as it is" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="row">
            <button
              type="button"
              className="btn2"
              disabled={!reason.trim()}
              onClick={() => void dispose({ decision: 'keep', reason })}
            >
              Keep
            </button>
            <button type="button" className="btn2" onClick={() => void dispose({ decision: 'fix' })}>
              Fix
            </button>
          </div>
        </div>
      )}
      {state.done && <span className="small">{state.done}</span>}
      {state.error && <span className="error">{state.error}</span>}
    </div>
  );
}
