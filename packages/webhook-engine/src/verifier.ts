import { timingSafeEqual } from "node:crypto";
import {
  WEBHOOK_SIGNATURE_VERSION,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} from "@fiber-merchantops/shared";
import { computeSignature } from "./signer";
import type {
  ParsedSignatureHeader,
  VerificationResult,
  VerifySignatureOptions,
} from "./types";

const HEX_SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i;

export function parseSignatureHeader(
  header: string,
): ParsedSignatureHeader | null {
  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const trimmed = part.trim();
    if (trimmed === "") {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      return null;
    }
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);

    if (key === "t") {
      if (!/^\d+$/.test(value)) {
        return null;
      }
      timestamp = Number(value);
    } else if (key === WEBHOOK_SIGNATURE_VERSION) {
      signatures.push(value);
    }
  }

  if (timestamp === undefined || signatures.length === 0) {
    return null;
  }
  return { timestamp, signatures };
}

/**
 * Verifies a signed webhook: parse header, enforce the timestamp tolerance
 * window, then compare signatures in constant time. Signature comparison never
 * short-circuits on content, only on structurally invalid candidates.
 */
export function verifySignatureHeader(
  options: VerifySignatureOptions,
): VerificationResult {
  const tolerance =
    options.toleranceSeconds ?? WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;
  const nowMs = options.now?.() ?? Date.now();

  const parsed = parseSignatureHeader(options.header);
  if (!parsed) {
    return { valid: false, reason: "malformed_header" };
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > tolerance) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = Buffer.from(
    computeSignature(options.secret, parsed.timestamp, options.rawBody),
    "hex",
  );

  for (const candidate of parsed.signatures) {
    if (!HEX_SIGNATURE_PATTERN.test(candidate)) {
      continue;
    }
    const candidateBuffer = Buffer.from(candidate, "hex");
    if (
      candidateBuffer.length === expected.length &&
      timingSafeEqual(candidateBuffer, expected)
    ) {
      return { valid: true };
    }
  }

  return { valid: false, reason: "signature_mismatch" };
}
