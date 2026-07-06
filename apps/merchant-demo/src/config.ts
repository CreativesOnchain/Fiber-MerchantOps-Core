import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS } from "@fiber-merchantops/shared";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));

// Prefer the app-local .env, then the repo-root one; real process env always wins.
dotenv.config({ path: path.resolve(sourceDir, "../.env") });
dotenv.config({ path: path.resolve(sourceDir, "../../../.env") });

export interface DemoConfig {
  port: number;
  /** Shared HMAC secret — must match the api-server merchant's webhookSecret. */
  webhookSecret: string;
  /** Signed-timestamp tolerance window (seconds). */
  toleranceSeconds: number;
}

export function loadDemoConfig(env: NodeJS.ProcessEnv = process.env): DemoConfig {
  const port = Number(env.MERCHANT_DEMO_PORT ?? "9090");
  return {
    port: Number.isFinite(port) && port > 0 ? port : 9090,
    webhookSecret: env.DEFAULT_WEBHOOK_SECRET ?? "whsec_demo_secret",
    toleranceSeconds: WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  };
}
