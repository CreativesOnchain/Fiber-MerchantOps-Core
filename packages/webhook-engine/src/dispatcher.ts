import { serializeWebhookPayload } from "./payload";
import { buildSignatureHeader } from "./signer";
import type { DeliverWebhookOptions, DeliveryOutcome } from "./types";

/** Canonical header casing on the wire; receivers match case-insensitively. */
export const SIGNATURE_HEADER_NAME = "Fiber-MerchantOps-Signature";
export const IDEMPOTENCY_HEADER_NAME = "Idempotency-Key";

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Performs exactly one signed delivery attempt and reports the outcome instead
 * of throwing — scheduling, retries, and persistence belong to the caller.
 */
export async function deliverWebhook(
  options: DeliverWebhookOptions,
): Promise<DeliveryOutcome> {
  const {
    url,
    secret,
    payload,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    now = Date.now,
  } = options;
  const fetchImpl =
    options.fetchImpl ??
    ((input: string | URL | Request, init?: RequestInit) =>
      globalThis.fetch(input, init));

  const rawBody = serializeWebhookPayload(payload);
  const timestampSeconds = Math.floor(now() / 1000);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER_NAME]: buildSignatureHeader(
          secret,
          rawBody,
          timestampSeconds,
        ),
        [IDEMPOTENCY_HEADER_NAME]: payload.event_id,
      },
      body: rawBody,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (response.ok) {
    return { delivered: true, httpStatus: response.status };
  }
  return {
    delivered: false,
    httpStatus: response.status,
    error: `receiver responded with HTTP ${response.status}`,
  };
}
