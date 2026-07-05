import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { HealthResponse } from "@fiber-merchantops/shared";
import type { AppConfig } from "./config";

export interface BuildAppOptions {
  config: AppConfig;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, logger = true } = options;

  const app = Fastify({ logger });

  await app.register(cors, { origin: true });

  app.get("/healthz", async (): Promise<HealthResponse> => ({
    status: "ok",
    adapter_mode: config.FIBER_ADAPTER_MODE,
    demo_endpoints_enabled: config.FIBER_ADAPTER_MODE === "simulated",
  }));

  return app;
}
