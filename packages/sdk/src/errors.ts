/**
 * Thrown for every non-2xx API response. Mirrors the server's §9 error envelope
 * (`{ error: { code, message } }`) and adds the HTTP status so callers can
 * branch on it (e.g. 409 idempotency_key_conflict, 404 not_found).
 */
export class MerchantOpsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MerchantOpsApiError";
  }
}
