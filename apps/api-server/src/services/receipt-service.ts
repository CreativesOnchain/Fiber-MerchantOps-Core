import type { PaymentIntent, Receipt } from "@prisma/client";
import {
  buildReceiptData,
  renderReceiptHtml,
  serializeReceiptJson,
} from "@fiber-merchantops/receipts";
import { ID_PREFIXES, type ReceiptResponse } from "@fiber-merchantops/shared";
import type { DbClient } from "../db";
import { monotonicNow } from "../lib/clock";
import { generateId } from "../lib/ids";

export interface IssueReceiptInput {
  intent: PaymentIntent;
  /** When the payment settled (adapter-reported); defaults to the issue time. */
  paidAt: Date | string;
}

export interface IssuedReceipt {
  receiptId: string;
  /** Canonical receipt document (also the payload of the receipt.created webhook). */
  data: ReceiptResponse;
}

/**
 * Issues and reads receipts. A receipt is created exactly once per intent (the
 * schema's unique paymentIntentId enforces this), storing both the canonical
 * JSON document and its rendered HTML so the read endpoints serve exactly what
 * was recorded at settlement. Issuance runs inside the paid-transition
 * transaction; reads take a plain client.
 */
export class ReceiptService {
  /** Create the Receipt row for a just-paid intent; caller supplies the tx. */
  async issue(client: DbClient, input: IssueReceiptInput): Promise<IssuedReceipt> {
    const { intent, paidAt } = input;
    const receiptId = generateId(ID_PREFIXES.receipt);
    const data = buildReceiptData({
      receiptId,
      merchantId: intent.merchantId,
      orderId: intent.orderId,
      paymentIntentId: intent.id,
      asset: intent.asset,
      amount: intent.amount,
      paymentHash: intent.paymentHash,
      paidAt,
    });

    await client.receipt.create({
      data: {
        id: receiptId,
        merchantId: intent.merchantId,
        paymentIntentId: intent.id,
        orderId: intent.orderId,
        asset: intent.asset,
        amount: intent.amount,
        paymentHash: intent.paymentHash,
        status: data.status,
        json: serializeReceiptJson(data),
        html: renderReceiptHtml(data),
        createdAt: monotonicNow(),
      },
    });

    return { receiptId, data };
  }

  async findById(client: DbClient, receiptId: string): Promise<Receipt | null> {
    return client.receipt.findUnique({ where: { id: receiptId } });
  }
}
