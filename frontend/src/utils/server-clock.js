let offsetMilliseconds = 0;

export function serverNowMs() {
  return Date.now() + offsetMilliseconds;
}

export function setServerInstant(utcNow, requestStartedAt, responseReceivedAt = Date.now()) {
  const serverTimestamp = new Date(utcNow).getTime();
  if (!Number.isFinite(serverTimestamp)) return;

  const localMidpoint = requestStartedAt + (responseReceivedAt - requestStartedAt) / 2;
  offsetMilliseconds = serverTimestamp - localMidpoint;
}

export function resetServerClock() {
  offsetMilliseconds = 0;
}
