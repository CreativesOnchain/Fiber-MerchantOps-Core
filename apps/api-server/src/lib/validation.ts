import type { z } from "zod";
import { ApiError } from "./http-errors";

/** Compact, client-safe rendering of a Zod failure: `path: message; …`. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

/**
 * Validate `value` against `schema`, returning the parsed data or throwing a
 * 400 `validation_error` ApiError. Keeps route handlers free of repeated
 * safeParse plumbing.
 */
export function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.validation(formatZodError(result.error));
  }
  return result.data;
}
