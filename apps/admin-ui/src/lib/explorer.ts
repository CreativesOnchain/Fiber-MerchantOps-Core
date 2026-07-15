import type { FiberNodeInfo } from "../api/client";

/**
 * Explorer link helpers. Fiber payments are off-chain (HTLCs inside a channel),
 * so a paid invoice has no on-chain transaction. What *is* on-chain and linkable
 * is the channel funding transaction and the node itself; those are what these
 * helpers point at. `null` means "no explorer for this network / no data".
 */

/** On-chain CKB transaction (e.g. a channel funding tx). */
export function txUrl(
  node: FiberNodeInfo | null | undefined,
  hash: string | null | undefined,
): string | null {
  if (!node?.explorer.base || !hash) return null;
  return `${node.explorer.base}/transaction/${hash}`;
}

/** The Fiber network graph (nodes + channels) on the CKB explorer. */
export function fiberGraphUrl(
  node: FiberNodeInfo | null | undefined,
): string | null {
  return node?.explorer.fiberGraph ?? null;
}
