import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import { MerchantOpsApiError, MerchantOpsClient } from "@fiber-merchantops/core";

// Defaults let the demo commands in brief §21 run verbatim against a local
// api-server + seeded merchant; env vars override for other deployments.
const DEFAULT_BASE_URL =
  process.env.MERCHANTOPS_BASE_URL ?? "http://localhost:8080";
const DEFAULT_MERCHANT_ID =
  process.env.MERCHANTOPS_MERCHANT_ID ??
  process.env.DEFAULT_MERCHANT_ID ??
  "m_123";

function client(baseUrl: string, merchantId: string): MerchantOpsClient {
  return new MerchantOpsClient({ baseUrl, merchantId });
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const program = new Command();
program
  .name("merchantops")
  .description("CLI for Fiber MerchantOps Core (wired through @fiber-merchantops/core)")
  .version("0.1.0");

// merchantops create-intent --merchant m_123 --order order_789 --amount 25 --asset RUSD
program
  .command("create-intent")
  .description("Create a payment intent")
  .option("--merchant <id>", "merchant id", DEFAULT_MERCHANT_ID)
  .requiredOption("--order <id>", "merchant order id")
  .requiredOption("--amount <amount>", "amount as a positive decimal string")
  .requiredOption("--asset <asset>", "asset code, e.g. RUSD or CKB")
  .option("--description <text>", "human description")
  .option("--customer-reference <ref>", "customer reference")
  .option("--idempotency-key <key>", "Idempotency-Key header value")
  .option("--base-url <url>", "API base URL", DEFAULT_BASE_URL)
  .action(async (opts) => {
    const intent = await client(opts.baseUrl, opts.merchant).createPaymentIntent(
      {
        orderId: opts.order,
        amount: opts.amount,
        asset: opts.asset,
        description: opts.description,
        customerReference: opts.customerReference,
        idempotencyKey: opts.idempotencyKey,
      },
    );
    printJson(intent);
  });

// merchantops refresh pi_123
program
  .command("refresh")
  .description("Refresh a payment intent's status against the Fiber adapter")
  .argument("<paymentIntentId>", "payment intent id, e.g. pi_123")
  .option("--merchant <id>", "merchant id", DEFAULT_MERCHANT_ID)
  .option("--base-url <url>", "API base URL", DEFAULT_BASE_URL)
  .action(async (paymentIntentId: string, opts) => {
    const result = await client(
      opts.baseUrl,
      opts.merchant,
    ).refreshPaymentStatus(paymentIntentId);
    printJson(result);
  });

// merchantops export --merchant m_123 --format csv
program
  .command("export")
  .description("Export reconciliation records to a file (CSV or JSON)")
  .option("--merchant <id>", "merchant id", DEFAULT_MERCHANT_ID)
  .option("--format <format>", "csv or json", "csv")
  .option("--out <file>", "output file path")
  .option("--base-url <url>", "API base URL", DEFAULT_BASE_URL)
  .action(async (opts) => {
    const format = String(opts.format).toLowerCase();
    const api = client(opts.baseUrl, opts.merchant);
    if (format === "json") {
      const data = await api.exportReconciliationJson();
      const out = opts.out ?? `reconciliation-${opts.merchant}.json`;
      await writeFile(out, `${JSON.stringify(data, null, 2)}\n`);
      process.stderr.write(
        `Wrote ${data.records.length} record(s) to ${out}\n`,
      );
    } else if (format === "csv") {
      const csv = await api.exportReconciliationCsv();
      const out = opts.out ?? `reconciliation-${opts.merchant}.csv`;
      await writeFile(out, csv);
      process.stderr.write(`Wrote CSV to ${out}\n`);
    } else {
      throw new Error(`unknown --format "${opts.format}" (use csv or json)`);
    }
  });

// merchantops replay-webhook evt_123
// Replay is not part of the §20 SDK surface, so this calls the endpoint directly.
program
  .command("replay-webhook")
  .description("Replay a webhook event by id")
  .argument("<eventId>", "webhook event id, e.g. evt_123")
  .option("--base-url <url>", "API base URL", DEFAULT_BASE_URL)
  .action(async (eventId: string, opts) => {
    const baseUrl = String(opts.baseUrl).replace(/\/+$/, "");
    const response = await fetch(
      `${baseUrl}/v1/webhooks/${encodeURIComponent(eventId)}/replay`,
      { method: "POST", headers: { accept: "application/json" } },
    );
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`replay failed (HTTP ${response.status}): ${text}`);
    }
    process.stdout.write(`${text}\n`);
  });

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  if (error instanceof MerchantOpsApiError) {
    process.stderr.write(
      `API error ${error.status} ${error.code}: ${error.message}\n`,
    );
  } else {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
  process.exit(1);
});
