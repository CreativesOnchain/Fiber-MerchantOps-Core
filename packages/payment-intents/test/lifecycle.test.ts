import { describe, expect, it } from "vitest";
import { PAYMENT_INTENT_STATUSES } from "@fiber-merchantops/shared";
import {
  InvalidTransitionError,
  allowedTransitionsFrom,
  assertTransition,
  canTransition,
  intentStatusFromAdapterStatus,
  isTerminalStatus,
} from "../src/index";

const EXPECTED_TRANSITIONS: Record<string, readonly string[]> = {
  created: ["requires_payment", "failed"],
  requires_payment: ["processing", "paid", "expired", "failed"],
  processing: ["paid", "expired", "failed"],
  paid: [],
  expired: [],
  failed: [],
};

describe("transition table", () => {
  it("matches the approved lifecycle for every (from, to) pair", () => {
    for (const from of PAYMENT_INTENT_STATUSES) {
      for (const to of PAYMENT_INTENT_STATUSES) {
        const expected = EXPECTED_TRANSITIONS[from]?.includes(to) ?? false;
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it("exposes the allowed targets per source status", () => {
    for (const from of PAYMENT_INTENT_STATUSES) {
      expect(allowedTransitionsFrom(from)).toEqual(EXPECTED_TRANSITIONS[from]);
    }
  });

  it("never allows self-transitions", () => {
    for (const status of PAYMENT_INTENT_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});

describe("assertTransition", () => {
  it("passes silently for an allowed move", () => {
    expect(() => assertTransition("requires_payment", "paid")).not.toThrow();
  });

  it("throws InvalidTransitionError with from/to details for rejected moves", () => {
    try {
      assertTransition("paid", "expired");
      expect.unreachable("assertTransition should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect((error as InvalidTransitionError).from).toBe("paid");
      expect((error as InvalidTransitionError).to).toBe("expired");
    }
  });
});

describe("isTerminalStatus", () => {
  it.each([
    ["created", false],
    ["requires_payment", false],
    ["processing", false],
    ["paid", true],
    ["expired", true],
    ["failed", true],
  ] as const)("%s -> %s", (status, expected) => {
    expect(isTerminalStatus(status)).toBe(expected);
  });
});

describe("intentStatusFromAdapterStatus", () => {
  it.each([
    ["created", "requires_payment"],
    ["processing", "processing"],
    ["paid", "paid"],
    ["expired", "expired"],
    ["failed", "failed"],
  ] as const)("maps adapter %s to intent %s", (adapterStatus, expected) => {
    expect(intentStatusFromAdapterStatus(adapterStatus)).toBe(expected);
  });

  it("returns null for unknown and unrecognized statuses", () => {
    expect(intentStatusFromAdapterStatus("unknown")).toBeNull();
    expect(intentStatusFromAdapterStatus("settled")).toBeNull();
    expect(intentStatusFromAdapterStatus("")).toBeNull();
  });
});
