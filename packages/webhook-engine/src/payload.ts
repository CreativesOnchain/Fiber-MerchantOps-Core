import {
  WEBHOOK_EVENT_TYPES,
  type WebhookPayload,
} from "@fiber-merchantops/shared";
import type { BuildWebhookPayloadInput } from "./types";

export class UnknownWebhookTypeError extends Error {
  readonly webhookType: string;

  constructor(webhookType: string) {
    super(`unknown webhook event type: ${webhookType}`);
    this.name = "UnknownWebhookTypeError";
    this.webhookType = webhookType;
  }
}

export function buildWebhookPayload(
  input: BuildWebhookPayloadInput,
): WebhookPayload {
  if (!(WEBHOOK_EVENT_TYPES as readonly string[]).includes(input.type)) {
    throw new UnknownWebhookTypeError(input.type);
  }

  return {
    event_id: input.eventId,
    type: input.type,
    created_at:
      typeof input.createdAt === "string"
        ? input.createdAt
        : input.createdAt.toISOString(),
    data: input.data,
  };
}

/**
 * Canonical raw body for a webhook. The exact string returned here is what
 * gets signed and what receivers must verify against, byte for byte.
 */
export function serializeWebhookPayload(payload: WebhookPayload): string {
  return JSON.stringify(payload);
}
