import { describe, expect, it } from "vitest";
import { FiberAdapterError, decimalToSmallestUnitHex } from "../src/index";

describe("decimalToSmallestUnitHex", () => {
  it("scales whole CKB amounts to hex shannons", () => {
    expect(decimalToSmallestUnitHex("25", 8)).toBe("0x9502f900");
    expect(decimalToSmallestUnitHex("1", 8)).toBe("0x5f5e100");
  });

  it("scales fractional amounts without float math", () => {
    expect(decimalToSmallestUnitHex("0.5", 8)).toBe("0x2faf080");
    expect(decimalToSmallestUnitHex("0.00000001", 8)).toBe("0x1");
  });

  it("handles amounts beyond Number.MAX_SAFE_INTEGER", () => {
    expect(decimalToSmallestUnitHex("100000000000", 8)).toBe(
      `0x${(100_000_000_000n * 100_000_000n).toString(16)}`,
    );
  });

  it("rejects excess precision instead of rounding", () => {
    expect(() => decimalToSmallestUnitHex("1.123456789", 8)).toThrowError(
      FiberAdapterError,
    );
    expect(() => decimalToSmallestUnitHex("0.001", 2)).toThrowError(
      FiberAdapterError,
    );
  });

  it.each(["0", "0.0", "-5", "abc", "1e3", ""])("rejects %s", (value) => {
    expect(() => decimalToSmallestUnitHex(value, 8)).toThrowError(
      FiberAdapterError,
    );
  });
});
