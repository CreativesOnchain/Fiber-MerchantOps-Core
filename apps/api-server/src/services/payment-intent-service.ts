import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  CreateInvoiceResult,
  FiberAdapter,
} from "@fiber-merchantops/fiber-adapter";
import {
  ID_PREFIXES,
  type CreatePaymentIntentInput,
  type PaymentIntentResponse,
} from "@fiber-merchantops/shared";
import { generateId } from "../lib/ids";
import { monotonicNow } from "../lib/clock";
import { ApiError } from "../lib/http-errors";
import { paymentIntentToResponse } from "../lib/serializers";
import type { IdempotencyService } from "./idempotency-service";
import type { LedgerService } from "./ledger-service";
import type { WebhookService } from "./webhook-service";

export interface CreatePaymentIntentParams {
  input: CreatePaymentIntentInput;
  idempotencyKey?: string;
}

export interface CreatePaymentIntentResult {
  /** 201 for a fresh creation, 200 when replaying a stored idempotent response. */
  status: number;
  body: PaymentIntentResponse;
}

export interface PaymentIntentServiceDeps {
  prisma: PrismaClient;
  adapter: FiberAdapter;
  ledger: LedgerService;
  webhooks: WebhookService;
  idempotency: IdempotencyService;
}

/**
 * Orchestrates payment-intent creation end to end (brief §14.1 / §16, blueprint
 * §8.1): idempotency, merchant check, the `created` intent + first ledger event,
 * the Fiber invoice call, and the atomic promotion to `requires_payment` with
 * invoice_created + queued webhook + stored idempotency response.
 */
export class PaymentIntentService {
  constructor(private readonly deps: PaymentIntentServiceDeps) {}

  async create(
    params: CreatePaymentIntentParams,
  ): Promise<CreatePaymentIntentResult> {
    const { input, idempotencyKey } = params;
    const { prisma, adapter, ledger, webhooks, idempotency } = this.deps;
    const merchantId = input.merchant_id;

    // 1. Idempotency replay / conflict (only when a key is supplied).
    let storageKey: string | undefined;
    let requestHash: string | undefined;
    if (idempotencyKey) {
      storageKey = idempotency.buildKey(merchantId, idempotencyKey);
      requestHash = idempotency.hashRequest(input);
      const existing = await idempotency.find(prisma, storageKey);
      if (existing) {
        if (existing.requestHash === requestHash) {
          return {
            status: 200,
            body: JSON.parse(existing.responseJson) as PaymentIntentResponse,
          };
        }
        throw ApiError.conflict(
          "idempotency_key_conflict",
          "Idempotency-Key was already used with a different request body",
        );
      }
    }

    // 2. Merchant must exist.
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw ApiError.notFound(`merchant ${merchantId} not found`);
    }

    // 3. Persist the intent as `created` with its first ledger event. This must
    //    survive a later invoice failure (blueprint §7), so it is its own
    //    transaction; the unique constraints surface as 409s here.
    const intentId = generateId(ID_PREFIXES.paymentIntent);
    const createdAt = monotonicNow();
    try {
      await prisma.$transaction(async (tx) => {
        await tx.paymentIntent.create({
          data: {
            id: intentId,
            merchantId,
            orderId: input.order_id,
            amount: input.amount,
            asset: input.asset,
            description: input.description ?? null,
            customerReference: input.customer_reference ?? null,
            status: "created",
            metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
            idempotencyKey: idempotencyKey ?? null,
            createdAt,
          },
        });
        await ledger.append(tx, {
          merchantId,
          eventType: "payment_intent_created",
          paymentIntentId: intentId,
          orderId: input.order_id,
          asset: input.asset,
          amount: input.amount,
        });
      });
    } catch (error) {
      throw mapCreateConstraintError(error);
    }

    // 4. Create the Fiber invoice (network I/O — never inside a transaction). On
    //    failure the intent stays `created` with only payment_intent_created.
    let invoice: CreateInvoiceResult;
    try {
      invoice = await adapter.createInvoice({
        amount: input.amount,
        asset: input.asset,
        description: input.description,
        expiresIn: input.expires_in,
        metadata: input.metadata,
      });
    } catch (error) {
      throw ApiError.invoiceCreationFailed(
        error instanceof Error ? error.message : "failed to create Fiber invoice",
      );
    }

    // 5. Promote to requires_payment, record invoice_created, queue the
    //    payment_intent.created webhook, and store the idempotent response — all
    //    atomically.
    const expiresAt = resolveExpiry(invoice, input.expires_in, createdAt);
    const body = await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentIntent.update({
        where: { id: intentId },
        data: {
          status: "requires_payment",
          fiberInvoice: invoice.invoice,
          paymentHash: invoice.paymentHash ?? null,
          expiresAt,
        },
      });
      await ledger.append(tx, {
        merchantId,
        eventType: "invoice_created",
        paymentIntentId: intentId,
        orderId: input.order_id,
        asset: input.asset,
        amount: input.amount,
        paymentHash: invoice.paymentHash ?? null,
        data: { fiber_invoice: invoice.invoice },
      });
      await webhooks.queue(tx, {
        merchant,
        intent: updated,
        type: "payment_intent.created",
      });
      const response = paymentIntentToResponse(updated);
      if (storageKey && requestHash) {
        await idempotency.store(tx, {
          storageKey,
          merchantId,
          requestHash,
          response,
        });
      }
      return response;
    });

    return { status: 201, body };
  }
}

function resolveExpiry(
  invoice: CreateInvoiceResult,
  expiresIn: number | undefined,
  createdAt: Date,
): Date | null {
  if (invoice.expiresAt) {
    return new Date(invoice.expiresAt);
  }
  if (expiresIn !== undefined) {
    return new Date(createdAt.getTime() + expiresIn * 1000);
  }
  return null;
}

/**
 * Turns a unique-constraint violation from the `created`-intent insert into the
 * right 409 (brief §16): the (merchant, order_id) index → duplicate_order_id,
 * the (merchant, idempotency_key) index → idempotency_key_conflict. Anything
 * else is returned unchanged for the generic handler.
 */
function mapCreateConstraintError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = JSON.stringify(error.meta?.target ?? "");
    if (target.includes("orderId")) {
      return ApiError.conflict(
        "duplicate_order_id",
        "a payment intent already exists for this merchant and order_id",
      );
    }
    if (target.includes("idempotencyKey")) {
      return ApiError.conflict(
        "idempotency_key_conflict",
        "Idempotency-Key was already used",
      );
    }
  }
  return error;
}
