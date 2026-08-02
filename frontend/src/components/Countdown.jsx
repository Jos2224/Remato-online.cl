import { useEffect, useMemo, useRef, useState } from "react";
import { formatDuration } from "../utils/format";
import { serverNowMs } from "../utils/server-clock";

export function Countdown({ until, endedLabel = "Tiempo cumplido", compact = false, onEnd }) {
  const target = useMemo(() => new Date(until).getTime(), [until]);
  const [now, setNow] = useState(serverNowMs());
  const endNotified = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNowMs()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const difference = Number.isFinite(target) ? target - now : 0;
  const ended = difference <= 0;

  useEffect(() => {
    endNotified.current = false;
  }, [target]);

  useEffect(() => {
    if (ended && !endNotified.current && onEnd) {
      endNotified.current = true;
      onEnd();
    }
  }, [ended, onEnd]);

  return (
    <span className={`countdown${ended ? " countdown--ended" : ""}${compact ? " countdown--compact" : ""}`}>
      <span className="countdown__dot" aria-hidden="true" />
      <span>{ended ? endedLabel : formatDuration(difference)}</span>
    </span>
  );
}
