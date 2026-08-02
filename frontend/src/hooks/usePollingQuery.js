import { useCallback, useEffect, useRef, useState } from "react";

export function usePollingQuery(fetcher, { interval = 12_000, enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!enabled) return null;
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await fetcher();
        if (mounted.current) {
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
    load();
    const timer = interval ? window.setInterval(() => load({ quiet: true }), interval) : null;
    return () => {
      mounted.current = false;
      if (timer) window.clearInterval(timer);
    };
  }, [enabled, interval, load]);

  return { data, setData, loading, refreshing, error, reload: load };
}
