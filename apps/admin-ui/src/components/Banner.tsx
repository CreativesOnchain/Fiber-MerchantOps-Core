import { useHealth } from "../state/HealthContext";

/**
 * Persistent mode banner. Shows the mandated "SIMULATED MODE" notice whenever
 * the api-server runs the simulated adapter (blueprint §10), an offline notice
 * when /healthz is unreachable, and nothing in real mode.
 */
export function Banner() {
  const { health, error } = useHealth();

  if (error && !health) {
    return (
      <div className="banner banner-offline">
        API server unreachable — start it with <code>pnpm dev:api</code>.
      </div>
    );
  }

  if (health?.adapter_mode === "simulated") {
    return (
      <div className="banner banner-simulated">
        SIMULATED MODE — Fiber invoices and payments are simulated for the demo.
        Demo mark-paid / mark-expired / mark-failed actions are enabled.
      </div>
    );
  }

  if (health?.adapter_mode === "real") {
    return (
      <div className="banner banner-real">
        REAL MODE — connected to a Fiber node. Demo simulation endpoints are
        disabled.
      </div>
    );
  }

  return null;
}
