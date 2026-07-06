import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
});

describe("POST /v1/merchants", () => {
  it("creates a merchant and reveals the webhook secret once", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/merchants",
      payload: {
        merchant_id: "m_acme",
        name: "Acme Co",
        webhook_url: "https://acme.example/hooks",
        webhook_secret: "whsec_acme_secret",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      merchant_id: "m_acme",
      name: "Acme Co",
      webhook_url: "https://acme.example/hooks",
      has_webhook_secret: true,
      webhook_secret: "whsec_acme_secret",
    });
  });

  it("generates an id and a webhook secret when omitted", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/merchants",
      payload: { name: "Generated" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.merchant_id).toMatch(/^m_/);
    expect(body.webhook_secret).toMatch(/^whsec_/);
    expect(body.webhook_url).toBeNull();
  });

  it("rejects a duplicate merchant id with 409", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/merchants",
      // m_123 is seeded by the test context.
      payload: { merchant_id: "m_123", name: "Clash" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("merchant_already_exists");
  });

  it("validates the request body", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/merchants",
      payload: { webhook_url: "not-a-url" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });
});

describe("GET /v1/merchants/:id", () => {
  it("returns a merchant without exposing the secret", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/merchants/m_123",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ merchant_id: "m_123", has_webhook_secret: true });
    expect(body).not.toHaveProperty("webhook_secret");
  });

  it("404s an unknown merchant", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/merchants/m_nope",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
  });
});
