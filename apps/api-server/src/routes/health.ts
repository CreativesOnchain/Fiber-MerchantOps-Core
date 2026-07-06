import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@fiber-merchantops/shared";
import type { AppContext } from "../context";

export function registerHealthRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  app.get("/healthz", async (): Promise<HealthResponse> => ({
    status: "ok",
    adapter_mode: ctx.config.FIBER_ADAPTER_MODE,
    demo_endpoints_enabled: ctx.config.FIBER_ADAPTER_MODE === "simulated",
  }));
}
