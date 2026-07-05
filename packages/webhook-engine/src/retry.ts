import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
} from "@fiber-merchantops/shared";

/** Delay applied before delivery attempt N (1-based): 0, 10s, 30s, 2min. */
export function delayBeforeAttemptMs(attemptNumber: number): number {
  const delay = Number.isInteger(attemptNumber)
    ? WEBHOOK_RETRY_DELAYS_MS[attemptNumber - 1]
    : undefined;
  if (delay === undefined) {
    throw new RangeError(
      `attemptNumber must be an integer between 1 and ${WEBHOOK_MAX_ATTEMPTS}, got ${attemptNumber}`,
    );
  }
  return delay;
}

/**
 * Given how many attempts have already completed (and failed), returns the
 * epoch-ms time of the next attempt, or null when the schedule is exhausted
 * and the event must be dead-lettered.
 */
export function nextRetryAtMs(
  completedAttempts: number,
  nowMs: number,
): number | null {
  if (completedAttempts >= WEBHOOK_MAX_ATTEMPTS) {
    return null;
  }
  return nowMs + delayBeforeAttemptMs(completedAttempts + 1);
}
