import cors from "@fastify/cors";
import { Prisma, type PrismaClient } from "@prisma/client";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
} from "fastify";
import type { FiberAdapter } from "@fiber-merchantops/fiber-adapter";
import { createFiberAdapter } from "./adapter";
import type { AppConfig } from "./config";
import { createContext } from "./context";
import { createPrismaClient } from "./db";
import { ApiError } from "./lib/http-errors";
import { registerDemoRoutes } from "./routes/demo";
import { registerHealthRoutes } from "./routes/health";
import { registerLedgerRoutes } from "./routes/ledger";
import { registerMerchantRoutes } from "./routes/merchants";
import { registerPaymentIntentRoutes } from "./routes/payment-intents";
import { registerReceiptRoutes } from "./routes/receipts";
import { registerWebhookRoutes } from "./routes/webhooks";

export interface BuildAppOptions {
  config: AppConfig;
  logger?: boolean;
  /** Injected in tests (temp SQLite); otherwise built from config and owned by the app. */
  prisma?: PrismaClient;
  /** Injected in tests so the demo mark-* helpers reach the same simulated instance. */
  adapter?: FiberAdapter;
}

/**
 * Assemble the Fastify app: shared context (Prisma + adapter + services), CORS,
 * the blueprint §9 error model, and all routes. Deliberately performs no
 * database I/O at boot — seeding lives in `index.ts` — so tests can build an app
 * against an injected client without side effects.
 */
export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const { config, logger = true } = options;
  const prisma = options.prisma ?? createPrismaClient(config.DATABASE_URL);
  const ownsPrisma = options.prisma === undefined;
  const adapter = options.adapter ?? createFiberAdapter(config);
  const context = createContext({ config, prisma, adapter });

  const app = Fastify({ logger });
  app.decorate("context", context);

  await app.register(cors, { origin: true });

  registerErrorHandler(app);
  registerHealthRoutes(app, context);
  registerMerchantRoutes(app, context);
  registerPaymentIntentRoutes(app, context);
  registerDemoRoutes(app, context);
  registerReceiptRoutes(app, context);
  registerWebhookRoutes(app, context);
  registerLedgerRoutes(app, context);

  if (ownsPrisma) {
    app.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  }

  return app;
}

function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      reply.status(error.statusCode).send(error.toBody());
      return;
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.validation || fastifyError.statusCode === 400) {
      reply.status(400).send({
        error: { code: "validation_error", message: fastifyError.message },
      });
      return;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      reply.status(409).send({
        error: { code: "conflict", message: "unique constraint violation" },
      });
      return;
    }

    request.log.error(error);
    reply
      .status(500)
      .send({ error: { code: "internal_error", message: "internal error" } });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "not_found",
        message: `route ${request.method} ${request.url} not found`,
      },
    });
  });
}
