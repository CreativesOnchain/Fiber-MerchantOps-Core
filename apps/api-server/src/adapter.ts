import {
  RealFiberAdapter,
  SimulatedFiberAdapter,
  type FiberAdapter,
} from "@fiber-merchantops/fiber-adapter";
import type { AppConfig } from "./config";

/**
 * Selects the Fiber adapter for the process. `simulated` is a deterministic
 * in-memory stand-in (and the only mode where `/v1/demo/*` is enabled);
 * `real` talks to a Fiber node over JSON-RPC. Built once at boot so the demo
 * endpoints and the create/refresh flows share a single adapter instance.
 */
export function createFiberAdapter(config: AppConfig): FiberAdapter {
  if (config.FIBER_ADAPTER_MODE === "real") {
    return new RealFiberAdapter({
      rpcUrl: config.FIBER_RPC_URL,
      rpcToken: config.FIBER_RPC_TOKEN,
    });
  }
  return new SimulatedFiberAdapter();
}
