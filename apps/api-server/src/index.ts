import { buildApp } from "./app";
import { loadConfig } from "./config";
import { seedDefaultMerchant } from "./seed";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  // Boot with the demo merchant present (blueprint §1 / brief demo step 4).
  await seedDefaultMerchant(app.context.prisma, config);

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
