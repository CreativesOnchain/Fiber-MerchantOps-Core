import type { FastifyInstance } from "fastify";
import { renderReceiptHtml } from "@fiber-merchantops/receipts";
import type { ReceiptResponse } from "@fiber-merchantops/shared";
import type { AppContext } from "../context";
import { ApiError } from "../lib/http-errors";

export function registerReceiptRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  // HTML receipt (brief §14.8). Registered before the JSON route so the `.html`
  // suffix wins; Fastify strips it and hands us the bare receipt id.
  app.get("/v1/receipts/:receipt_id.html", async (request, reply) => {
    const { receipt_id: receiptId } = request.params as { receipt_id: string };
    const receipt = await ctx.receipts.findById(ctx.prisma, receiptId);
    if (!receipt) {
      throw ApiError.notFound(`receipt ${receiptId} not found`);
    }
    // Prefer the HTML frozen at issuance; re-render from the stored JSON only if
    // an older row predates the html column.
    const html =
      receipt.html ??
      renderReceiptHtml(JSON.parse(receipt.json) as ReceiptResponse);
    reply.type("text/html; charset=utf-8");
    return html;
  });

  // JSON receipt (brief §14.7) — the canonical document stored at settlement.
  app.get("/v1/receipts/:receipt_id", async (request) => {
    const { receipt_id: receiptId } = request.params as { receipt_id: string };
    const receipt = await ctx.receipts.findById(ctx.prisma, receiptId);
    if (!receipt) {
      throw ApiError.notFound(`receipt ${receiptId} not found`);
    }
    return JSON.parse(receipt.json) as ReceiptResponse;
  });
}
