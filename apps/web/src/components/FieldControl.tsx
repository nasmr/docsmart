/** One form field, bound to a path in the record being edited. */
import { useId, useState } from 'react';
import { printCount, printDate, printMoney, printRate } from '../lib/format.js';
import type { Field } from '../lib/forms.js';
import { type Issue, issuesAt } from '../lib/issues.js';
import { type Data, getPath } from '../lib/paths.js';
import { fractionToPercent, percentToFraction } from '../lib/percent.js';

export interface Binding {
  data: Data;
  set: (path: string, value: unknown) => void;
  issues: readonly Issue[];
  /** Ids are fixed once a record is saved. */
  locked: ReadonlySet<string>;
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

export function FieldRow({ field, path, scope, b }: { field: Field; path: string; scope: Data; b: Binding }) {
  const id = useId();
  if (field.when && !field.when(scope)) return null;
  const errors = issuesAt(b.issues, path);
  const value = getPath(b.data, path);
  if (field.kind === 'list') return <ListField field={field} path={path} b={b} errors={errors} />;
  return (
    <div className="field">
      <label className="name" htmlFor={id}>
        {field.label}
        {field.optional && <span className="opt">optional</span>}
      </label>
      <div className="control">
        <Control field={field} id={id} value={value} path={path} b={b} invalid={errors.length > 0} />
        <Prints field={field} value={value} />
        {field.hint && <span className="hint">{field.hint}</span>}
        {errors.map((e) => (
          <span key={e} className="error" role="alert">
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}

function Prints({ field, value }: { field: Field; value: unknown }) {
  let text: string | undefined;
  if (field.kind === 'date' && value) text = printDate(value);
  if (field.kind === 'money' && getPath(value, 'amount')) text = printMoney(value);
  if (field.kind === 'rate' && value) text = printRate(value);
  if (field.kind === 'int' && typeof value === 'number' && value >= 1000) text = printCount(value);
  if (!text) return null;
  return (
    <span className="prints">
      In documents: <b>{text}</b>
    </span>
  );
}

function Control({
  field,
  id,
  value,
  path,
  b,
  invalid,
}: {
  field: Field;
  id: string;
  value: unknown;
  path: string;
  b: Binding;
  invalid: boolean;
}) {
  const set = (v: unknown) => b.set(path, v);
  const blank = field.optional ? undefined : '';
  const readOnly = field.readOnly || b.locked.has(path);
  const common = { id, 'aria-invalid': invalid || undefined, readOnly };
  switch (field.kind) {
    case 'long':
      return <textarea {...common} value={str(value)} onChange={(e) => set(e.target.value || blank)} />;
    case 'date':
      return <input {...common} type="date" value={str(value)} onChange={(e) => set(e.target.value || blank)} />;
    case 'currency':
      return (
        <input
          {...common}
          className="currency"
          maxLength={3}
          value={str(value)}
          onChange={(e) => set(e.target.value.toUpperCase() || blank)}
        />
      );
    case 'int':
      return (
        <input
          {...common}
          inputMode="numeric"
          value={str(value)}
          onChange={(e) => {
            const t = e.target.value.trim();
            set(t === '' ? blank : /^\d+$/.test(t) ? Number(t) : t);
          }}
        />
      );
    case 'bool':
      return (
        <span className="check">
          <input {...common} type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} />
        </span>
      );
    case 'enum':
      return (
        <select {...common} value={str(value)} onChange={(e) => set(e.target.value || blank)} disabled={readOnly}>
          {(field.optional || value === undefined || value === '') && <option value="">Choose…</option>}
          {field.options.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      );
    case 'money':
      return <MoneyInput id={id} value={value} path={path} b={b} invalid={invalid} />;
    case 'rate':
      return <RateInput id={id} value={value} onChange={set} blank={blank} invalid={invalid} />;
    case 'lines':
      return <LinesInput id={id} value={value} onChange={set} blank={blank} invalid={invalid} />;
    case 'list':
      return null;
    default:
      return (
        <input
          {...common}
          type={field.kind === 'email' ? 'email' : 'text'}
          spellCheck={field.kind === 'id' ? false : undefined}
          className={field.kind === 'id' ? 'mono' : undefined}
          value={str(value)}
          onChange={(e) => set(e.target.value || blank)}
        />
      );
  }
}

function MoneyInput({
  id,
  value,
  path,
  b,
  invalid,
}: {
  id: string;
  value: unknown;
  path: string;
  b: Binding;
  invalid: boolean;
}) {
  return (
    <span className="row">
      <input
        className="currency"
        aria-label="Currency"
        maxLength={3}
        value={str(getPath(value, 'currency'))}
        onChange={(e) => b.set(`${path}.currency`, e.target.value.toUpperCase())}
      />
      <input
        id={id}
        className="grow num"
        inputMode="decimal"
        placeholder="0.00"
        aria-invalid={invalid || undefined}
        value={str(getPath(value, 'amount'))}
        onChange={(e) => b.set(`${path}.amount`, e.target.value.trim().replace(/,/g, ''))}
      />
    </span>
  );
}

/** Entered as a percentage, kept as a fraction: the conversion is exact (lib/percent.ts). */
function RateInput({
  id,
  value,
  onChange,
  blank,
  invalid,
}: {
  id: string;
  value: unknown;
  onChange: (v: unknown) => void;
  blank: '' | undefined;
  invalid: boolean;
}) {
  const [text, setText] = useState(() => (typeof value === 'string' ? (fractionToPercent(value) ?? value) : ''));
  return (
    <span className="row">
      <input
        id={id}
        className="grow num"
        inputMode="decimal"
        placeholder="e.g. 1.5"
        aria-invalid={invalid || undefined}
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          onChange(t.trim() === '' ? blank : (percentToFraction(t) ?? t));
        }}
      />
      <span className="suffix">%</span>
    </span>
  );
}

function LinesInput({
  id,
  value,
  onChange,
  blank,
  invalid,
}: {
  id: string;
  value: unknown;
  onChange: (v: unknown) => void;
  blank: '' | undefined;
  invalid: boolean;
}) {
  const [text, setText] = useState(() => (Array.isArray(value) ? value.join('\n') : ''));
  return (
    <textarea
      id={id}
      aria-invalid={invalid || undefined}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const lines = e.target.value
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        onChange(lines.length ? lines : blank === '' ? [] : undefined);
      }}
    />
  );
}

function ListField({
  field,
  path,
  b,
  errors,
}: {
  field: Extract<Field, { kind: 'list' }>;
  path: string;
  b: Binding;
  errors: string[];
}) {
  const items = (getPath(b.data, path) as Data[] | undefined) ?? [];
  const own = errors.filter((e) => !/^\d/.test(e));
  return (
    <div className="field">
      <span className="name">{field.label}</span>
      <div className="control">
        <div className="list">
          {items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: items have no stable key until their id is typed
            <div className="item" key={i}>
              <div className="item-head">
                <span>
                  {field.noun[0]?.toUpperCase()}
                  {field.noun.slice(1)} {i + 1}
                </span>
                <button
                  type="button"
                  className="linkish"
                  onClick={() =>
                    b.set(
                      path,
                      items.filter((_, j) => j !== i),
                    )
                  }
                >
                  Remove
                </button>
              </div>
              <div className="fields">
                {field.item.map((f) => (
                  <FieldRow key={f.path} field={f} path={`${path}.${i}.${f.path}`} scope={item} b={b} />
                ))}
              </div>
            </div>
          ))}
          <span>
            <button type="button" className="btn2" onClick={() => b.set(path, [...items, field.blank(items)])}>
              Add {field.noun}
            </button>
          </span>
        </div>
        {field.hint && <span className="hint">{field.hint}</span>}
        {own.map((e) => (
          <span key={e} className="error" role="alert">
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}
