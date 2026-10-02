/** Loads the workspace once and shares it; screens call reload() after they change something. */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, message } from './api.js';
import { buildWorkspace, type Workspace } from './workspace.js';

interface State {
  ws?: Workspace;
  error?: string;
  reload: () => Promise<void>;
}

const Ctx = createContext<State>({ reload: async () => {} });

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ ws?: Workspace; error?: string }>({});
  const reload = useCallback(async () => {
    try {
      const [umbrella, sponsor, portfolio, portfolio_terms, offer, asset, subscription_account, documents] =
        await Promise.all([
          api.records('umbrella'),
          api.records('sponsor'),
          api.records('portfolio'),
          api.records('portfolio_terms'),
          api.records('offer'),
          api.records('asset'),
          api.records('subscription_account'),
          api.documents(),
        ]);
      setState({
        ws: buildWorkspace({
          umbrella,
          sponsor,
          portfolio,
          portfolio_terms,
          offer,
          asset,
          subscription_account,
          documents,
        }),
      });
    } catch (e) {
      setState((s) => ({ ...s, error: message(e) }));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>;
}

export const useWorkspace = () => useContext(Ctx);
