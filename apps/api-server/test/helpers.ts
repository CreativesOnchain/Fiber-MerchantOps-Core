import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { SimulatedFiberAdapter } from "@fiber-merchantops/fiber-adapter";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { loadConfig, type AppConfig } from "../src/config";
import { seedDefaultMerchant } from "../src/seed";

const migrationsDir = fileURLToPath(
  new URL("../prisma/migrations", import.meta.url),
);

/**
 * Apply every committed migration's SQL to a fresh database directly through the
 * Prisma client — no prisma CLI, no shared file. Keeps each test hermetic on its
 * own temp SQLite db.
 */
async function applySchema(prisma: PrismaClient): Promise<void> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const dir of dirs) {
    const sql = await readFile(join(migrationsDir, dir, "migration.sql"), "utf8");
    for (const statement of splitSqlStatements(sql)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((chunk) => chunk.length > 0);
}

export interface TestContext {
  app: FastifyInstance;
  prisma: PrismaClient;
  adapter: SimulatedFiberAdapter;
  config: AppConfig;
  cleanup: () => Promise<void>;
}

export interface CreateTestContextOptions {
  /** Seed the DEFAULT_* demo merchant (default true). */
  seed?: boolean;
  env?: Record<string, string>;
}

export async function createTestContext(
  options: CreateTestContextOptions = {},
): Promise<TestContext> {
  const dir = await mkdtemp(join(tmpdir(), "fiber-mops-"));
  const url = `file:${join(dir, "test.db")}`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await applySchema(prisma);

  const config = loadConfig({
    ...process.env,
    ...options.env,
    DATABASE_URL: url,
    FIBER_ADAPTER_MODE: "simulated",
  });
  const adapter = new SimulatedFiberAdapter();
  const app = await buildApp({ config, prisma, adapter, logger: false });

  if (options.seed !== false) {
    await seedDefaultMerchant(prisma, config);
  }

  return {
    app,
    prisma,
    adapter,
    config,
    cleanup: async () => {
      await app.close();
      await prisma.$disconnect();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/** Minimal valid create-intent body; override fields per test. */
export function createIntentBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    merchant_id: "m_123",
    order_id: "order_789",
    amount: "25",
    asset: "RUSD",
    ...overrides,
  };
}
