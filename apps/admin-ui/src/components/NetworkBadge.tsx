import { useNode } from "../state/NodeContext";
import { ExternalIcon } from "./icons";

/**
 * Persistent indicator of which Fiber network the API is bound to and whether it
 * is a live node or the simulator. Clickable through to the Fiber graph on the
 * CKB explorer when a live node is configured.
 */
export function NetworkBadge({
  variant = "bar",
}: {
  variant?: "bar" | "sidebar";
}) {
  const { node } = useNode();
  if (!node) return null;

  const live = node.mode === "real";
  const href = live ? node.explorer.fiberGraph : null;
  const statusLabel = live ? "LIVE" : "SIM";
  const netLabel = live ? node.network : "simulated";
  const dark = variant === "sidebar";

  const shell = `inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors duration-150 ${
    dark
      ? "border-sidebar-border bg-sidebar-input text-sidebar-text hover:text-white"
      : "border-hairline-strong bg-panel text-muted hover:text-ink"
  }`;

  const body = (
    <>
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-up" : "bg-amber"} ${
          live ? "animate-pulse" : ""
        }`}
      />
      <span className="font-semibold uppercase tracking-wide">{statusLabel}</span>
      <span className="opacity-50">·</span>
      <span>{netLabel}</span>
      {href ? <ExternalIcon size={12} className="opacity-60" /> : null}
    </>
  );

  const title = node.pubkey
    ? `Fiber node ${node.pubkey}${live ? ` · ${node.network}` : ""}`
    : undefined;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={title}
        className={shell}
      >
        {body}
      </a>
    );
  }
  return (
    <span className={shell} title={title}>
      {body}
    </span>
  );
}
