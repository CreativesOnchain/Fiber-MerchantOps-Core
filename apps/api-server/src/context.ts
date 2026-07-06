import type { PrismaClient } from "@prisma/client";
import type { FiberAdapter } from "@fiber-merchantops/fiber-adapter";
import type { AppConfig } from "./config";
import { IdempotencyService } from "./services/idempotency-service";
import { LedgerService } from "./services/ledger-service";
import { PaymentIntentService } from "./services/payment-intent-service";
import { WebhookService } from "./services/webhook-service";

/**
 * The wired object graph shared by every route: config, the Prisma client, the
 * chosen Fiber adapter, and the service layer. Built once per app and decorated
 * onto the Fastify instance as `app.context`.
 */
export interface AppContext {
  config: AppConfig;
  prisma: PrismaClient;
  adapter: FiberAdapter;
  ledger: LedgerService;
  idempotency: IdempotencyService;
  webhooks: WebhookService;
  paymentIntents: PaymentIntentService;
}

export interface CreateContextOptions {
  config: AppConfig;
  prisma: PrismaClient;
  adapter: FiberAdapter;
}

export function createContext(options: CreateContextOptions): AppContext {
  const { config, prisma, adapter } = options;
  const ledger = new LedgerService();
  const idempotency = new IdempotencyService();
  const webhooks = new WebhookService(ledger);
  const paymentIntents = new PaymentIntentService({
    prisma,
    adapter,
    ledger,
    webhooks,
    idempotency,
  });
  return {
    config,
    prisma,
    adapter,
    ledger,
    idempotency,
    webhooks,
    paymentIntents,
  };
}

declare module "fastify" {
  interface FastifyInstance {
    context: AppContext;
  }
}
