import { useEffect, useState } from 'react';
import { href, parseRoute, type Route } from './lib/route.js';
import { useWorkspace, WorkspaceProvider } from './lib/useWorkspace.js';
import { portfolioName } from './lib/workspace.js';
import { AssembleScreen } from './screens/AssembleScreen.js';
import { DocumentScreen } from './screens/DocumentScreen.js';
import { DocumentsScreen } from './screens/DocumentsScreen.js';
import { Overview } from './screens/Overview.js';
import { NewPortfolioScreen, PortfolioScreen } from './screens/PortfolioScreen.js';
import { UmbrellaScreen } from './screens/UmbrellaScreen.js';
import './styles.css';

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}

function Shell() {
  const route = useRoute();
  const { ws } = useWorkspace();
  const current = (r: Route['screen'], id?: string) =>
    route.screen === r && (!id || ('id' in route && route.id === id)) ? ('page' as const) : undefined;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <b>Singularity</b>
          <span className="small muted">Document Factory</span>
        </div>
        <a className="umbrella-card" href={href({ screen: 'umbrella' })}>
          <b>{String(ws?.umbrella?.data.legal_name ?? 'No umbrella yet')}</b>
          <span className="small muted">BVI · {ws?.portfolios.length ?? 0} portfolios</span>
        </a>
        <nav className="nav" aria-label="Main">
          <a href={href({ screen: 'overview' })} aria-current={current('overview')}>
            Overview
          </a>
          <a href={href({ screen: 'umbrella' })} aria-current={current('umbrella')}>
            Umbrella and sponsor
          </a>
          <span className="nav-label">Portfolios</span>
          {ws?.portfolios.map((p) => (
            <a
              key={p.id}
              className="sub"
              href={href({ screen: 'portfolio', id: p.id, tab: 'summary' })}
              aria-current={current('portfolio', p.id)}
            >
              {portfolioName(p)}
            </a>
          ))}
          <a className="sub" href={href({ screen: 'new-portfolio' })} aria-current={current('new-portfolio')}>
            + New portfolio
          </a>
          <span className="nav-label">Documents</span>
          <a className="sub" href={href({ screen: 'documents' })} aria-current={current('documents')}>
            All documents
          </a>
        </nav>
        <div className="who">
          <span style={{ fontWeight: 500 }}>Sponsor</span>
          <span className="small muted">Development sign-in</span>
        </div>
      </aside>
      <main>
        <Screen route={route} />
      </main>
    </div>
  );
}

function Screen({ route }: { route: Route }) {
  switch (route.screen) {
    case 'overview':
      return <Overview />;
    case 'umbrella':
      return <UmbrellaScreen />;
    case 'portfolio':
      return <PortfolioScreen id={route.id} tab={route.tab} />;
    case 'new-portfolio':
      return <NewPortfolioScreen />;
    case 'documents':
      return <DocumentsScreen />;
    case 'new-document':
      return <AssembleScreen portfolio={route.portfolio} />;
    case 'assemble':
      return <AssembleScreen documentId={route.id} />;
    case 'document':
      return <DocumentScreen id={route.id} />;
  }
}
