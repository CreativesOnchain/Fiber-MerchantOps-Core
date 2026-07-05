export type FiberAdapterErrorCode =
  | "unknown_payment_hash"
  | "invalid_transition"
  | "asset_not_configured"
  | "invalid_amount"
  | "missing_payment_hash"
  | "rpc_error";

export class FiberAdapterError extends Error {
  readonly code: FiberAdapterErrorCode;

  constructor(code: FiberAdapterErrorCode, message: string) {
    super(message);
    this.name = "FiberAdapterError";
    this.code = code;
  }
}

export interface FiberRpcErrorDetails {
  rpcCode?: number;
  httpStatus?: number;
  data?: unknown;
}

export class FiberRpcError extends FiberAdapterError {
  readonly rpcCode?: number;
  readonly httpStatus?: number;
  readonly data?: unknown;

  constructor(message: string, details: FiberRpcErrorDetails = {}) {
    super("rpc_error", message);
    this.name = "FiberRpcError";
    this.rpcCode = details.rpcCode;
    this.httpStatus = details.httpStatus;
    this.data = details.data;
  }
}
