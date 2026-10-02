/**
 * A record form: edits a copy of the record and saves it as a new version (PUT /records). The API
 * validates; its messages are placed beside the fields they name.
 */
import { useMemo, useState } from 'react';
import { ApiError, api, type Entity, message } from '../lib/api.js';
import { type Context, type FormSpec, fieldPaths, prepareForSave } from '../lib/forms.js';
import { type Issue, parseIssues, unplaced } from '../lib/issues.js';
import { type Data, setPath } from '../lib/paths.js';
import { FieldRow } from './FieldControl.js';

export function RecordForm({
  spec,
  entity,
  ctx,
  initial,
  version,
  onSaved,
}: {
  spec: FormSpec;
  entity: Entity;
  ctx: Context;
  /** The current record; a new one is started from the form's blank when there is none. */
  initial?: Data | undefined;
  version?: number | undefined;
  onSaved?: (data: Data, id: string, version: number) => void;
}) {
  // Set once: the parent remounts the form (by key) when it loads a different record or version.
  const [start, setStart] = useState<Data>(() => initial ?? spec.blank(ctx));
  const [data, setData] = useState<Data>(start);
  const [issues, setIssues] = useState<Issue[]>([]);
  // Remounts the fields on discard, so inputs that keep their own text (rates, lines) start again.
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'failed'; text?: string }>({
    kind: 'idle',
  });
  const dirty = JSON.stringify(data) !== JSON.stringify(start);
  const [saved, setSaved] = useState(!!initial);
  const locked = useMemo(() => new Set(saved ? ['id'] : []), [saved]);
  const b = {
    data,
    issues,
    locked,
    set: (path: string, value: unknown) => {
      setData((d) => setPath(d, path, value));
      if (status.kind === 'saved') setStatus({ kind: 'idle' });
    },
  };
  const top = unplaced(issues, fieldPaths(spec, data));

  async function save() {
    const record = prepareForSave(spec, data);
    const id = spec.idOf(record, ctx);
    if (!id) {
      setIssues([{ path: 'id', message: 'is required' }]);
      setStatus({ kind: 'failed', text: 'Give the record an id.' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      const saved = await api.saveRecord(entity, id, record);
      setIssues([]);
      setData(record);
      setStart(record);
      setSaved(true);
      setStatus({ kind: 'saved', text: `Saved as version ${saved.version}.` });
      onSaved?.(record, id, saved.version);
    } catch (e) {
      if (e instanceof ApiError && e.body.error === 'invalid_record' && e.body.issues) {
        const found = parseIssues(e.body.issues);
        setIssues(found);
        setStatus({
          kind: 'failed',
          text: `Not saved: ${found.length} ${found.length === 1 ? 'problem' : 'problems'} to fix.`,
        });
      } else setStatus({ kind: 'failed', text: `Not saved: ${message(e)}` });
    }
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {top.length > 0 && (
        <div className="notice block" role="alert">
          <strong>The record as a whole</strong>
          <ul>
            {top.map((i) => (
              <li key={`${i.path}:${i.message}`}>{i.path ? `${i.path}: ${i.message}` : i.message}</li>
            ))}
          </ul>
        </div>
      )}
      {spec.sections.map((s) =>
        s.when && !s.when(data) ? null : (
          <fieldset key={`${s.title}:${epoch}`}>
            <legend>
              {s.title}
              {s.note && <span className="muted">{s.note}</span>}
            </legend>
            <div className="fields">
              {s.fields.map((f) => (
                <FieldRow key={f.path} field={f} path={f.path} scope={data} b={b} />
              ))}
            </div>
          </fieldset>
        ),
      )}
      <div className="savebar">
        <span className="status" aria-live="polite">
          {status.kind === 'saving' && 'Saving…'}
          {status.kind === 'saved' && <span style={{ color: 'var(--pass)' }}>{status.text}</span>}
          {status.kind === 'failed' && <span className="error">{status.text}</span>}
          {status.kind === 'idle' &&
            (dirty ? (
              'Unsaved changes.'
            ) : version ? (
              <span className="muted">Version {version}. Saving adds a new version; earlier ones are kept.</span>
            ) : (
              <span className="muted">Not saved yet.</span>
            ))}
        </span>
        {dirty && (
          <button
            type="button"
            className="btn2"
            onClick={() => {
              setData(start);
              setEpoch((n) => n + 1);
              setIssues([]);
              setStatus({ kind: 'idle' });
            }}
          >
            Discard changes
          </button>
        )}
        <button type="submit" className="btn" disabled={status.kind === 'saving' || (!dirty && saved)}>
          Save
        </button>
      </div>
    </form>
  );
}
