import { z } from "zod";
import {
  AMOUNT_PATTERN,
  PAYMENT_INTENT_STATUSES,
  WEBHOOK_EVENT_TYPES,
} from "./constants";

export const amountSchema = z
  .string()
  .regex(AMOUNT_PATTERN, "amount must be a positive decimal string")
  .refine((value) => /[1-9]/.test(value), {
    message: "amount must be greater than zero",
  });

const urlStringSchema = z.string().refine(
  (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "must be a valid URL" },
);

const isoDateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "must be an ISO-8601 date string",
  });

export const createMerchantSchema = z.object({
  merchant_id: z.string().min(1).optional(),
  name: z.string().min(1),
  webhook_url: urlStringSchema.optional(),
  webhook_secret: z.string().min(8).optional(),
});

export type CreateMerchantInput = z.infer<typeof createMerchantSchema>;

export const createPaymentIntentSchema = z.object({
  merchant_id: z.string().min(1),
  order_id: z.string().min(1),
  amount: amountSchema,
  asset: z.string().min(1),
  description: z.string().max(500).optional(),
  customer_reference: z.string().max(200).optional(),
  expires_in: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;

export const listPaymentIntentsQuerySchema = z.object({
  status: z.enum(PAYMENT_INTENT_STATUSES).optional(),
  asset: z.string().min(1).optional(),
  from: isoDateStringSchema.optional(),
  to: isoDateStringSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPaymentIntentsQuery = z.infer<typeof listPaymentIntentsQuerySchema>;

export const recordRefundSchema = z.object({
  merchant_id: z.string().min(1),
  payment_intent_id: z.string().min(1),
  amount: amountSchema,
  asset: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type RecordRefundInput = z.infer<typeof recordRefundSchema>;

export const recordAdjustmentSchema = recordRefundSchema;

export type RecordAdjustmentInput = z.infer<typeof recordAdjustmentSchema>;

export const merchantIdQuerySchema = z.object({
  merchant_id: z.string().min(1),
});

export const webhookPayloadSchema = z.object({
  event_id: z.string().min(1),
  type: z.enum(WEBHOOK_EVENT_TYPES),
  created_at: isoDateStringSchema,
  data: z.record(z.string(), z.unknown()),
});

export type WebhookPayloadInput = z.infer<typeof webhookPayloadSchema>;
