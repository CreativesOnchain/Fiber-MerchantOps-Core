import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadConfig } from "../src/config";

const app = await buildApp({
  config: loadConfig({ ...process.env, FIBER_ADAPTER_MODE: "simulated" }),
  logger: false,
});

afterAll(async () => {
  await app.close();
});

describe("GET /healthz", () => {
  it("reports ok with the active adapter mode", async () => {
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      adapter_mode: "simulated",
      demo_endpoints_enabled: true,
    });
  });
});
