import { createHash } from "node:crypto";

/**
 * Deterministic JSON encoding: object keys are sorted recursively and
 * `undefined` members are dropped, so two request bodies that differ only in
 * key order (or in the presence of omitted optional fields) serialize
 * identically. This is the canonical form the idempotency request hash is taken
 * over — never expose it on the wire.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`)
    .join(",")}}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** sha256 over the canonical form of an arbitrary JSON-serializable value. */
export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}
