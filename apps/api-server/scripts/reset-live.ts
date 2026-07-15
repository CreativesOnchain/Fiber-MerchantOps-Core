/**
 * Resets the database to a clean, **live-only** state:
 *   1. Deletes every row (intents, ledger, webhooks, receipts, merchants).
 *   2. Creates exactly one merchant that receives through the live Fiber node.
 *   3. Refuses to continue unless the API reports `mode: "real"`.
 *   4. Creates real payment intents against the running API, so every invoice is
 *      a genuine node-issued invoice (real `fiber_invoice` + `payment_hash`).
 *
 * Run against a real-mode API:  `pnpm --filter @fiber-merchantops/api-server reset:live`
 * Nothing here is simulated — unpaid intents are legitimate node artifacts; they
 * settle to `paid` only when actually paid on the Fiber network.
 */
import { createPrismaClient } from "../src/db";
import { loadConfig } from "../src/config";
import { monotonicNow } from "../src/lib/clock";

const config = loadConfig();
const API_BASE = process.env.API_BASE ?? `http://127.0.0.1:${config.PORT}`;

// A handful of real CKB invoices (native asset — no decimals ambiguity). Amounts
// are small so they stay within the node's inbound capacity if later paid.
const SEED_INVOICES: {
  order_id: string;
  amount: string;
  asset: string;
  description: string;
  customer_reference?: string;
}[] = [
  { order_id: "order_1001", amount: "1", asset: "CKB", description: "Espresso subscription" },
  { order_id: "order_1002", amount: "2.5", asset: "CKB", description: "Cold brew 6-pack", customer_reference: "cus_amelia" },
  { order_id: "order_1003", amount: "0.75", asset: "CKB", description: "Single origin drip" },
  { order_id: "order_1004", amount: "4", asset: "CKB", description: "Roaster's bundle", customer_reference: "cus_devon" },
  { order_id: "order_1005", amount: "1.2", asset: "CKB", description: "Pour-over kit refill" },
  { order_id: "order_1006", amount: "3.3", asset: "CKB", description: "Office beans (monthly)", customer_reference: "cus_atlas" },
];

interface NodeDescriptor {
  mode: string;
  network: string;
  pubkey: string | null;
}

async function main(): Promise<void> {
  // --- 0. Confirm the API is up and in REAL mode before touching anything. ---
  let node: NodeDescriptor;
  try {
    const res = await fetch(`${API_BASE}/v1/node`);
    node = (await res.json()) as NodeDescriptor;
  } catch (error) {
    throw new Error(
      `Could not reach the API at ${API_BASE}. Start it in real mode first. (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
  if (node.mode !== "real") {
    throw new Error(
      `API is in "${node.mode}" mode. Refusing to create "live" data — set FIBER_ADAPTER_MODE=real and restart.`,
    );
  }
  console.log(
    `Live node OK: ${node.network} · ${node.pubkey}\n`,
  );

  // --- 1. Wipe every table (children first for FK safety). ---
  const prisma = createPrismaClient(config.DATABASE_URL);
  await prisma.receipt.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.ledgerEvent.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.paymentIntent.deleteMany();
  await prisma.merchant.deleteMany();
  console.log("Wiped all merchants, intents, ledger events, webhooks, receipts.");

  // --- 2. One merchant, receiving through the live node. ---
  await prisma.merchant.create({
    data: {
      id: config.DEFAULT_MERCHANT_ID,
      name: "Atlas Coffee (Live)",
      webhookUrl: config.MERCHANT_DEMO_WEBHOOK_URL,
      webhookSecret: config.DEFAULT_WEBHOOK_SECRET,
      createdAt: monotonicNow(),
    },
  });
  await prisma.$disconnect();
  console.log(`Created merchant ${config.DEFAULT_MERCHANT_ID} (receives via node ${node.pubkey?.slice(0, 12)}…).`);

  // --- 3. Real node invoices through the API's normal create path. ---
  console.log(`\nCreating ${SEED_INVOICES.length} real invoices via ${API_BASE} …`);
  let created = 0;
  for (const invoice of SEED_INVOICES) {
    const res = await fetch(`${API_BASE}/v1/payment_intents`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": `${invoice.order_id}_seed`,
      },
      body: JSON.stringify({ merchant_id: config.DEFAULT_MERCHANT_ID, ...invoice }),
    });
    const body = (await res.json()) as {
      payment_intent_id?: string;
      fiber_invoice?: string;
      payment_hash?: string;
      error?: { message?: string };
    };
    if (res.status >= 300) {
      console.log(`  ✗ ${invoice.order_id}: ${body.error?.message ?? res.status}`);
      continue;
    }
    created += 1;
    console.log(
      `  ✓ ${invoice.order_id} → ${body.payment_intent_id} · ${body.fiber_invoice?.slice(0, 22)}… · hash ${body.payment_hash?.slice(0, 12)}…`,
    );
  }

  console.log(`\nDone. ${created}/${SEED_INVOICES.length} live invoices created.`);
  console.log(
    "All intents are real node invoices in `requires_payment`; they settle to `paid` only when paid on the Fiber network.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
