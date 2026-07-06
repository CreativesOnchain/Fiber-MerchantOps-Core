import { Prisma, PrismaClient } from "@prisma/client";

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined,
  );
}

/**
 * A Prisma client or an interactive-transaction handle. Service write methods
 * accept this so they compose inside a caller's `$transaction`; a full
 * PrismaClient satisfies it too, for standalone reads.
 */
export type DbClient = Prisma.TransactionClient;
