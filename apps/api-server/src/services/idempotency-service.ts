import type { IdempotencyRecord } from "@prisma/client";
import { canonicalHash } from "../lib/hash";
import { monotonicNow } from "../lib/clock";
import type { DbClient } from "../db";

export interface StoreIdempotencyInput {
  storageKey: string;
  merchantId: string;
  requestHash: string;
  /** The exact response body to replay on a matching retry. */
  response: unknown;
}

/**
 * Idempotency-Key bookkeeping for payment-intent creation (brief §16). Keys are
 * namespaced per merchant, and the request is fingerprinted by a canonical
 * sha256 so a retry with the same body replays the stored response while a reuse
 * with a different body is a conflict. Records are write-once.
 */
export class IdempotencyService {
  /** Namespaced key: a key only ever collides within its own merchant. */
  buildKey(merchantId: string, idempotencyKey: string): string {
    return `${merchantId}:${idempotencyKey}`;
  }

  hashRequest(body: unknown): string {
    return canonicalHash(body);
  }

  async find(
    client: DbClient,
    storageKey: string,
  ): Promise<IdempotencyRecord | null> {
    return client.idempotencyRecord.findUnique({ where: { key: storageKey } });
  }

  async store(client: DbClient, input: StoreIdempotencyInput): Promise<void> {
    await client.idempotencyRecord.create({
      data: {
        key: input.storageKey,
        merchantId: input.merchantId,
        requestHash: input.requestHash,
        responseJson: JSON.stringify(input.response),
        createdAt: monotonicNow(),
      },
    });
  }
}
