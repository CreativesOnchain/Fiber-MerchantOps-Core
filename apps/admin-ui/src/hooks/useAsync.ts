import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Manually re-run the loader (e.g. after an action mutates server state). */
  reload: () => void;
}

/**
 * Loads async data, re-running whenever `deps` change and optionally on an
 * interval (lightweight polling — the blueprint's stand-in for websockets).
 * Errors are surfaced as strings; the previous data is kept on failure so a
 * transient blip does not blank the screen.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  pollMs?: number,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    try {
      const result = await loaderRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    setLoading(true);
    void run();
    if (!pollMs) {
      return;
    }
    const timer = window.setInterval(() => void run(), pollMs);
    return () => window.clearInterval(timer);
  }, [run, pollMs]);

  return { data, error, loading, reload: run };
}
