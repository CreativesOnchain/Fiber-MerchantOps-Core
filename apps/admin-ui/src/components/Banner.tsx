import { useHealth } from "../state/HealthContext";
import { ShieldIcon } from "./icons";

/**
 * Surfaces only a hard error: the api-server being unreachable. Adapter-mode
 * notices (simulated / real) are intentionally not shown — mode is reflected by
 * which actions are available, not a persistent banner.
 */
export function Banner() {
  const { health, error } = useHealth();

  if (error && !health) {
    return (
      <div className="flex items-center gap-2.5 rounded-card border border-danger/20 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
        <ShieldIcon size={16} className="shrink-0" />
        <span>
          API server unreachable — start it with{" "}
          <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-[12px]">
            pnpm dev:api
          </code>
        </span>
      </div>
    );
  }

  return null;
}
