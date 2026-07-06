import type { ApiErrorBody } from "@fiber-merchantops/shared";

/**
 * A response-shaped error. Thrown from services/routes and rendered by the
 * Fastify error handler as `{ error: { code, message } }` with `statusCode`
 * (blueprint §9 error model). Any error that is not an ApiError becomes a
 * generic 500 `internal_error`, so raw messages never leak to clients.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }

  static validation(message: string): ApiError {
    return new ApiError(400, "validation_error", message);
  }

  static notFound(message = "resource not found"): ApiError {
    return new ApiError(404, "not_found", message);
  }

  /** 409 with a caller-chosen code (idempotency_key_conflict, duplicate_order_id, …). */
  static conflict(code: string, message: string): ApiError {
    return new ApiError(409, code, message);
  }

  static invoiceCreationFailed(message: string): ApiError {
    return new ApiError(502, "invoice_creation_failed", message);
  }

  static demoModeDisabled(message: string): ApiError {
    return new ApiError(403, "demo_mode_disabled", message);
  }

  static internal(message = "internal error"): ApiError {
    return new ApiError(500, "internal_error", message);
  }
}
