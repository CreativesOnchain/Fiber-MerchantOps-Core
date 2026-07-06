import type { FastifyInstance } from "fastify";
import {
  buildReconciliationJsonExport,
  reconciliationRecordsToCsv,
} from "@fiber-merchantops/reconciliation";
import { merchantIdQuerySchema } from "@fiber-merchantops/shared";
import type { AppContext } from "../context";
import { ApiError } from "../lib/http-errors";
import { parseOrThrow } from "../lib/validation";

export function registerExportRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  // Reconciliation CSV (brief §14.9) — fixed column order, downloaded.
  app.get("/v1/exports/reconciliation.csv", async (request, reply) => {
    const merchantId = await requireMerchant(ctx, request.query);
    const records = await ctx.reconciliation.generateExport(merchantId, "csv");
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename="reconciliation-${merchantId}.csv"`,
    );
    return reconciliationRecordsToCsv(records);
  });

  // Reconciliation JSON (brief §14.10) — {merchant_id, generated_at, records}.
  app.get("/v1/exports/reconciliation.json", async (request, reply) => {
    const merchantId = await requireMerchant(ctx, request.query);
    const records = await ctx.reconciliation.generateExport(merchantId, "json");
    reply.header(
      "content-disposition",
      `attachment; filename="reconciliation-${merchantId}.json"`,
    );
    return buildReconciliationJsonExport(merchantId, records);
  });
}

/** Validate the merchant_id query and confirm the merchant exists (404). */
async function requireMerchant(
  ctx: AppContext,
  query: unknown,
): Promise<string> {
  const { merchant_id: merchantId } = parseOrThrow(merchantIdQuerySchema, query);
  const merchant = await ctx.prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  if (!merchant) {
    throw ApiError.notFound(`merchant ${merchantId} not found`);
  }
  return merchantId;
}
