import type { FastifyInstance } from "fastify";
import {
  recordAdjustmentSchema,
  recordRefundSchema,
  type AdjustmentRecordedResponse,
  type RefundRecordedResponse,
} from "@fiber-merchantops/shared";
import type { AppContext } from "../context";
import { parseOrThrow } from "../lib/validation";

/** Verbatim brief §14.11 note — refunds are a ledger record, not an execution. */
const REFUND_MVP_NOTE =
  "Refund execution is not implemented in MVP. This is a merchant ledger record only.";

export function registerRefundRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  // Record a refund (brief §14.11) — ledger-only + refund.recorded webhook.
  app.post("/v1/refunds", async (request, reply) => {
    const input = parseOrThrow(recordRefundSchema, request.body);
    const ledgerEventId = await ctx.refunds.recordRefund({
      merchantId: input.merchant_id,
      paymentIntentId: input.payment_intent_id,
      amount: input.amount,
      asset: input.asset,
      reason: input.reason,
    });
    reply.status(201);
    const response: RefundRecordedResponse = {
      status: "recorded",
      ledger_event_id: ledgerEventId,
      note: REFUND_MVP_NOTE,
    };
    return response;
  });

  // Record an adjustment (brief §14.12) — ledger-only + adjustment.recorded webhook.
  app.post("/v1/adjustments", async (request, reply) => {
    const input = parseOrThrow(recordAdjustmentSchema, request.body);
    const ledgerEventId = await ctx.refunds.recordAdjustment({
      merchantId: input.merchant_id,
      paymentIntentId: input.payment_intent_id,
      amount: input.amount,
      asset: input.asset,
      reason: input.reason,
    });
    reply.status(201);
    const response: AdjustmentRecordedResponse = {
      status: "recorded",
      ledger_event_id: ledgerEventId,
    };
    return response;
  });
}
