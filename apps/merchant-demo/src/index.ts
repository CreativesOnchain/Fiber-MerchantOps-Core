import { buildDemoServer } from "./app";
import { loadDemoConfig } from "./config";

async function main(): Promise<void> {
  const config = loadDemoConfig();
  const app = buildDemoServer({ config });
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    `merchant-demo listening on :${config.port} — verifying webhooks with the shared secret`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
