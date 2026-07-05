import { randomBytes } from "node:crypto";
import { FiberAdapterError, FiberRpcError } from "./errors";
import { decimalToSmallestUnitHex } from "./units";
import type {
  CreateInvoiceInput,
  CreateInvoiceResult,
  FiberAdapter,
  GetPaymentStatusInput,
  GetPaymentStatusResult,
  PaymentStatus,
} from "./types";

export type FiberNetwork = "mainnet" | "testnet" | "devnet";

const CURRENCY_BY_NETWORK: Record<FiberNetwork, string> = {
  mainnet: "Fibb",
  testnet: "Fibt",
  devnet: "Fibd",
};

/** 1 CKB = 10^8 shannons; non-UDT RPC amounts are denominated in shannons. */
const CKB_DECIMALS = 8;

/** fnn CkbInvoiceStatus → merchant-facing PaymentStatus. */
const INVOICE_STATUS_MAP: Record<string, PaymentStatus> = {
  Open: "created",
  Received: "processing",
  Paid: "paid",
  Expired: "expired",
  Cancelled: "failed",
};

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export interface UdtAssetConfig {
  /** Token decimals used to scale decimal amount strings to smallest units. */
  decimals: number;
  /** ckb_jsonrpc_types::Script object passed through verbatim as udt_type_script. */
  udtTypeScript: Record<string, unknown>;
}

export interface RealFiberAdapterOptions {
  rpcUrl: string;
  /** Sent as `Authorization: Bearer <token>` (fnn Biscuit auth). */
  rpcToken?: string;
  /** Selects the invoice currency: Fibb (mainnet), Fibt (testnet), Fibd (devnet). */
  network?: FiberNetwork;
  requestTimeoutMs?: number;
  /** Non-CKB assets must be configured here; unknown assets are rejected. */
  assets?: Record<string, UdtAssetConfig>;
  fetchImpl?: typeof fetch;
}

interface JsonRpcErrorBody {
  code?: number;
  message?: string;
  data?: unknown;
}

interface NewInvoiceRpcResult {
  invoice_address?: string;
  invoice?: { data?: { payment_hash?: string } };
}

interface GetInvoiceRpcResult {
  invoice_address?: string;
  status?: string;
  invoice?: { data?: { payment_hash?: string } };
}

/**
 * FiberAdapter backed by a Fiber Network Node (fnn) JSON-RPC endpoint.
 * Request/response shapes follow the fnn v0.6.1 RPC documentation; amounts are
 * hex-encoded u128 values in the asset's smallest unit. Order metadata is a
 * MerchantOps concern and is intentionally not forwarded to the node.
 */
export class RealFiberAdapter implements FiberAdapter {
  private readonly rpcUrl: string;
  private readonly rpcToken?: string;
  private readonly network: FiberNetwork;
  private readonly requestTimeoutMs: number;
  private readonly assets: Record<string, UdtAssetConfig>;
  private readonly fetchImpl: typeof fetch;
  private nextRequestId = 1;

  constructor(options: RealFiberAdapterOptions) {
    this.rpcUrl = options.rpcUrl;
    this.rpcToken = options.rpcToken;
    this.network = options.network ?? "testnet";
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.assets = options.assets ?? {};
    this.fetchImpl =
      options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  }

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    const params: Record<string, unknown> = {
      amount: this.encodeAmount(input.amount, input.asset),
      currency: CURRENCY_BY_NETWORK[this.network],
      payment_preimage: `0x${randomBytes(32).toString("hex")}`,
    };

    if (input.description !== undefined) {
      params.description = input.description;
    }
    if (input.expiresIn !== undefined) {
      params.expiry = `0x${input.expiresIn.toString(16)}`;
    }
    const udtConfig = this.udtConfigFor(input.asset);
    if (udtConfig) {
      params.udt_type_script = udtConfig.udtTypeScript;
    }

    const result = await this.call<NewInvoiceRpcResult>("new_invoice", params);
    if (!result.invoice_address) {
      throw new FiberRpcError("new_invoice result is missing invoice_address", {
        data: result,
      });
    }

    return {
      invoice: result.invoice_address,
      paymentHash: result.invoice?.data?.payment_hash,
      expiresAt:
        input.expiresIn === undefined
          ? undefined
          : new Date(Date.now() + input.expiresIn * 1000).toISOString(),
      raw: result,
    };
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusResult> {
    if (!input.paymentHash) {
      throw new FiberAdapterError(
        "missing_payment_hash",
        "RealFiberAdapter requires a paymentHash for status lookups",
      );
    }

    const result = await this.call<GetInvoiceRpcResult>("get_invoice", {
      payment_hash: input.paymentHash,
    });

    const status =
      result.status === undefined
        ? "unknown"
        : (INVOICE_STATUS_MAP[result.status] ?? "unknown");

    return {
      status,
      paymentHash: input.paymentHash,
      raw: result,
    };
  }

  private encodeAmount(amount: string, asset: string): string {
    if (asset === "CKB") {
      return decimalToSmallestUnitHex(amount, CKB_DECIMALS);
    }
    const udtConfig = this.udtConfigFor(asset);
    if (!udtConfig) {
      throw new FiberAdapterError(
        "asset_not_configured",
        `asset "${asset}" has no UDT configuration (decimals + udt_type_script required)`,
      );
    }
    return decimalToSmallestUnitHex(amount, udtConfig.decimals);
  }

  private udtConfigFor(asset: string): UdtAssetConfig | undefined {
    return asset === "CKB" ? undefined : this.assets[asset];
  }

  private async call<TResult>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<TResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.rpcToken) {
      headers.Authorization = `Bearer ${this.rpcToken}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(this.rpcUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: String(this.nextRequestId++),
          jsonrpc: "2.0",
          method,
          params: [params],
        }),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new FiberRpcError(
        `Fiber RPC request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      throw new FiberRpcError(`Fiber RPC returned HTTP ${response.status}`, {
        httpStatus: response.status,
      });
    }

    const body = (await response.json()) as {
      result?: TResult;
      error?: JsonRpcErrorBody;
    };

    if (body.error) {
      throw new FiberRpcError(
        body.error.message ?? `Fiber RPC error on ${method}`,
        { rpcCode: body.error.code, data: body.error.data },
      );
    }
    if (body.result === undefined) {
      throw new FiberRpcError(`Fiber RPC returned no result for ${method}`);
    }
    return body.result;
  }
}
