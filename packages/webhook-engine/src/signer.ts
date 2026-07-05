import { createHmac } from "node:crypto";
import { WEBHOOK_SIGNATURE_VERSION } from "@fiber-merchantops/shared";

/**
 * hex(hmac_sha256(secret, `${timestamp}.${rawBody}`)) — the timestamp is bound
 * into the signed payload so captured webhooks cannot be replayed outside the
 * verifier's tolerance window.
 */
export function computeSignature(
  secret: string,
  timestampSeconds: number | string,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex");
}

/** Builds the `t=<unix seconds>,v1=<hex signature>` header value. */
export function buildSignatureHeader(
  secret: string,
  rawBody: string,
  timestampSeconds: number,
): string {
  const signature = computeSignature(secret, timestampSeconds, rawBody);
  return `t=${timestampSeconds},${WEBHOOK_SIGNATURE_VERSION}=${signature}`;
}
