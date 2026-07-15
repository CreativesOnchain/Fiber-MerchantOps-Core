import {
  RealFiberAdapter,
  SimulatedFiberAdapter,
  type FiberAdapter,
  type FiberNetwork,
  type UdtAssetConfig,
} from "@fiber-merchantops/fiber-adapter";
import type { AppConfig } from "./config";

/** Public CKB explorer base per network (devnet has no public explorer). */
const EXPLORER_BASE: Record<FiberNetwork, string | null> = {
  mainnet: "https://explorer.nervos.org",
  testnet: "https://testnet.explorer.nervos.org",
  devnet: null,
};

/** Known CKB genesis hashes, used to sanity-check the node's network at boot. */
const EXPECTED_CHAIN_HASH: Partial<Record<FiberNetwork, string>> = {
  testnet: "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606",
};

export interface FiberChannelInfo {
  channelId: string;
  /** On-chain funding transaction hash (first 32 bytes of channel_outpoint). */
  fundingTxHash: string | null;
  state: string;
  /** Our (outbound / sendable) balance, hex shannons. */
  localBalance: string | null;
  /** Counterparty (our inbound / receivable) balance, hex shannons. */
  remoteBalance: string | null;
  isPublic: boolean;
}

/**
 * Live-node metadata captured once at boot and exposed via `/v1/node`. In
 * simulated mode everything but `mode`/`network`/`explorer` is empty.
 */
export interface FiberNodeInfo {
  mode: "real" | "simulated";
  reachable: boolean;
  network: FiberNetwork;
  version: string | null;
  commitHash: string | null;
  pubkey: string | null;
  chainHash: string | null;
  chainMatchesNetwork: boolean;
  udtAssets: string[];
  channels: FiberChannelInfo[];
  explorer: {
    base: string | null;
    /** The Fiber network graph (nodes + channels) on the CKB explorer. */
    fiberGraph: string | null;
  };
}

interface UdtCfgInfo {
  name?: string;
  script?: Record<string, unknown>;
}

interface RawNodeInfo {
  version?: string;
  commit_hash?: string;
  pubkey?: string;
  chain_hash?: string;
  udt_cfg_infos?: UdtCfgInfo[];
}

interface RawChannel {
  channel_id?: string;
  channel_outpoint?: string;
  is_public?: boolean;
  state?: { state_name?: string };
  local_balance?: string;
  remote_balance?: string;
}

async function rpc<T>(
  config: AppConfig,
  method: string,
  params: unknown[],
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.FIBER_RPC_TOKEN) {
    headers.Authorization = `Bearer ${config.FIBER_RPC_TOKEN}`;
  }
  const response = await fetch(config.FIBER_RPC_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: "boot", jsonrpc: "2.0", method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`${method} returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (body.error) {
    throw new Error(body.error.message ?? `${method} RPC error`);
  }
  if (body.result === undefined) {
    throw new Error(`${method} returned no result`);
  }
  return body.result;
}

/** channel_outpoint (tx_hash[32] || index[4]) → the 0x-prefixed funding tx hash. */
function fundingTxHash(outpoint: string | undefined): string | null {
  if (!outpoint || !outpoint.startsWith("0x") || outpoint.length < 66) {
    return null;
  }
  return outpoint.slice(0, 66);
}

/**
 * Current channels on the node. Channels open/close and balances move while the
 * process runs, so this is re-read on demand rather than cached from boot.
 * Best-effort: invoice flows do not depend on it, so failures yield an empty list.
 */
export async function probeChannels(
  config: AppConfig,
): Promise<FiberChannelInfo[]> {
  if (config.FIBER_ADAPTER_MODE !== "real") return [];
  try {
    const result = await rpc<{ channels?: RawChannel[] }>(
      config,
      "list_channels",
      [{}],
    );
    return (result.channels ?? []).map((c) => ({
      channelId: c.channel_id ?? "",
      fundingTxHash: fundingTxHash(c.channel_outpoint),
      state: c.state?.state_name ?? "unknown",
      localBalance: c.local_balance ?? null,
      remoteBalance: c.remote_balance ?? null,
      isPublic: c.is_public ?? false,
    }));
  } catch {
    return [];
  }
}

/**
 * Probes the configured Fiber node once at boot. In real mode a failure throws
 * (we refuse to run real mode against an unreachable node); in simulated mode it
 * returns a static descriptor without any network I/O.
 */
export async function probeFiberNode(config: AppConfig): Promise<{
  node: FiberNodeInfo;
  udtAssets: Record<string, UdtAssetConfig>;
}> {
  const network = config.FIBER_NETWORK;
  const explorerBase = EXPLORER_BASE[network];
  const explorer = {
    base: explorerBase,
    fiberGraph: explorerBase ? `${explorerBase}/fiber/graph/nodes` : null,
  };

  if (config.FIBER_ADAPTER_MODE !== "real") {
    return {
      node: {
        mode: "simulated",
        reachable: false,
        network,
        version: null,
        commitHash: null,
        pubkey: null,
        chainHash: null,
        chainMatchesNetwork: false,
        udtAssets: [],
        channels: [],
        explorer,
      },
      udtAssets: {},
    };
  }

  const info = await rpc<RawNodeInfo>(config, "node_info", []);
  const chainHash = info.chain_hash ?? null;
  const expected = EXPECTED_CHAIN_HASH[network];
  const chainMatchesNetwork = expected === undefined || expected === chainHash;

  // Build the UDT asset map from what the node actually advertises. The type
  // script comes verbatim from the node (never stale); decimals come from config
  // (node_info does not report them). Only assets we can encode are registered.
  const udtAssets: Record<string, UdtAssetConfig> = {};
  for (const cfg of info.udt_cfg_infos ?? []) {
    if (!cfg.name || !cfg.script) continue;
    if (cfg.name === "RUSD" && config.FIBER_RUSD_DECIMALS !== undefined) {
      udtAssets.RUSD = {
        decimals: config.FIBER_RUSD_DECIMALS,
        udtTypeScript: cfg.script,
      };
    }
  }

  const channels = await probeChannels(config);

  return {
    node: {
      mode: "real",
      reachable: true,
      network,
      version: info.version ?? null,
      commitHash: info.commit_hash ?? null,
      pubkey: info.pubkey ?? null,
      chainHash,
      chainMatchesNetwork,
      udtAssets: Object.keys(udtAssets),
      channels,
      explorer,
    },
    udtAssets,
  };
}

/**
 * Selects the Fiber adapter for the process. `simulated` is a deterministic
 * in-memory stand-in (and the only mode where `/v1/demo/*` is enabled); `real`
 * talks to a Fiber node over JSON-RPC, using the network + node-discovered UDT
 * scripts resolved by {@link probeFiberNode}.
 */
export function createFiberAdapter(
  config: AppConfig,
  udtAssets: Record<string, UdtAssetConfig> = {},
): FiberAdapter {
  if (config.FIBER_ADAPTER_MODE === "real") {
    return new RealFiberAdapter({
      rpcUrl: config.FIBER_RPC_URL,
      rpcToken: config.FIBER_RPC_TOKEN,
      network: config.FIBER_NETWORK,
      assets: udtAssets,
    });
  }
  return new SimulatedFiberAdapter();
}
