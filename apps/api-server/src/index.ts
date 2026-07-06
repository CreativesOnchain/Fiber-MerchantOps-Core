import { buildApp } from "./app";
import { loadConfig } from "./config";
import { seedDefaultMerchant } from "./seed";
import { startStatusPoller } from "./workers/status-poller";
import { startWebhookWorker } from "./workers/webhook-worker";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  // Boot with the demo merchant present (blueprint §1 / brief demo step 4).
  await seedDefaultMerchant(app.context.prisma, config);

  // Webhook delivery worker — always on; drains queued webhooks on an interval.
  const webhookWorker = startWebhookWorker(app.context);
  app.addHook("onClose", async () => webhookWorker.stop());
  app.log.info(
    `webhook worker started (every ${config.WEBHOOK_WORKER_INTERVAL_MS}ms)`,
  );

  // Optional background status poll — default off (blueprint §16); the demo
  // settles intents through the demo endpoints instead.
  if (config.STATUS_POLL_ENABLED) {
    const poller = startStatusPoller(app.context);
    app.addHook("onClose", async () => poller.stop());
    app.log.info(
      `status poller enabled (every ${config.STATUS_POLL_INTERVAL_MS}ms)`,
    );
  }

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
