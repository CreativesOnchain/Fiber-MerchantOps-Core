import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIntentBody, createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
});

const EXPECTED_HEADER =
  "date,merchant_id,order_id,payment_intent_id,asset,amount,status,payment_hash,fiber_invoice,receipt_id,webhook_status,settlement_status";

async function createIntent(orderId: string) {
  const response = await ctx.app.inject({
    method: "POST",
    url: "/v1/payment_intents",
    payload: createIntentBody({ order_id: orderId }),
  });
  return response.json();
}

async function markPaid(id: string) {
  await ctx.app.inject({
    method: "POST",
    url: `/v1/demo/payment_intents/${id}/mark-paid`,
  });
}

/** Parse our comma-only CSV (no field contains a comma) into keyed rows. */
function parseCsv(body: string): { header: string; rows: Record<string, string>[] } {
  const lines = body.trim().split(/\r?\n/);
  const header = lines[0] ?? "";
  const columns = header.split(",");
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(columns.map((col, i) => [col, cells[i] ?? ""]));
  });
  return { header, rows };
}

/**
 * Set up three intents that exercise every derivation branch:
 *  - paid + delivered  → status paid, webhook delivered, settlement recorded
 *  - created via API    → webhook pending (queued, undelivered), settlement pending
 *  - bare row (no hooks)→ webhook none, settlement pending
 */
async function seedThreeIntents() {
  const paid = await createIntent("o_paid");
  await markPaid(paid.payment_intent_id);
  await ctx.prisma.webhookEvent.updateMany({
    where: { paymentIntentId: paid.payment_intent_id },
    data: { status: "delivered", deliveredAt: new Date() },
  });

  const pending = await createIntent("o_pending");

  await ctx.prisma.paymentIntent.create({
    data: {
      id: "pi_none_test",
      merchantId: "m_123",
      orderId: "o_none",
      amount: "10",
      asset: "RUSD",
      status: "created",
      createdAt: new Date(),
    },
  });

  return { paidId: paid.payment_intent_id, pendingId: pending.payment_intent_id };
}

describe("GET /v1/exports/reconciliation.csv", () => {
  it("emits the exact §14.9 header and derived statuses, as a download", async () => {
    const { paidId, pendingId } = await seedThreeIntents();

    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/exports/reconciliation.csv?merchant_id=m_123",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      'attachment; filename="reconciliation-m_123.csv"',
    );

    const { header, rows } = parseCsv(response.body);
    expect(header).toBe(EXPECTED_HEADER);
    expect(rows).toHaveLength(3);

    const byIntent = (id: string) =>
      rows.find((row) => row.payment_intent_id === id);

    const paidRow = byIntent(paidId)!;
    expect(paidRow.status).toBe("paid");
    expect(paidRow.webhook_status).toBe("delivered");
    expect(paidRow.settlement_status).toBe("recorded");
    expect(paidRow.receipt_id).toMatch(/^rcp_/);
    expect(paidRow.payment_hash).toMatch(/^0x/);
    expect(paidRow.fiber_invoice).toMatch(/^fibt1/);
    expect(paidRow.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const pendingRow = byIntent(pendingId)!;
    expect(pendingRow.status).toBe("requires_payment");
    expect(pendingRow.webhook_status).toBe("pending");
    expect(pendingRow.settlement_status).toBe("pending");
    expect(pendingRow.receipt_id).toBe("");

    const noneRow = byIntent("pi_none_test")!;
    expect(noneRow.webhook_status).toBe("none");
    expect(noneRow.settlement_status).toBe("pending");
    expect(noneRow.payment_hash).toBe("");
    expect(noneRow.fiber_invoice).toBe("");
  });

  it("writes an export_generated ledger event with format + record count", async () => {
    await seedThreeIntents();
    await ctx.app.inject({
      method: "GET",
      url: "/v1/exports/reconciliation.csv?merchant_id=m_123",
    });

    const ledger = (
      await ctx.app.inject({ method: "GET", url: "/v1/ledger?merchant_id=m_123" })
    ).json().events;
    const exportEvent = ledger.find(
      (event: any) => event.event_type === "export_generated",
    );
    expect(exportEvent).toBeDefined();
    expect(exportEvent.data).toMatchObject({ format: "csv", record_count: 3 });
  });

  it("404s for an unknown merchant and 400s without merchant_id", async () => {
    const notFound = await ctx.app.inject({
      method: "GET",
      url: "/v1/exports/reconciliation.csv?merchant_id=m_ghost",
    });
    expect(notFound.statusCode).toBe(404);

    const bad = await ctx.app.inject({
      method: "GET",
      url: "/v1/exports/reconciliation.csv",
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe("validation_error");
  });
});

describe("GET /v1/exports/reconciliation.json", () => {
  it("returns the §14.10 envelope with derived records", async () => {
    const { paidId } = await seedThreeIntents();

    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/exports/reconciliation.json?merchant_id=m_123",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain(
      'attachment; filename="reconciliation-m_123.json"',
    );

    const body = response.json();
    expect(body.merchant_id).toBe("m_123");
    expect(Date.parse(body.generated_at)).not.toBeNaN();
    expect(body.records).toHaveLength(3);

    const paidRecord = body.records.find(
      (record: any) => record.payment_intent_id === paidId,
    );
    expect(paidRecord).toMatchObject({
      merchant_id: "m_123",
      order_id: "o_paid",
      status: "paid",
      asset: "RUSD",
      webhook_status: "delivered",
      settlement_status: "recorded",
    });

    // The export is ledger-visible with the json format.
    const ledger = (
      await ctx.app.inject({ method: "GET", url: "/v1/ledger?merchant_id=m_123" })
    ).json().events;
    expect(
      ledger.some(
        (event: any) =>
          event.event_type === "export_generated" &&
          event.data.format === "json",
      ),
    ).toBe(true);
  });
});
