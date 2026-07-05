import { FiberAdapterError } from "./errors";

const DECIMAL_AMOUNT_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * Converts a human-denominated decimal amount string into the asset's smallest
 * unit, hex-encoded as the Fiber RPC expects for u128 values (e.g. "25" CKB with
 * 8 decimals → "0x9502f900" shannons). Rejects amounts with more fractional
 * digits than the asset supports rather than silently rounding.
 */
export function decimalToSmallestUnitHex(amount: string, decimals: number): string {
  const match = DECIMAL_AMOUNT_PATTERN.exec(amount);
  const whole = match?.[1];
  if (whole === undefined) {
    throw new FiberAdapterError(
      "invalid_amount",
      `amount "${amount}" is not a positive decimal string`,
    );
  }

  const fraction = match?.[2] ?? "";
  if (fraction.length > decimals) {
    throw new FiberAdapterError(
      "invalid_amount",
      `amount "${amount}" has more than ${decimals} decimal places`,
    );
  }

  const scaled =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");

  if (scaled <= 0n) {
    throw new FiberAdapterError("invalid_amount", "amount must be greater than zero");
  }

  return `0x${scaled.toString(16)}`;
}
