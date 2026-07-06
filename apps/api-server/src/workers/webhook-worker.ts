import type { AppContext } from "../context";

export interface WebhookWorker {
  /** Stop the interval; safe to call more than once. */
  stop(): void;
  /** Run one delivery sweep immediately (also used by tests). */
  tick(): Promise<void>;
}

/**
 * Background delivery loop (brief §15). Every WEBHOOK_WORKER_INTERVAL_MS it asks
 * the shared WebhookDispatcher to deliver all due rows. A reentrancy guard keeps
 * a slow sweep from overlapping the next tick, and the timer is unref'd so it
 * never keeps the process alive on its own.
 */
export function startWebhookWorker(ctx: AppContext): WebhookWorker {
  let running = false;

  async function tick(): Promise<void> {
    if (running) {
      return;
    }
    running = true;
    try {
      await ctx.webhookDispatcher.deliverDue();
    } catch {
      // A sweep-level failure must not kill the loop; the next tick retries.
    } finally {
      running = false;
    }
  }

  const interval = setInterval(() => {
    void tick();
  }, ctx.config.WEBHOOK_WORKER_INTERVAL_MS);
  interval.unref?.();

  return {
    stop: () => clearInterval(interval),
    tick,
  };
}
