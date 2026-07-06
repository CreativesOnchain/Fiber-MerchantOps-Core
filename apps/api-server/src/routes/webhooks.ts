import type { FastifyInstance } from "fastify";
import {
  merchantIdQuerySchema,
  type WebhookReplayResponse,
} from "@fiber-merchantops/shared";
import type { AppContext } from "../context";
import { ApiError } from "../lib/http-errors";
import { webhookEventToResponse } from "../lib/serializers";
import { parseOrThrow } from "../lib/validation";

export function registerWebhookRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  // Replay a webhook (brief §15 / §16). Resets it to pending with attempts=0 so
  // the worker redelivers it, while keeping deliveredAt — a redelivery of an
  // already-delivered event lands as duplicate_event_ignored. Works from any
  // state, including dead_lettered.
  app.post("/v1/webhooks/:event_id/replay", async (request) => {
    const { event_id: eventId } = request.params as { event_id: string };
    const event = await ctx.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw ApiError.notFound(`webhook event ${eventId} not found`);
    }

    await ctx.prisma.$transaction(async (tx) => {
      await tx.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: "pending",
          attempts: 0,
          nextRetryAt: new Date(),
          lastError: null,
          // deliveredAt intentionally preserved.
        },
      });
      await ctx.ledger.append(tx, {
        merchantId: event.merchantId,
        eventType: "webhook_replayed",
        paymentIntentId: event.paymentIntentId,
        data: { webhook_event_id: eventId, type: event.type },
      });
    });

    const response: WebhookReplayResponse = {
      event_id: eventId,
      status: "pending",
      replayed: true,
    };
    return response;
  });

  // Webhook events for a merchant (admin UI), newest-first.
  app.get("/v1/webhook_events", async (request) => {
    const { merchant_id: merchantId } = parseOrThrow(
      merchantIdQuerySchema,
      request.query,
    );
    const events = await ctx.prisma.webhookEvent.findMany({
      where: { merchantId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return { events: events.map(webhookEventToResponse) };
  });
}
