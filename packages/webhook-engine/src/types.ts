import type { WebhookEventType, WebhookPayload } from "@fiber-merchantops/shared";

export interface ParsedSignatureHeader {
  /** Unix timestamp in seconds, as signed into the header. */
  timestamp: number;
  /** All v1 signature candidates present in the header. */
  signatures: string[];
}

export type VerificationFailureReason =
  | "malformed_header"
  | "timestamp_out_of_tolerance"
  | "signature_mismatch";

export type VerificationResult =
  | { valid: true }
  | { valid: false; reason: VerificationFailureReason };

export interface VerifySignatureOptions {
  header: string;
  rawBody: string;
  secret: string;
  /** Maximum allowed clock skew in seconds; defaults to the shared tolerance. */
  toleranceSeconds?: number;
  /** Clock override (ms epoch) for deterministic tests. */
  now?: () => number;
}

export interface BuildWebhookPayloadInput {
  eventId: string;
  type: WebhookEventType;
  createdAt: Date | string;
  data: Record<string, unknown>;
}

export type DeliveryOutcome =
  | { delivered: true; httpStatus: number }
  | { delivered: false; httpStatus?: number; error: string };

export interface DeliverWebhookOptions {
  url: string;
  secret: string;
  payload: WebhookPayload;
  timeoutMs?: number;
  now?: () => number;
  fetchImpl?: typeof fetch;
}
