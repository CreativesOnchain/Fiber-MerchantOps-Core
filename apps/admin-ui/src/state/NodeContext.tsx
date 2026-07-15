import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, type FiberNodeInfo } from "../api/client";

interface NodeState {
  node: FiberNodeInfo | null;
  loading: boolean;
}

const NodeContext = createContext<NodeState>({ node: null, loading: true });

/**
 * Fetches the `/v1/node` descriptor once at mount (it is static for the server's
 * lifetime) so the network indicator and explorer links have live-node context.
 */
export function NodeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NodeState>({ node: null, loading: true });

  useEffect(() => {
    let active = true;
    api
      .getNode()
      .then((node) => {
        if (active) setState({ node, loading: false });
      })
      .catch(() => {
        if (active) setState({ node: null, loading: false });
      });
    return () => {
      active = false;
    };
  }, []);

  return <NodeContext.Provider value={state}>{children}</NodeContext.Provider>;
}

export function useNode(): NodeState {
  return useContext(NodeContext);
}
