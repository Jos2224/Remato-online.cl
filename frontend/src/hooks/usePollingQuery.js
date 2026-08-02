import { useCallback, useEffect, useRef, useState } from "react";

// `interval` may be a number or a function of the latest result. A function lets a
// screen poll faster exactly when it matters — the final minute before an auction
// closes, where a 12 second refresh hides the price movement completely — without
// hammering the API while everything is hours away from closing.
export function usePollingQuery(fetcher, { interval = 12_000, enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const latest = useRef(null);
  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!enabled) return null;
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await fetcher();
        if (mounted.current) {
          latest.current = result;
          setData(result);
          setError(null);
        }
        return result;
      } catch (nextError) {
        if (mounted.current) setError(nextError);
        return null;
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // Callers pass primitive dependencies to deliberately control the polling request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ...deps],
  );

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let timer = null;
    const resolveDelay = () => {
      const source = intervalRef.current;
      const value = typeof source === "function" ? source(latest.current) : source;
      return Number.isFinite(value) && value > 0 ? Math.max(1_000, value) : null;
    };

    // A self-rescheduling timeout rather than setInterval: the delay is recomputed after
    // every response, and a slow response can never queue up overlapping requests.
    const schedule = () => {
      const delay = resolveDelay();
      if (delay == null) return;
      timer = window.setTimeout(async () => {
        await load({ quiet: true });
        if (mounted.current) schedule();
      }, delay);
    };

    load().then(() => {
      if (mounted.current) schedule();
    });

    return () => {
      mounted.current = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [enabled, load]);

  return { data, setData, loading, refreshing, error, reload: load };
}

// Shared cadence rule: refresh every 2s inside the final minute, 5s inside the final
// five minutes, and settle back to the relaxed default the rest of the time.
export function urgencyInterval(closingTimes, relaxed = 12_000) {
  const now = Date.now();
  const soonest = (Array.isArray(closingTimes) ? closingTimes : [closingTimes])
    .map((value) => (value ? new Date(value).getTime() - now : Number.POSITIVE_INFINITY))
    .filter((ms) => Number.isFinite(ms) && ms > 0)
    .sort((a, b) => a - b)[0];

  if (soonest == null) return relaxed;
  if (soonest <= 60_000) return 2_000;
  if (soonest <= 5 * 60_000) return 5_000;
  return relaxed;
}
