import { Prisma } from "@prisma/client";

/** True for Prisma's P2002 unique-constraint violation. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
