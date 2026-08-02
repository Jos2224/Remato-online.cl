import { describe, expect, it } from "vitest";
import { chileInputToIso, formatDuration, toChileInputValue } from "./format.js";

describe("utilidades horarias", () => {
  it("convierte una hora de invierno chilena a UTC", () => {
    expect(chileInputToIso("2026-08-01T19:30")).toBe("2026-08-01T23:30:00.000Z");
  });

  it("mantiene el minuto al volver al formato de Chile", () => {
    const iso = chileInputToIso("2026-08-01T19:30");
    expect(toChileInputValue(iso)).toBe("2026-08-01T19:30");
  });

  it("formatea duraciones sin valores negativos", () => {
    expect(formatDuration(3_661_000)).toBe("01:01:01");
    expect(formatDuration(-1)).toBe("00:00:00");
  });
});
