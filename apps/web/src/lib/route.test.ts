import { describe, expect, test } from 'vitest';
import { href, parseRoute, type Route } from './route.js';

describe('routes', () => {
  const routes: Route[] = [
    { screen: 'overview' },
    { screen: 'umbrella' },
    { screen: 'portfolio', id: 'pf_atlas', tab: 'summary' },
    { screen: 'portfolio', id: 'pf_atlas', tab: 'terms' },
    { screen: 'new-portfolio' },
    { screen: 'documents' },
    { screen: 'new-document', portfolio: 'pf_atlas', scope: 'portfolio' },
    { screen: 'new-document', scope: 'umbrella' },
    { screen: 'assemble', id: 'atlas_d12' },
    { screen: 'document', id: 'atlas_d12' },
  ];

  test.each(routes)('%j round-trips', (route) => {
    expect(parseRoute(href(route))).toEqual(route);
  });

  test.each(['', '#', '#/nowhere', '#/portfolios/Bad Id', '#/portfolios/pf_a/nope', '#/documents/x/y/z'])(
    '%j falls back to the overview',
    (hash) => {
      expect(parseRoute(hash)).toEqual({ screen: 'overview' });
    },
  );
});
