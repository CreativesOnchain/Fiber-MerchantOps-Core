import type { AppContext } from "../context";

/** Intent statuses worth polling — anything non-terminal that can still settle. */
const POLLABLE_STATUSES = ["requires_payment", "processing"] as const;

export interface StatusPoller {
  /** Stop the interval; safe to call more than once. */
  stop(): void;
  /** Run one poll immediately (also used by tests to avoid waiting on timers). */
  tick(): Promise<void>;
}

/**
 * Optional background worker (blueprint §16, brief §14.4) that periodically
 * refreshes every non-terminal intent through the shared status-tracker path, so
 * settlements are picked up without an explicit client refresh. Disabled unless
 * STATUS_POLL_ENABLED=true — the demo drives settlement via the demo endpoints,
 * so this stays off by default. A reentrancy guard prevents overlapping ticks
 * when a poll runs longer than the interval.
 */
export function startStatusPoller(ctx: AppContext): StatusPoller {
  let running = false;

  async function tick(): Promise<void> {
    if (running) {
      return;
    }
    running = true;
    try {
      const intents = await ctx.prisma.paymentIntent.findMany({
        where: { status: { in: [...POLLABLE_STATUSES] } },
        select: { id: true },
      });
      for (const { id } of intents) {
        try {
          await ctx.statusTracker.refresh(id);
        } catch {
          // One bad intent must not stop the sweep; the next tick retries it.
        }
      }
    } finally {
      running = false;
    }
  }

  const interval = setInterval(() => {
    void tick();
  }, ctx.config.STATUS_POLL_INTERVAL_MS);
  interval.unref?.();

  return {
    stop: () => clearInterval(interval),
    tick,
  };
}
