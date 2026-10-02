/**
 * Creating a document and assembling a version of it. The sponsor picks the template and enters what
 * belongs to this document (dates, declarations of interest, the investor, the documents it builds
 * on); everything else comes from the records. Assembly is deterministic: no model writes here.
 */
import { useEffect, useMemo, useState } from 'react';
import { type Binding, FieldRow } from '../components/FieldControl.js';
import { CLASS_NAMES, Failed, Loading, Top } from '../components/ui.js';
import { ApiError, api, type DocumentView, type ListedRecord, message, type Template } from '../lib/api.js';
import {
  approvedTemplates,
  blankInterests,
  buildRequest,
  type Draft,
  DraftProblem,
  suggestDocumentId,
  suggestTemplate,
  TEMPLATE_USE,
} from '../lib/assembly.js';
import type { Field } from '../lib/forms.js';
import { type Data, getPath, setPath } from '../lib/paths.js';
import { href } from '../lib/route.js';
import { useWorkspace } from '../lib/useWorkspace.js';
import { portfolioName } from '../lib/workspace.js';

type Cls = DocumentView['class'];
const PORTFOLIO_CLASSES: Cls[] = ['D12', 'D13', 'D1-SP'];

const remembered = (id: string): Draft | undefined => {
  try {
    const s = localStorage.getItem(`draft:${id}`);
    return s ? (JSON.parse(s) as Draft) : undefined;
  } catch {
    return undefined;
  }
};
const remember = (id: string, d: Draft) => {
  try {
    localStorage.setItem(`draft:${id}`, JSON.stringify(d));
  } catch {
    // A convenience only.
  }
};

interface Director {
  id: string;
  name: string;
}
interface Signatory {
  id: string;
  name: string;
  title: string;
}

export function AssembleScreen({ portfolio, documentId }: { portfolio?: string | undefined; documentId?: string }) {
  const { ws, error, reload } = useWorkspace();
  const [templates, setTemplates] = useState<Template[]>();
  const [subs, setSubs] = useState<ListedRecord[]>([]);
  const [parties, setParties] = useState<ListedRecord[]>([]);
  const [loadError, setLoadError] = useState<string>();
  useEffect(() => {
    Promise.all([api.templates(), api.records('subscription_request'), api.records('party')])
      .then(([t, s, p]) => {
        setTemplates(t);
        setSubs(s);
        setParties(p);
      })
      .catch((e) => setLoadError(message(e)));
  }, []);

  const existing = documentId ? ws?.documents.find((d) => d.id === documentId) : undefined;
  const portfolioId = existing ? (existing.portfolio_id ?? undefined) : portfolio;
  const p = ws?.portfolios.find((x) => x.id === portfolioId);
  const [cls, setCls] = useState<Cls>(existing?.class ?? (portfolio ? 'D12' : 'U3'));
  useEffect(() => {
    if (existing) setCls(existing.class);
  }, [existing]);
  const [docId, setDocId] = useState('');
  const [draft, setDraft] = useState<Draft>(
    () => (documentId && remembered(documentId)) || { template_version_id: '', inputs: {} },
  );
  const [status, setStatus] = useState<{ busy?: boolean; error?: string }>({});

  const umbrella = ws?.umbrella?.data;
  const directors = (umbrella?.directors as Director[] | undefined) ?? [];
  const signatories = (umbrella?.authorised_signatories as Signatory[] | undefined) ?? [];
  const offerId = p?.offer?.data.id;
  const portfolioSubs = subs.filter((s) => s.data.offer_id === offerId);
  const party = parties.find((x) => x.id === draft.party_id);
  const offered = useMemo(() => approvedTemplates(templates ?? [], cls), [templates, cls]);
  const chosen = offered.find((t) => t.id === draft.template_version_id);

  // Defaults when the class (or what decides the template) changes.
  const taken = ws?.documents.map((d) => d.id) ?? [];
  useEffect(() => {
    if (!existing && ws)
      setDocId(
        suggestDocumentId(
          portfolioId,
          cls,
          ws.documents.map((d) => d.id),
        ),
      );
  }, [cls, existing, portfolioId, ws]);
  const suggested = suggestTemplate(cls, {
    acquisition_source: p?.asset?.data.acquisition_source,
    party_type: party?.data.type,
  });
  // Follows the suggestion until the sponsor picks a template themselves.
  const [picked, setPicked] = useState(!!documentId);
  useEffect(() => {
    if (!templates) return;
    setDraft((d) => {
      const valid = offered.some((t) => t.id === d.template_version_id);
      if (valid && picked) return d;
      const pick = offered.find((t) => t.template === suggested) ?? (valid ? undefined : offered[0]);
      return pick && pick.id !== d.template_version_id ? { ...d, template_version_id: pick.id } : d;
    });
  }, [templates, offered, suggested, picked]);
  useEffect(() => {
    if (cls === 'D12' && !draft.inputs.director_interests && directors.length)
      setDraft((d) => ({ ...d, inputs: { ...d.inputs, director_interests: blankInterests(directors) } }));
  }, [cls, directors, draft.inputs.director_interests]);

  if ((error || loadError) && !ws) return <Failed error={error ?? loadError ?? ''} />;
  if (!ws || !templates) return loadError ? <Failed error={loadError} /> : <Loading />;
  if (documentId && !existing) return <Failed error={`There is no document ${documentId}.`} />;
  if (portfolioId && !p) return <Failed error={`There is no portfolio ${portfolioId}.`} />;

  const setInput = (path: string, value: unknown) =>
    setDraft((d) => ({ ...d, inputs: setPath(d.inputs, path, value) }));
  const b: Binding = { data: draft.inputs, set: setInput, issues: [], locked: new Set() };
  const row = (f: Field) => <FieldRow key={f.path} field={f} path={f.path} scope={draft.inputs} b={b} />;
  const d13s = p?.documents.filter((d) => d.class === 'D13' && d.current_version) ?? [];
  const u3s = ws.umbrellaDocuments.filter((d) => d.class === 'U3' && d.current_version);
  const tpl = chosen?.template;

  async function submit() {
    setStatus({ busy: true });
    try {
      const body = buildRequest(draft, ws?.documents ?? []);
      const id = existing?.id ?? docId;
      if (!existing) {
        await api.createDocument({
          id,
          class: cls,
          scope: portfolioId ? 'portfolio' : 'umbrella',
          umbrella_id: ws?.umbrella?.id ?? '',
          portfolio_id: portfolioId ?? null,
        });
      }
      await api.assemble(id, body);
      remember(id, draft);
      await reload();
      window.location.hash = href({ screen: 'document', id });
    } catch (e) {
      const text =
        e instanceof DraftProblem
          ? e.message
          : e instanceof ApiError && e.body.issues
            ? `${e.message} ${e.body.issues.join('; ')}`
            : message(e);
      setStatus({ error: text });
    }
  }

  const where = p ? portfolioName(p) : 'Umbrella';
  return (
    <>
      <Top
        crumbs={
          <>
            <a href={p ? href({ screen: 'portfolio', id: p.id, tab: 'summary' }) : href({ screen: 'overview' })}>
              {where}
            </a>{' '}
            / Documents
          </>
        }
        title={existing ? `New version of the ${CLASS_NAMES[existing.class].toLowerCase()}` : 'New document'}
      />
      <form
        className="content form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {p &&
          p.documents.length === 0 &&
          Object.values({ t: p.terms, o: p.offer, a: p.asset, s: p.account }).some((x) => !x) && (
            <div className="notice wait">
              Some of {where}'s records are not entered yet. Assembly will mark what is missing; nothing is filled in by
              guesswork.
            </div>
          )}
        <fieldset>
          <legend>Document</legend>
          <div className="fields">
            <div className="field">
              <label className="name" htmlFor="cls">
                Kind
              </label>
              <div className="control">
                <select
                  id="cls"
                  value={cls}
                  disabled={!!existing}
                  onChange={(e) => {
                    setCls(e.target.value as Cls);
                    setPicked(false);
                    setDraft({ template_version_id: '', inputs: {} });
                  }}
                >
                  {(portfolioId ? PORTFOLIO_CLASSES : (['U3'] as Cls[])).map((c) => (
                    <option key={c} value={c}>
                      {CLASS_NAMES[c]} ({c})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="name" htmlFor="docid">
                Document id
              </label>
              <div className="control">
                <input
                  id="docid"
                  className="mono"
                  value={existing?.id ?? docId}
                  readOnly={!!existing}
                  onChange={(e) => setDocId(e.target.value)}
                />
                {!existing && taken.includes(docId) && <span className="error">That id is taken.</span>}
              </div>
            </div>
            <div className="field">
              <label className="name" htmlFor="tpl">
                Template
              </label>
              <div className="control">
                {offered.length === 0 ? (
                  <span className="error">
                    No approved {cls} template. Templates are approved by counsel before they can be used.
                  </span>
                ) : (
                  <select
                    id="tpl"
                    value={draft.template_version_id}
                    onChange={(e) => {
                      setPicked(true);
                      setDraft((d) => ({ ...d, template_version_id: e.target.value }));
                    }}
                  >
                    {offered.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.template} version {t.version}
                        {t.template === suggested ? ' (suggested)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {tpl && <span className="hint">{TEMPLATE_USE[tpl] ?? ''}</span>}
                {chosen?.approval && (
                  <span className="hint">
                    Approved by <span className="mono">{chosen.approval.lawyer_id}</span> for{' '}
                    {chosen.approval.jurisdictions.join(', ')}.
                  </span>
                )}
              </div>
            </div>
          </div>
        </fieldset>

        {cls === 'D12' && (
          <fieldset>
            <legend>
              Resolution
              <span className="muted">Entered for this document; not kept on the records.</span>
            </legend>
            <div className="fields">
              {tpl !== 'D12-C' && row({ kind: 'date', path: 'resolution_date', label: 'Date of the resolutions' })}
              {row({
                kind: 'date',
                path: 'effective_date',
                label: 'Portfolio created on',
                hint: 'Later than the resolutions if creation waits for something.',
              })}
              {tpl === 'D12-C' && (
                <>
                  {row({ kind: 'date', path: 'meeting.date', label: 'Meeting date' })}
                  {row({
                    kind: 'time',
                    path: 'meeting.time',
                    label: 'Meeting time',
                    hint: 'With UTC offset, e.g. 15:00+04:00',
                  })}
                  {row({ kind: 'text', path: 'meeting.place', label: 'Place or video platform' })}
                  {row({ kind: 'text', path: 'meeting.in_attendance', label: 'Also attending', optional: true })}
                  {row({
                    kind: 'enum',
                    path: 'meeting.chair_director_id',
                    label: 'Chair',
                    options: directors.map((d) => [d.id, d.name] as const),
                  })}
                  <div className="field">
                    <span className="name">Directors present</span>
                    <div className="control">
                      {directors.map((d) => {
                        const ids =
                          (getPath(draft.inputs, 'meeting.attendee_director_ids') as string[] | undefined) ?? [];
                        return (
                          <label key={d.id} className="check">
                            <input
                              type="checkbox"
                              checked={ids.includes(d.id)}
                              onChange={(e) =>
                                setInput(
                                  'meeting.attendee_director_ids',
                                  e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id),
                                )
                              }
                            />
                            {d.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </fieldset>
        )}

        {cls === 'D12' && (
          <fieldset>
            <legend>
              Declarations of interest
              <span className="muted">Each director's interest in this transaction, as they declared it.</span>
            </legend>
            <div className="fields">
              {((draft.inputs.director_interests as Data[] | undefined) ?? []).map((di, i) => {
                const name = directors.find((d) => d.id === di.director_id)?.name ?? String(di.director_id);
                const base = `director_interests.${i}`;
                return (
                  <div className="field" key={String(di.director_id)}>
                    <span className="name">{name}</span>
                    <div className="control">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={di.is_interested === true}
                          onChange={(e) => setInput(`${base}.is_interested`, e.target.checked)}
                        />
                        Has declared an interest
                      </label>
                      {di.is_interested === true && (
                        <>
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={di.abstains === true}
                              onChange={(e) => setInput(`${base}.abstains`, e.target.checked)}
                            />
                            Abstains from voting
                          </label>
                          <textarea
                            aria-label={`${name}: nature of the interest`}
                            placeholder="Nature of the interest, as it should read in the resolution"
                            value={String(di.description ?? '')}
                            onChange={(e) => setInput(`${base}.description`, e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        {cls === 'D13' && (
          <fieldset>
            <legend>Supplement</legend>
            <div className="fields">
              {row({
                kind: 'int',
                path: 'supplement_number',
                label: 'Supplement number',
                hint: 'Under the offering memorandum.',
              })}
              {row({ kind: 'date', path: 'date', label: 'Date of the supplement' })}
            </div>
          </fieldset>
        )}

        {cls === 'D1-SP' && (
          <>
            <fieldset>
              <legend>
                Investor
                <span className="muted">From the subscription requests for this portfolio's offer.</span>
              </legend>
              <div className="fields">
                <div className="field">
                  <label className="name" htmlFor="sub">
                    Subscription request
                  </label>
                  <div className="control">
                    <select
                      id="sub"
                      value={draft.subscription_id ?? ''}
                      onChange={(e) => {
                        const s = portfolioSubs.find((x) => x.id === e.target.value);
                        setDraft((d) => {
                          const { subscription_id: _, party_id: __, ...rest } = d;
                          return s ? { ...rest, subscription_id: s.id, party_id: String(s.data.party_id) } : rest;
                        });
                      }}
                    >
                      <option value="">Choose…</option>
                      {portfolioSubs.map((s) => {
                        const pt = parties.find((x) => x.id === s.data.party_id)?.data;
                        return (
                          <option key={s.id} value={s.id}>
                            {String(pt?.full_name ?? pt?.legal_name ?? s.data.party_id)} · {s.id}
                          </option>
                        );
                      })}
                    </select>
                    {portfolioSubs.length === 0 && (
                      <span className="hint">No subscription requests for this offer.</span>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label className="name" htmlFor="sig">
                    Signing for the company
                  </label>
                  <div className="control">
                    <select
                      id="sig"
                      value={String(draft.inputs.company_signatory_id ?? '')}
                      onChange={(e) => setInput('company_signatory_id', e.target.value || undefined)}
                    >
                      <option value="">Choose…</option>
                      {signatories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}, {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {tpl === 'D1SP-C' &&
                  row({ kind: 'long', path: 'changes_since_prior', label: 'Changes since the earlier agreement' })}
              </div>
            </fieldset>
            <fieldset>
              <legend>
                Built on
                <span className="muted">The documents this agreement refers to, at their current version.</span>
              </legend>
              <div className="fields">
                <div className="field">
                  <label className="name" htmlFor="d13">
                    Portfolio supplement
                  </label>
                  <div className="control">
                    <select
                      id="d13"
                      value={draft.d13 ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, d13: e.target.value || undefined }) as Draft)}
                    >
                      <option value="">None</option>
                      {d13s.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.id} · version {d.current_version?.number}
                        </option>
                      ))}
                    </select>
                    {d13s.length === 0 && <span className="hint">Assemble this portfolio's supplement first.</span>}
                  </div>
                </div>
                <div className="field">
                  <label className="name" htmlFor="u3">
                    Subscription terms
                  </label>
                  <div className="control">
                    <select
                      id="u3"
                      value={draft.u3 ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, u3: e.target.value || undefined }) as Draft)}
                    >
                      <option value="">None</option>
                      {u3s.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.id} · version {d.current_version?.number}
                        </option>
                      ))}
                    </select>
                    {u3s.length === 0 && (
                      <span className="hint">
                        The umbrella subscription terms (U3) are not drafted yet (decision 0004), so this agreement can
                        be assembled but cannot pass the submission gate.
                      </span>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label className="name" htmlFor="d15">
                    Conflict disclosure date
                  </label>
                  <div className="control">
                    <input
                      id="d15"
                      type="date"
                      value={draft.d15_date ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, d15_date: e.target.value || undefined }) as Draft)}
                    />
                    <span className="hint">
                      Only where the asset is supplied by the sponsor. D15 itself is not in this slice.
                    </span>
                  </div>
                </div>
                {tpl === 'D1SP-C' &&
                  (['portfolio_legal_name', 'executed_date', 'ref'] as const).map((k) => (
                    <div className="field" key={k}>
                      <label className="name" htmlFor={`earlier-${k}`}>
                        {
                          {
                            portfolio_legal_name: 'Earlier agreement: portfolio',
                            executed_date: 'Earlier agreement: signed on',
                            ref: 'Earlier agreement: reference',
                          }[k]
                        }
                      </label>
                      <div className="control">
                        <input
                          id={`earlier-${k}`}
                          type={k === 'executed_date' ? 'date' : 'text'}
                          value={draft.earlier?.[k] ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, earlier: { ...d.earlier, [k]: e.target.value } }))}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </fieldset>
          </>
        )}

        <div className="savebar">
          <span className="status">
            {status.busy && 'Assembling…'}
            {status.error && <span className="error">{status.error}</span>}
            {!status.busy && !status.error && (
              <span className="muted">
                Assembly fills the template from the records and these entries, and records a new version. Missing
                values are marked, never guessed.
              </span>
            )}
          </span>
          <a
            className="btn2"
            href={
              existing
                ? href({ screen: 'document', id: existing.id })
                : p
                  ? href({ screen: 'portfolio', id: p.id, tab: 'summary' })
                  : href({ screen: 'overview' })
            }
          >
            Cancel
          </a>
          <button
            type="submit"
            className="btn"
            disabled={status.busy || !draft.template_version_id || (!existing && (!docId || taken.includes(docId)))}
          >
            {existing ? 'Assemble new version' : 'Create and assemble'}
          </button>
        </div>
      </form>
    </>
  );
}
