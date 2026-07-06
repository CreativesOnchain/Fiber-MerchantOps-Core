import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifySignatureHeader } from "@fiber-merchantops/webhook-engine";
import type { WebhookEvent } from "@prisma/client";
import { WebhookDispatcher } from "../src/services/webhook-dispatcher";
import { createIntentBody, createTestContext, type TestContext } from "./helpers";

const SECRET = "whsec_demo_secret";

interface CapturedRequest {
  eventId: string | null;
  verified: boolean;
  duplicate: boolean;
  idempotencyKey: string | null;
}

interface CaptureServer {
  url: string;
  received: CapturedRequest[];
  /** When set to a status code, every request is answered with it (failure). */
  failStatus: number | null;
  close: () => Promise<void>;
}

/**
 * A real HTTP receiver: reads the raw body, verifies the signature with the
 * shared verifier, dedupes by event_id, and records each hit. `failStatus`
 * flips it into a failing endpoint for the retry/dead-letter tests.
 */
async function startCaptureServer(): Promise<CaptureServer> {
  const state: CaptureServer = {
    url: "",
    received: [],
    failStatus: null,
    close: async () => undefined,
  };
  const seen = new Set<string>();

  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let eventId: string | null = null;
      try {
        eventId = (JSON.parse(body) as { event_id?: string }).event_id ?? null;
      } catch {
        eventId = null;
      }
      const header = String(req.headers["fiber-merchantops-signature"] ?? "");
      const verification = verifySignatureHeader({
        header,
        rawBody: body,
        secret: SECRET,
      });
      const duplicate = eventId !== null && seen.has(eventId);
      if (eventId !== null && !duplicate) {
        seen.add(eventId);
      }
      state.received.push({
        eventId,
        verified: verification.valid,
        duplicate,
        idempotencyKey: (req.headers["idempotency-key"] as string) ?? null,
      });

      if (state.failStatus !== null) {
        res.statusCode = state.failStatus;
        res.end("fail");
        return;
      }
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  state.url = `http://127.0.0.1:${port}/webhooks/fiber`;
  state.close = () =>
    new Promise<void>((resolve) => server.close(() => resolve()));
  return state;
}

let ctx: TestContext;
let capture: CaptureServer;

beforeEach(async () => {
  ctx = await createTestContext();
  capture = await startCaptureServer();
  // Point the seeded merchant at the capture server.
  await ctx.prisma.merchant.update({
    where: { id: "m_123" },
    data: { webhookUrl: capture.url, webhookSecret: SECRET },
  });
});

afterEach(async () => {
  await capture.close();
  await ctx.cleanup();
});

/** Create an intent — queues one pending payment_intent.created webhook. */
async function queueOneWebhook(): Promise<WebhookEvent> {
  await ctx.app.inject({
    method: "POST",
    url: "/v1/payment_intents",
    payload: createIntentBody(),
  });
  const row = await ctx.prisma.webhookEvent.findFirst({
    where: { type: "payment_intent.created" },
  });
  if (!row) {
    throw new Error("expected a queued webhook row");
  }
  return row;
}

async function reload(id: string): Promise<WebhookEvent> {
  const row = await ctx.prisma.webhookEvent.findUnique({ where: { id } });
  if (!row) {
    throw new Error(`webhook ${id} vanished`);
  }
  return row;
}

async function ledgerTypes(): Promise<string[]> {
  const response = await ctx.app.inject({
    method: "GET",
    url: "/v1/ledger?merchant_id=m_123",
  });
  return response.json().events.map((event: any) => event.event_type);
}

describe("webhook delivery", () => {
  it("delivers a queued webhook, signed and verifiable over real HTTP", async () => {
    const queued = await queueOneWebhook();

    // now() nudged ahead so the freshly-queued row is due; signature stays well
    // inside the receiver's ±300s tolerance.
    const dispatcher = new WebhookDispatcher({
      prisma: ctx.prisma,
      ledger: ctx.app.context.ledger,
      timeoutMs: 5000,
      now: () => Date.now() + 5000,
    });
    const processed = await dispatcher.deliverDue();
    expect(processed).toBe(1);

    expect(capture.received).toHaveLength(1);
    expect(capture.received[0]).toMatchObject({
      eventId: queued.id,
      verified: true,
      duplicate: false,
      idempotencyKey: queued.id,
    });

    const row = await reload(queued.id);
    expect(row.status).toBe("delivered");
    expect(row.deliveredAt).not.toBeNull();
    expect(row.attempts).toBe(0);
    expect(row.nextRetryAt).toBeNull();
    expect(await ledgerTypes()).toContain("webhook_delivered");
  });

  it("retries a failing endpoint 1→4 on the 10s/30s/120s schedule, then dead-letters", async () => {
    capture.failStatus = 500;
    const queued = await queueOneWebhook();

    let clock = Date.now() + 5000;
    const dispatcher = new WebhookDispatcher({
      prisma: ctx.prisma,
      ledger: ctx.app.context.ledger,
      timeoutMs: 5000,
      now: () => clock,
    });

    const expectedDelays = [10_000, 30_000, 120_000];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const before = clock;
      await dispatcher.deliverDue();
      const row = await reload(queued.id);
      expect(row.attempts).toBe(attempt);
      expect(row.status).toBe("retrying");
      expect(row.nextRetryAt).not.toBeNull();
      expect((row.nextRetryAt as Date).getTime() - before).toBe(
        expectedDelays[attempt - 1],
      );
      clock = (row.nextRetryAt as Date).getTime();
    }

    // 4th attempt exhausts the schedule → dead_lettered.
    await dispatcher.deliverDue();
    const dead = await reload(queued.id);
    expect(dead.attempts).toBe(4);
    expect(dead.status).toBe("dead_lettered");
    expect(dead.nextRetryAt).toBeNull();

    // A dead-lettered row is no longer picked up.
    clock += 1_000_000;
    expect(await dispatcher.deliverDue()).toBe(0);

    const types = await ledgerTypes();
    expect(types.filter((t) => t === "webhook_failed")).toHaveLength(4);
    expect(types).toContain("webhook_dead_lettered");
  });

  it("replays a delivered webhook: redelivers as a duplicate, deliveredAt unchanged", async () => {
    const queued = await queueOneWebhook();
    const dispatcher = new WebhookDispatcher({
      prisma: ctx.prisma,
      ledger: ctx.app.context.ledger,
      timeoutMs: 5000,
      now: () => Date.now() + 5000,
    });

    await dispatcher.deliverDue();
    const firstDeliveredAt = (await reload(queued.id)).deliveredAt;
    expect(firstDeliveredAt).not.toBeNull();

    const replay = await ctx.app.inject({
      method: "POST",
      url: `/v1/webhooks/${queued.id}/replay`,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({
      event_id: queued.id,
      status: "pending",
      replayed: true,
    });
    const afterReplay = await reload(queued.id);
    expect(afterReplay.status).toBe("pending");
    expect(afterReplay.attempts).toBe(0);
    expect(afterReplay.deliveredAt?.getTime()).toBe(firstDeliveredAt?.getTime());

    await dispatcher.deliverDue();
    const redelivered = await reload(queued.id);
    expect(redelivered.status).toBe("delivered");
    // deliveredAt is the original timestamp, not the redelivery.
    expect(redelivered.deliveredAt?.getTime()).toBe(firstDeliveredAt?.getTime());

    expect(capture.received).toHaveLength(2);
    expect(capture.received[1]?.duplicate).toBe(true);

    const types = await ledgerTypes();
    const replayed = types.indexOf("webhook_replayed");
    const ignored = types.indexOf("duplicate_event_ignored");
    expect(replayed).toBeGreaterThanOrEqual(0);
    expect(ignored).toBeGreaterThan(replayed);
  });

  it("replays from a dead_lettered state and delivers once the receiver recovers", async () => {
    capture.failStatus = 500;
    const queued = await queueOneWebhook();

    let clock = Date.now() + 5000;
    const dispatcher = new WebhookDispatcher({
      prisma: ctx.prisma,
      ledger: ctx.app.context.ledger,
      timeoutMs: 5000,
      now: () => clock,
    });

    // Drive to dead_lettered (four failed attempts).
    for (let i = 0; i < 4; i++) {
      await dispatcher.deliverDue();
      const row = await reload(queued.id);
      if (row.nextRetryAt) {
        clock = row.nextRetryAt.getTime();
      }
    }
    expect((await reload(queued.id)).status).toBe("dead_lettered");

    // Receiver recovers; operator replays.
    capture.failStatus = null;
    const replay = await ctx.app.inject({
      method: "POST",
      url: `/v1/webhooks/${queued.id}/replay`,
    });
    expect(replay.statusCode).toBe(200);

    await dispatcher.deliverDue();
    const delivered = await reload(queued.id);
    expect(delivered.status).toBe("delivered");
    expect(delivered.deliveredAt).not.toBeNull();
  });

  it("404s replay for an unknown event", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhooks/evt_missing/replay",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
  });
});

describe("GET /v1/webhook_events", () => {
  it("lists a merchant's webhook events (newest-first)", async () => {
    const queued = await queueOneWebhook();
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/webhook_events?merchant_id=m_123",
    });
    expect(response.statusCode).toBe(200);
    const events = response.json().events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_id: queued.id,
      merchant_id: "m_123",
      type: "payment_intent.created",
      status: "pending",
      attempts: 0,
      delivered_at: null,
    });
    expect(events[0].next_retry_at).toEqual(expect.any(String));
  });

  it("validates that merchant_id is present", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/webhook_events",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });
});
