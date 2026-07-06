import type { PrismaClient } from "@prisma/client";
import { monotonicNow } from "./lib/clock";
import type { AppConfig } from "./config";

/**
 * Idempotently ensures the demo merchant from DEFAULT_* env exists so the API
 * boots ready for the brief's demo (merchant `m_123` with a webhook URL +
 * secret). Reboots never clobber an existing merchant's fields.
 */
export async function seedDefaultMerchant(
  prisma: PrismaClient,
  config: AppConfig,
): Promise<void> {
  await prisma.merchant.upsert({
    where: { id: config.DEFAULT_MERCHANT_ID },
    update: {},
    create: {
      id: config.DEFAULT_MERCHANT_ID,
      name: "Demo Merchant",
      webhookUrl: config.MERCHANT_DEMO_WEBHOOK_URL,
      webhookSecret: config.DEFAULT_WEBHOOK_SECRET,
      createdAt: monotonicNow(),
    },
  });
}
