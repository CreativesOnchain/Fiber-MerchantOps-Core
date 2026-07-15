import type { ReactNode } from "react";

/**
 * Status pill. Colours follow the reference table: green "Success", blue
 * "Pending", amber for warn states, red for terminal failures, grey otherwise.
 */
export type Tone = "success" | "info" | "danger" | "warn" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
  danger: "bg-danger-bg text-danger",
  warn: "bg-warn-bg text-warn",
  neutral: "bg-neutral-bg text-neutral",
};

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-[3px] text-[12px] font-medium leading-none ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

/** Map a domain status string onto a pill tone. */
export function toneFor(status: string): Tone {
  switch (status) {
    case "paid":
    case "delivered":
    case "recorded":
    case "fulfilled":
      return "success";
    case "requires_payment":
    case "processing":
    case "pending":
    case "retrying":
    case "created":
      return "info";
    case "expired":
      return "warn";
    case "failed":
    case "dead_lettered":
      return "danger";
    default:
      return "neutral";
  }
}

/** Humanise `dead_lettered` -> `Dead lettered` for display. */
export function humanise(status: string): string {
  const spaced = status.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={toneFor(status)}>{humanise(status)}</Pill>;
}
