import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { HealthResponse } from "@fiber-merchantops/shared";
import { api } from "../api/client";

interface HealthState {
  health: HealthResponse | null;
  /** True until the first /healthz response (success or failure) lands. */
  loading: boolean;
  /** Set when /healthz is unreachable — surfaced as an offline banner. */
  error: string | null;
}

const HealthContext = createContext<HealthState>({
  health: null,
  loading: true,
  error: null,
});

/**
 * Polls /healthz so the SIMULATED banner and demo-button gating reflect the
 * live adapter mode, and so a dropped api-server shows an offline banner.
 */
export function HealthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HealthState>({
    health: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const health = await api.getHealth();
        if (active) setState({ health, loading: false, error: null });
      } catch (err) {
        if (active) {
          setState({
            health: null,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };
    poll();
    const timer = window.setInterval(poll, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <HealthContext.Provider value={state}>{children}</HealthContext.Provider>
  );
}

export function useHealth(): HealthState {
  return useContext(HealthContext);
}
