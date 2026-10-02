/** Every document in the workspace, by portfolio. */
import { CLASS_NAMES, DocumentState, Failed, Loading, Top } from '../components/ui.js';
import { href } from '../lib/route.js';
import { useWorkspace } from '../lib/useWorkspace.js';
import { portfolioName } from '../lib/workspace.js';

export function DocumentsScreen() {
  const { ws, error } = useWorkspace();
  if (error && !ws) return <Failed error={error} />;
  if (!ws) return <Loading />;
  const name = (pid: string | null) => {
    const p = ws.portfolios.find((x) => x.id === pid);
    return p ? portfolioName(p) : 'Umbrella';
  };
  return (
    <>
      <Top crumbs={<a href={href({ screen: 'overview' })}>Overview</a>} title="Documents" />
      <div className="content">
        <section className="card">
          {ws.documents.length === 0 ? (
            <p className="empty">No documents yet. Create one from a portfolio once its records are entered.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Portfolio</th>
                  <th scope="col">Id</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {ws.documents.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <a href={href({ screen: 'document', id: d.id })}>{CLASS_NAMES[d.class]}</a>
                    </td>
                    <td>{name(d.portfolio_id)}</td>
                    <td className="mono small">{d.id}</td>
                    <td>
                      <DocumentState doc={d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
