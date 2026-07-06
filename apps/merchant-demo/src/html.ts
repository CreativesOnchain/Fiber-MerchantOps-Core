import type { Order, ReceivedEvent } from "./order-store";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Colour cue per order status so the demo video reads at a glance. */
const STATUS_COLOR: Record<string, string> = {
  pending: "#8a6d00",
  fulfilled: "#0a7a2f",
  expired: "#7a4e0a",
  failed: "#a11",
};

/**
 * Minimal server-rendered dashboard for the demo video: the merchant's orders
 * and the append-only log of received webhooks (with verified/duplicate flags).
 * Self-contained HTML, no assets.
 */
export function renderDemoPage(orders: Order[], events: ReceivedEvent[]): string {
  const orderRows = orders.length
    ? orders
        .map(
          (order) => `      <tr>
        <td>${escapeHtml(order.order_id)}</td>
        <td><strong style="color:${STATUS_COLOR[order.status] ?? "#333"}">${escapeHtml(order.status)}</strong></td>
        <td>${escapeHtml(order.amount)}</td>
        <td>${escapeHtml(order.asset)}</td>
        <td>${escapeHtml(order.payment_intent_id)}</td>
        <td>${escapeHtml(order.updated_at)}</td>
      </tr>`,
        )
        .join("\n")
    : `      <tr><td colspan="6" class="empty">No orders yet</td></tr>`;

  const eventRows = events.length
    ? [...events]
        .reverse()
        .map(
          (event) => `      <tr>
        <td>${escapeHtml(event.type)}</td>
        <td>${escapeHtml(event.order_id)}</td>
        <td>${event.verified ? "✅" : "❌"}</td>
        <td>${event.duplicate ? "♻️ duplicate" : ""}</td>
        <td>${escapeHtml(event.outcome)}</td>
        <td>${escapeHtml(event.received_at)}</td>
      </tr>`,
        )
        .join("\n")
    : `      <tr><td colspan="6" class="empty">No webhooks received yet</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Merchant Demo — Orders</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; color: #1a1a1a; }
      h1 { font-size: 1.4rem; }
      h2 { font-size: 1.1rem; margin-top: 2rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
      th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #ddd; }
      th { color: #555; font-weight: 600; }
      td { word-break: break-all; }
      .empty { color: #999; text-align: center; }
      .badge { background: #eef; padding: 0.15rem 0.5rem; border-radius: 0.4rem; font-size: 0.8rem; }
    </style>
  </head>
  <body>
    <h1>Merchant Demo <span class="badge">verifies Fiber MerchantOps webhooks</span></h1>
    <h2>Orders</h2>
    <table>
      <thead><tr><th>Order</th><th>Status</th><th>Amount</th><th>Asset</th><th>Payment Intent</th><th>Updated</th></tr></thead>
      <tbody>
${orderRows}
      </tbody>
    </table>
    <h2>Received Webhooks (newest first)</h2>
    <table>
      <thead><tr><th>Type</th><th>Order</th><th>Verified</th><th>Duplicate</th><th>Outcome</th><th>Received</th></tr></thead>
      <tbody>
${eventRows}
      </tbody>
    </table>
  </body>
</html>
`;
}
