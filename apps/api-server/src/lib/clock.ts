let lastMs = 0;

/**
 * A strictly-monotonic wall-clock. Successive calls never return the same or an
 * earlier instant, even when invoked within the same millisecond. Persisting
 * `createdAt` from this clock keeps ledger timelines (and any other ordered-by-
 * time reads) stable and in insertion order — SQLite stores millisecond
 * precision, but two rows written back-to-back can otherwise share a timestamp.
 */
export function monotonicNow(): Date {
  const now = Date.now();
  lastMs = now > lastMs ? now : lastMs + 1;
  return new Date(lastMs);
}
