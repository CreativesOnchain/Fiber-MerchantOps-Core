import { describe, expect, it } from "vitest";
import { delayBeforeAttemptMs, nextRetryAtMs } from "../src/index";

describe("delayBeforeAttemptMs", () => {
  it.each([
    [1, 0],
    [2, 10_000],
    [3, 30_000],
    [4, 120_000],
  ])("attempt %i waits %i ms", (attempt, expected) => {
    expect(delayBeforeAttemptMs(attempt)).toBe(expected);
  });

  it.each([0, 5, -1, 1.5])("rejects out-of-schedule attempt %s", (attempt) => {
    expect(() => delayBeforeAttemptMs(attempt)).toThrowError(RangeError);
  });
});

describe("nextRetryAtMs", () => {
  const NOW = 1_000_000;

  it("schedules the first attempt immediately", () => {
    expect(nextRetryAtMs(0, NOW)).toBe(NOW);
  });

  it("applies the documented backoff after each failure", () => {
    expect(nextRetryAtMs(1, NOW)).toBe(NOW + 10_000);
    expect(nextRetryAtMs(2, NOW)).toBe(NOW + 30_000);
    expect(nextRetryAtMs(3, NOW)).toBe(NOW + 120_000);
  });

  it("dead-letters after the fourth attempt", () => {
    expect(nextRetryAtMs(4, NOW)).toBeNull();
    expect(nextRetryAtMs(10, NOW)).toBeNull();
  });
});
