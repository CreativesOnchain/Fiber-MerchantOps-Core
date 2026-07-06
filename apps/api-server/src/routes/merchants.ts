import type { FastifyInstance } from "fastify";
import { createMerchantSchema, ID_PREFIXES } from "@fiber-merchantops/shared";
import type { AppContext } from "../context";
import { monotonicNow } from "../lib/clock";
import { ApiError } from "../lib/http-errors";
import { generateId, generateWebhookSecret } from "../lib/ids";
import { isUniqueConstraintError } from "../lib/prisma-errors";
import {
  merchantToCreatedResponse,
  merchantToResponse,
} from "../lib/serializers";
import { parseOrThrow } from "../lib/validation";

/**
 * Merchant endpoints (approved addition beyond brief §14) that back the demo's
 * "create a merchant with webhook URL and secret" step. The secret is generated
 * when omitted and returned exactly once, at creation.
 */
export function registerMerchantRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  app.post("/v1/merchants", async (request, reply) => {
    const body = parseOrThrow(createMerchantSchema, request.body);
    const id = body.merchant_id ?? generateId(ID_PREFIXES.merchant);
    const webhookSecret =
      body.webhook_secret ?? generateWebhookSecret(ID_PREFIXES.webhookSecret);
    try {
      const merchant = await ctx.prisma.merchant.create({
        data: {
          id,
          name: body.name,
          webhookUrl: body.webhook_url ?? null,
          webhookSecret,
          createdAt: monotonicNow(),
        },
      });
      reply.status(201);
      return merchantToCreatedResponse(merchant);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw ApiError.conflict(
          "merchant_already_exists",
          `merchant ${id} already exists`,
        );
      }
      throw error;
    }
  });

  app.get("/v1/merchants/:id", async (request) => {
    const { id } = request.params as { id: string };
    const merchant = await ctx.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) {
      throw ApiError.notFound(`merchant ${id} not found`);
    }
    return merchantToResponse(merchant);
  });
}
