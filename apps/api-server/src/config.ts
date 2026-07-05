import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));

// Values already present in the process environment always win; the app-local
// .env is preferred over the repository root one.
dotenv.config({ path: path.resolve(sourceDir, "../.env") });
dotenv.config({ path: path.resolve(sourceDir, "../../../.env") });

const optionalNonEmptyString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().default("file:./dev.db"),
  FIBER_ADAPTER_MODE: z.enum(["simulated", "real"]).default("simulated"),
  FIBER_RPC_URL: z.string().default("http://127.0.0.1:8227"),
  FIBER_RPC_TOKEN: optionalNonEmptyString,
  DEFAULT_MERCHANT_ID: z.string().default("m_123"),
  DEFAULT_WEBHOOK_SECRET: z.string().default("whsec_demo_secret"),
  MERCHANT_DEMO_WEBHOOK_URL: z
    .string()
    .default("http://localhost:9090/webhooks/fiber"),
  WEBHOOK_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  STATUS_POLL_ENABLED: booleanFlag,
  STATUS_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
