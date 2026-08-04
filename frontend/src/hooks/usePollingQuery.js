import { useCallback, useEffect, useRef, useState } from "react";

// Gana la última petición pedida, no la última en llegar.
//
// Cada llamada a `begin()` se apunta como la vigente y devuelve la forma de preguntar si
// todavía lo es. Sin esto, escribir en el buscador deja en pantalla el resultado de una
// palabra anterior cada vez que una respuesta lenta adelanta a una rápida.
export function createRunGuard() {
  let current = 0;
  return () => {
    const mine = (current += 1);
    return () => mine === current;
  };
}

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
  const beginRun = useRef(null);
  if (beginRun.current === null) beginRun.current = createRunGuard();
  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  // `mounted` sólo distingue montado de desmontado. Antes se apagaba también al cambiar
  // las dependencias, y como el efecto siguiente lo volvía a encender de inmediato, la
  // respuesta de la petición vieja se encontraba la bandera en verde y pisaba a la nueva.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!enabled) return null;
      const isMine = beginRun.current();
      const isCurrent = () => mounted.current && isMine();
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await fetcher();
        if (isCurrent()) {
          latest.current = result;
          setData(result);
          setError(null);
        }
        return result;
      } catch (nextError) {
        if (isCurrent()) setError(nextError);
        return null;
      } finally {
        if (isCurrent()) {
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
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    // Bandera propia de esta ejecución del efecto. La anterior queda en `true` para
    // siempre, así que su cadena de sondeo muere aunque su petición termine más tarde;
    // antes cada cambio de filtro dejaba viva una cadena más, todas escribiendo encima.
    let cancelled = false;
    let timer = null;
    const resolveDelay = () => {
      const source = intervalRef.current;
      const value = typeof source === "function" ? source(latest.current) : source;
      return Number.isFinite(value) && value > 0 ? Math.max(1_000, value) : null;
    };

    // A self-rescheduling timeout rather than setInterval: the delay is recomputed after
    // every response, and a slow response can never queue up overlapping requests.
    const schedule = () => {
      if (cancelled) return;
      const delay = resolveDelay();
      if (delay == null) return;
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        await load({ quiet: true });
        schedule();
      }, delay);
    };

    load().then(() => {
      if (!cancelled) schedule();
    });

    return () => {
      cancelled = true;
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
