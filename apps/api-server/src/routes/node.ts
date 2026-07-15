import type { FastifyInstance } from "fastify";
import { probeChannels } from "../adapter";
import type { AppContext } from "../context";

/**
 * Exposes the Fiber node descriptor (mode, network, pubkey, channels, explorer
 * bases) so the admin UI can show live-node status and build explorer links.
 *
 * Identity fields are captured once at boot, but channels are re-read per request:
 * they open, close, and move balance while the process runs, and a stale channel
 * list would render explorer links that point at the wrong transaction.
 */
export function registerNodeRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/v1/node", async () => ({
    ...ctx.node,
    channels: await probeChannels(ctx.config),
  }));
}
