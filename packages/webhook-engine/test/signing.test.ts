import { describe, expect, it } from "vitest";
import {
  buildSignatureHeader,
  computeSignature,
  parseSignatureHeader,
  verifySignatureHeader,
} from "../src/index";

const SECRET = "whsec_demo_secret";
const TIMESTAMP = 1_720_613_100;
const RAW_BODY =
  '{"event_id":"evt_123","type":"payment_intent.paid","created_at":"2026-07-10T12:05:00Z","data":{"order_id":"order_789"}}';

/** Computed independently with `openssl dgst -sha256 -hmac` over `${ts}.${body}`. */
const OPENSSL_VECTOR =
  "a0d387ba31437cd606e5851963438d85db37ad53b1fb75ed3380ef61f2cdedf0";

/** Freeze the clock inside the signed timestamp's tolerance window. */
const NOW = () => TIMESTAMP * 1000;

describe("computeSignature", () => {
  it("matches an independently computed openssl HMAC vector", () => {
    expect(computeSignature(SECRET, TIMESTAMP, RAW_BODY)).toBe(OPENSSL_VECTOR);
  });
});

describe("buildSignatureHeader", () => {
  it("produces the documented t=…,v1=… format", () => {
    expect(buildSignatureHeader(SECRET, RAW_BODY, TIMESTAMP)).toBe(
      `t=${TIMESTAMP},v1=${OPENSSL_VECTOR}`,
    );
  });
});

describe("parseSignatureHeader", () => {
  it("extracts timestamp and signature candidates", () => {
    expect(parseSignatureHeader(`t=${TIMESTAMP},v1=${OPENSSL_VECTOR}`)).toEqual({
      timestamp: TIMESTAMP,
      signatures: [OPENSSL_VECTOR],
    });
  });

  it("collects multiple v1 candidates", () => {
    const parsed = parseSignatureHeader(`t=1,v1=aaaa,v1=bbbb`);
    expect(parsed?.signatures).toEqual(["aaaa", "bbbb"]);
  });

  it.each([
    ["", "empty"],
    ["v1=abc", "missing timestamp"],
    ["t=123", "missing signature"],
    ["t=abc,v1=def", "non-numeric timestamp"],
    ["nonsense", "no key/value structure"],
  ])("returns null for %j (%s)", (header) => {
    expect(parseSignatureHeader(header)).toBeNull();
  });
});

describe("verifySignatureHeader", () => {
  const header = buildSignatureHeader(SECRET, RAW_BODY, TIMESTAMP);

  it("accepts a valid signature within tolerance", () => {
    expect(
      verifySignatureHeader({
        header,
        rawBody: RAW_BODY,
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ valid: true });
  });

  it("rejects a tampered body", () => {
    expect(
      verifySignatureHeader({
        header,
        rawBody: RAW_BODY.replace("order_789", "order_999"),
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a wrong secret", () => {
    expect(
      verifySignatureHeader({
        header,
        rawBody: RAW_BODY,
        secret: "whsec_wrong",
        now: NOW,
      }),
    ).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a reused header whose timestamp fell out of tolerance", () => {
    const result = verifySignatureHeader({
      header,
      rawBody: RAW_BODY,
      secret: SECRET,
      now: () => (TIMESTAMP + 301) * 1000,
    });
    expect(result).toEqual({
      valid: false,
      reason: "timestamp_out_of_tolerance",
    });
  });

  it("accepts skew up to the tolerance boundary in both directions", () => {
    for (const skew of [-300, 300]) {
      expect(
        verifySignatureHeader({
          header,
          rawBody: RAW_BODY,
          secret: SECRET,
          now: () => (TIMESTAMP + skew) * 1000,
        }).valid,
      ).toBe(true);
    }
  });

  it("honours a custom tolerance window", () => {
    const result = verifySignatureHeader({
      header,
      rawBody: RAW_BODY,
      secret: SECRET,
      toleranceSeconds: 10,
      now: () => (TIMESTAMP + 11) * 1000,
    });
    expect(result).toEqual({
      valid: false,
      reason: "timestamp_out_of_tolerance",
    });
  });

  it("rejects malformed headers", () => {
    expect(
      verifySignatureHeader({
        header: "garbage",
        rawBody: RAW_BODY,
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ valid: false, reason: "malformed_header" });
  });

  it("rejects structurally invalid signature candidates without crashing", () => {
    const result = verifySignatureHeader({
      header: `t=${TIMESTAMP},v1=nothex,v1=abcd`,
      rawBody: RAW_BODY,
      secret: SECRET,
      now: NOW,
    });
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("accepts when any one of several candidates matches", () => {
    const result = verifySignatureHeader({
      header: `t=${TIMESTAMP},v1=${"0".repeat(64)},v1=${OPENSSL_VECTOR}`,
      rawBody: RAW_BODY,
      secret: SECRET,
      now: NOW,
    });
    expect(result).toEqual({ valid: true });
  });
});
