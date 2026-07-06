import Fastify, { type FastifyInstance } from "fastify";
import { WEBHOOK_SIGNATURE_HEADER } from "@fiber-merchantops/shared";
import type { DemoConfig } from "./config";
import { renderDemoPage } from "./html";
import { OrderStore } from "./order-store";
import { handleWebhook } from "./webhook-handler";

export interface BuildDemoServerOptions {
  config: DemoConfig;
  logger?: boolean;
  /** Injected in tests so state can be inspected directly. */
  store?: OrderStore;
}

declare module "fastify" {
  interface FastifyInstance {
    store: OrderStore;
  }
  interface FastifyRequest {
    /** Exact request bytes, preserved for HMAC verification. */
    rawBody?: string;
  }
}

/**
 * Assemble the demo merchant server: a raw-body-preserving JSON parser (so
 * webhook signatures verify against the exact bytes), the webhook receiver, and
 * the order/event views. No database — all state lives in the OrderStore.
 */
export function buildDemoServer(options: BuildDemoServerOptions): FastifyInstance {
  const { config, logger = true } = options;
  const store = options.store ?? new OrderStore();

  const app = Fastify({ logger });
  app.decorate("store", store);

  // Keep the raw body for signing; never fail here on bad JSON — the webhook
  // handler decides what an unverifiable/malformed body means.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      request.rawBody = typeof body === "string" ? body : body.toString();
      if (request.rawBody === "") {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(request.rawBody));
      } catch {
        done(null, undefined);
      }
    },
  );

  // Signed webhook receiver (blueprint §12).
  app.post("/webhooks/fiber", async (request, reply) => {
    const result = handleWebhook({
      rawBody: request.rawBody ?? "",
      signatureHeader: firstHeader(request.headers[WEBHOOK_SIGNATURE_HEADER]),
      secret: config.webhookSecret,
      store,
      toleranceSeconds: config.toleranceSeconds,
    });
    reply.status(result.statusCode);
    return result.body;
  });

  // Orders.
  app.get("/orders", async () => ({ orders: store.listOrders() }));

  app.post("/orders", async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const orderId = typeof body?.order_id === "string" ? body.order_id : null;
    if (!orderId) {
      reply.status(400);
      return { error: "order_id is required" };
    }
    reply.status(201);
    return store.ensureOrder(orderId, {
      amount: asString(body?.amount),
      asset: asString(body?.asset),
      paymentIntentId: asString(body?.payment_intent_id),
    });
  });

  // Received-webhook log.
  app.get("/events", async () => ({ events: store.listEvents() }));

  // Human-facing dashboard for the demo video.
  app.get("/", async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return renderDemoPage(store.listOrders(), store.listEvents());
  });

  return app;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
