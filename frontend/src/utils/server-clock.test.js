import { afterEach, describe, expect, it, vi } from "vitest";
import { resetServerClock, serverNowMs, setServerInstant } from "./server-clock";

describe("server clock", () => {
  afterEach(() => {
    resetServerClock();
    vi.useRealTimers();
  });

  it("uses the request midpoint to compensate network latency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:01.000Z"));
    setServerInstant("2026-08-01T16:00:00.500Z", Date.parse("2026-08-01T12:00:00.000Z"));
    expect(serverNowMs()).toBe(Date.parse("2026-08-01T16:00:01.000Z"));
  });
});
