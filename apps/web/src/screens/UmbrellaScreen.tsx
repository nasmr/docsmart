/** The umbrella company and its sponsor: the records every document of every portfolio draws on. */
import { useState } from 'react';
import { RecordForm } from '../components/RecordForm.js';
import { Failed, Loading, Top } from '../components/ui.js';
import { sponsorForm, umbrellaForm } from '../lib/forms.js';
import { href } from '../lib/route.js';
import { useWorkspace } from '../lib/useWorkspace.js';

const NO_CONTEXT = {};

export function UmbrellaScreen() {
  const { ws, error, reload } = useWorkspace();
  const [tab, setTab] = useState<'umbrella' | 'sponsor'>('umbrella');
  if (error && !ws) return <Failed error={error} />;
  if (!ws) return <Loading />;
  const record = tab === 'umbrella' ? ws.umbrella : ws.sponsor;
  return (
    <>
      <Top crumbs={<a href={href({ screen: 'overview' })}>Overview</a>} title="Umbrella and sponsor" />
      <div className="content">
        <nav className="tabs" aria-label="Records">
          {(['umbrella', 'sponsor'] as const).map((t) => (
            <button key={t} type="button" aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
              <span className={`dot${(t === 'umbrella' ? ws.umbrella : ws.sponsor) ? ' on' : ''}`} />
              {t === 'umbrella' ? 'Umbrella company' : 'Sponsor'}
            </button>
          ))}
        </nav>
        {tab === 'umbrella' && (
          <p className="small muted" style={{ margin: 0 }}>
            Changes here reach every portfolio's documents the next time they are assembled. Documents already marked
            ready keep the version they were assembled with (decision 0009).
          </p>
        )}
        <RecordForm
          key={`${tab}:${record?.id ?? 'new'}`}
          spec={tab === 'umbrella' ? umbrellaForm : sponsorForm}
          entity={tab}
          ctx={NO_CONTEXT}
          initial={record?.data}
          version={record?.version}
          onSaved={() => void reload()}
        />
      </div>
    </>
  );
}
