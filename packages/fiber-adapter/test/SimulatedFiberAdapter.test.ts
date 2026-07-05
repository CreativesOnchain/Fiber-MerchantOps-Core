import { describe, expect, it } from "vitest";
import { FiberAdapterError, SimulatedFiberAdapter } from "../src/index";

function createAdapterWithClock(startMs = 0) {
  let currentMs = startMs;
  const adapter = new SimulatedFiberAdapter({ now: () => currentMs });
  return {
    adapter,
    advance(ms: number) {
      currentMs += ms;
    },
  };
}

describe("SimulatedFiberAdapter.createInvoice", () => {
  it("returns a testnet-shaped invoice, payment hash, and expiry", async () => {
    const adapter = new SimulatedFiberAdapter();
    const result = await adapter.createInvoice({
      amount: "25",
      asset: "RUSD",
      description: "Order #789",
      expiresIn: 3600,
    });

    expect(result.invoice).toMatch(/^fibt1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/);
    expect(result.paymentHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(Date.parse(result.expiresAt ?? "")).toBeGreaterThan(Date.now());
    expect(result.raw).toMatchObject({ simulated: true });
  });

  it("omits expiry when expiresIn is not provided", async () => {
    const adapter = new SimulatedFiberAdapter();
    const result = await adapter.createInvoice({ amount: "1", asset: "CKB" });
    expect(result.expiresAt).toBeUndefined();
  });
});

describe("SimulatedFiberAdapter.getPaymentStatus", () => {
  it("reports created for a fresh invoice, by hash and by invoice string", async () => {
    const adapter = new SimulatedFiberAdapter();
    const created = await adapter.createInvoice({ amount: "25", asset: "RUSD" });

    const byHash = await adapter.getPaymentStatus({
      paymentHash: created.paymentHash,
    });
    const byInvoice = await adapter.getPaymentStatus({ invoice: created.invoice });

    expect(byHash.status).toBe("created");
    expect(byInvoice.status).toBe("created");
    expect(byInvoice.paymentHash).toBe(created.paymentHash);
  });

  it("returns unknown for untracked lookups", async () => {
    const adapter = new SimulatedFiberAdapter();
    const result = await adapter.getPaymentStatus({ paymentHash: "0xdeadbeef" });
    expect(result.status).toBe("unknown");
    expect(result.paymentHash).toBeUndefined();
  });
});

describe("mark transitions", () => {
  it("markPaid settles the invoice with a paidAt timestamp", async () => {
    const adapter = new SimulatedFiberAdapter();
    const created = await adapter.createInvoice({ amount: "25", asset: "RUSD" });
    const hash = created.paymentHash ?? "";

    adapter.markPaid(hash);
    const status = await adapter.getPaymentStatus({ paymentHash: hash });

    expect(status.status).toBe("paid");
    expect(Date.parse(status.paidAt ?? "")).not.toBeNaN();
  });

  it("markPaid is idempotent on an already-paid invoice", async () => {
    const adapter = new SimulatedFiberAdapter();
    const created = await adapter.createInvoice({ amount: "25", asset: "RUSD" });
    const hash = created.paymentHash ?? "";

    adapter.markPaid(hash);
    expect(() => adapter.markPaid(hash)).not.toThrow();
    expect((await adapter.getPaymentStatus({ paymentHash: hash })).status).toBe(
      "paid",
    );
  });

  it("markExpired and markFailed settle terminal states", async () => {
    const adapter = new SimulatedFiberAdapter();
    const first = await adapter.createInvoice({ amount: "1", asset: "CKB" });
    const second = await adapter.createInvoice({ amount: "2", asset: "CKB" });

    adapter.markExpired(first.paymentHash ?? "");
    adapter.markFailed(second.paymentHash ?? "");

    expect(
      (await adapter.getPaymentStatus({ paymentHash: first.paymentHash })).status,
    ).toBe("expired");
    expect(
      (await adapter.getPaymentStatus({ paymentHash: second.paymentHash })).status,
    ).toBe("failed");
  });

  it("rejects paying an expired invoice", async () => {
    const adapter = new SimulatedFiberAdapter();
    const created = await adapter.createInvoice({ amount: "1", asset: "CKB" });
    const hash = created.paymentHash ?? "";

    adapter.markExpired(hash);

    expect(() => adapter.markPaid(hash)).toThrowError(FiberAdapterError);
    try {
      adapter.markPaid(hash);
    } catch (error) {
      expect((error as FiberAdapterError).code).toBe("invalid_transition");
    }
  });

  it("rejects expiring or failing a paid invoice", async () => {
    const adapter = new SimulatedFiberAdapter();
    const created = await adapter.createInvoice({ amount: "1", asset: "CKB" });
    const hash = created.paymentHash ?? "";

    adapter.markPaid(hash);

    expect(() => adapter.markExpired(hash)).toThrowError(FiberAdapterError);
    expect(() => adapter.markFailed(hash)).toThrowError(FiberAdapterError);
  });

  it("throws unknown_payment_hash for untracked hashes", () => {
    const adapter = new SimulatedFiberAdapter();
    try {
      adapter.markPaid("0x0000");
      expect.unreachable("markPaid should have thrown");
    } catch (error) {
      expect((error as FiberAdapterError).code).toBe("unknown_payment_hash");
    }
  });
});

describe("automatic expiry", () => {
  it("expires an unpaid invoice once expiresIn has elapsed", async () => {
    const { adapter, advance } = createAdapterWithClock();
    const created = await adapter.createInvoice({
      amount: "25",
      asset: "RUSD",
      expiresIn: 10,
    });
    const hash = created.paymentHash ?? "";

    expect((await adapter.getPaymentStatus({ paymentHash: hash })).status).toBe(
      "created",
    );

    advance(10_001);
    expect((await adapter.getPaymentStatus({ paymentHash: hash })).status).toBe(
      "expired",
    );
  });

  it("does not expire a paid invoice retroactively", async () => {
    const { adapter, advance } = createAdapterWithClock();
    const created = await adapter.createInvoice({
      amount: "25",
      asset: "RUSD",
      expiresIn: 10,
    });
    const hash = created.paymentHash ?? "";

    adapter.markPaid(hash);
    advance(60_000);

    expect((await adapter.getPaymentStatus({ paymentHash: hash })).status).toBe(
      "paid",
    );
  });

  it("rejects markPaid after the expiry window", async () => {
    const { adapter, advance } = createAdapterWithClock();
    const created = await adapter.createInvoice({
      amount: "25",
      asset: "RUSD",
      expiresIn: 10,
    });

    advance(20_000);

    expect(() => adapter.markPaid(created.paymentHash ?? "")).toThrowError(
      FiberAdapterError,
    );
  });
});
