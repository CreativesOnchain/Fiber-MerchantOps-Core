import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  createPaymentIntentSchema,
  listPaymentIntentsQuerySchema,
  type WebhookStatus,
} from "@fiber-merchantops/shared";
import type { AppContext } from "../context";
import { ApiError } from "../lib/http-errors";
import {
  paymentIntentToResponse,
  paymentIntentToSummary,
} from "../lib/serializers";
import { parseOrThrow } from "../lib/validation";

const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

export function registerPaymentIntentRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  // Create (brief §14.1) — idempotency + invoice creation live in the service.
  app.post("/v1/payment_intents", async (request, reply) => {
    const input = parseOrThrow(createPaymentIntentSchema, request.body);
    const idempotencyKey = firstHeaderValue(
      request.headers[IDEMPOTENCY_KEY_HEADER],
    );
    const { status, body } = await ctx.paymentIntents.create({
      input,
      idempotencyKey,
    });
    reply.status(status);
    return body;
  });

  // Get one (brief §14.2).
  app.get("/v1/payment_intents/:id", async (request) => {
    const { id } = request.params as { id: string };
    const intent = await ctx.prisma.paymentIntent.findUnique({ where: { id } });
    if (!intent) {
      throw ApiError.notFound(`payment intent ${id} not found`);
    }
    return paymentIntentToResponse(intent);
  });

  // List for a merchant with filters + pagination (brief §14.3).
  app.get("/v1/merchants/:merchant_id/payment_intents", async (request) => {
    const { merchant_id: merchantId } = request.params as {
      merchant_id: string;
    };
    const query = parseOrThrow(listPaymentIntentsQuerySchema, request.query);

    const merchant = await ctx.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw ApiError.notFound(`merchant ${merchantId} not found`);
    }

    const where: Prisma.PaymentIntentWhereInput = { merchantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.asset) {
      where.asset = query.asset;
    }
    const createdAt = buildDateRange(query.from, query.to);
    if (createdAt) {
      where.createdAt = createdAt;
    }

    const rows = await ctx.prisma.paymentIntent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit,
      skip: query.offset,
    });
    const webhookStatuses = await latestWebhookStatuses(
      ctx,
      rows.map((row) => row.id),
    );
    const items = rows.map((row) =>
      paymentIntentToSummary(row, webhookStatuses.get(row.id) ?? "none"),
    );

    return { items, limit: query.limit, offset: query.offset };
  });
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function buildDateRange(
  from: string | undefined,
  to: string | undefined,
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }
  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    filter.gte = new Date(from);
  }
  if (to) {
    filter.lte = new Date(to);
  }
  return filter;
}

/** Most-recent webhook status per intent (blueprint §8.5), for the list view. */
async function latestWebhookStatuses(
  ctx: AppContext,
  intentIds: string[],
): Promise<Map<string, WebhookStatus>> {
  const statuses = new Map<string, WebhookStatus>();
  if (intentIds.length === 0) {
    return statuses;
  }
  const events = await ctx.prisma.webhookEvent.findMany({
    where: { paymentIntentId: { in: intentIds } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { paymentIntentId: true, status: true },
  });
  for (const event of events) {
    if (event.paymentIntentId && !statuses.has(event.paymentIntentId)) {
      statuses.set(event.paymentIntentId, event.status as WebhookStatus);
    }
  }
  return statuses;
}
