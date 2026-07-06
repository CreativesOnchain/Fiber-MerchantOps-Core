import type { FastifyInstance } from "fastify";
import { merchantIdQuerySchema } from "@fiber-merchantops/shared";
import type { AppContext } from "../context";
import { ledgerEventToResponse } from "../lib/serializers";
import { parseOrThrow } from "../lib/validation";

export function registerLedgerRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  // Append-only ledger timeline for a merchant (brief §14.6).
  app.get("/v1/ledger", async (request) => {
    const { merchant_id: merchantId } = parseOrThrow(
      merchantIdQuerySchema,
      request.query,
    );
    const events = await ctx.ledger.listByMerchant(ctx.prisma, merchantId);
    return { events: events.map(ledgerEventToResponse) };
  });
}
