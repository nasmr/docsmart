/** Screens are addressed by the URL hash, so a reload or a shared link opens the same screen. */
export type PortfolioTab = 'summary' | 'portfolio' | 'terms' | 'offer' | 'asset' | 'account';
export const PORTFOLIO_TABS: readonly PortfolioTab[] = ['summary', 'portfolio', 'terms', 'offer', 'asset', 'account'];

export type Route =
  | { screen: 'overview' }
  | { screen: 'umbrella' }
  | { screen: 'portfolio'; id: string; tab: PortfolioTab }
  | { screen: 'new-portfolio' }
  | { screen: 'documents' }
  | { screen: 'new-document'; portfolio?: string; scope: 'umbrella' | 'portfolio' }
  | { screen: 'assemble'; id: string }
  | { screen: 'document'; id: string };

const ID = /^[a-z][a-z0-9_]*$/;

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (a === 'umbrella' && parts.length === 1) return { screen: 'umbrella' };
  if (a === 'portfolios' && b === 'new' && parts.length === 2) return { screen: 'new-portfolio' };
  if (a === 'portfolios' && b && ID.test(b) && parts.length <= 3) {
    const tab = (c ?? 'summary') as PortfolioTab;
    if (PORTFOLIO_TABS.includes(tab)) return { screen: 'portfolio', id: b, tab };
  }
  if (a === 'documents' && parts.length === 1) return { screen: 'documents' };
  if (a === 'documents' && b === 'new' && parts.length === 2) {
    const portfolio = params.get('portfolio');
    return portfolio && ID.test(portfolio)
      ? { screen: 'new-document', portfolio, scope: 'portfolio' }
      : { screen: 'new-document', scope: 'umbrella' };
  }
  if (a === 'documents' && b && ID.test(b)) {
    if (c === 'assemble' && parts.length === 3) return { screen: 'assemble', id: b };
    if (parts.length === 2) return { screen: 'document', id: b };
  }
  return { screen: 'overview' };
}

export function href(route: Route): string {
  switch (route.screen) {
    case 'overview':
      return '#/';
    case 'umbrella':
      return '#/umbrella';
    case 'portfolio':
      return route.tab === 'summary' ? `#/portfolios/${route.id}` : `#/portfolios/${route.id}/${route.tab}`;
    case 'new-portfolio':
      return '#/portfolios/new';
    case 'documents':
      return '#/documents';
    case 'new-document':
      return route.portfolio ? `#/documents/new?portfolio=${route.portfolio}` : '#/documents/new';
    case 'assemble':
      return `#/documents/${route.id}/assemble`;
    case 'document':
      return `#/documents/${route.id}`;
  }
}
