/**
 * Colored pill for payment-intent and webhook statuses. The `tone` is derived
 * from the status string so unknown values still render (neutral tone).
 */
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${toneFor(status)}`}>{status}</span>;
}

function toneFor(status: string): string {
  switch (status) {
    case "paid":
    case "delivered":
    case "recorded":
      return "success";
    case "requires_payment":
    case "processing":
    case "pending":
    case "retrying":
      return "pending";
    case "expired":
    case "failed":
    case "dead_lettered":
      return "danger";
    case "created":
      return "neutral";
    case "none":
      return "muted";
    default:
      return "neutral";
  }
}
