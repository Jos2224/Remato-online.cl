import { describe, expect, it } from "vitest";
import { describeApiError, holdForBid, minimumIncrement, minimumNextBid } from "./format.js";

// El frontend duplica a propósito las reglas de dinero del backend, para poder anticipar
// el mínimo y la garantía sin una ida y vuelta al servidor. El servidor sigue siendo la
// autoridad, pero si las dos copias se desincronizan la interfaz miente: muestra un
// mínimo que el servidor rechaza, o una garantía distinta a la que congela.
//
// Estos valores están copiados de backend/src/domain/{auction,money}.js. Si allá cambian
// y aquí no, este archivo falla.
describe("las reglas de dinero coinciden con el backend", () => {
  it("usa los mismos tramos de incremento mínimo", () => {
    expect(minimumIncrement(5_000)).toBe(500);
    expect(minimumIncrement(10_000)).toBe(1_000);
    expect(minimumIncrement(49_999)).toBe(1_000);
    expect(minimumIncrement(120_000)).toBe(2_000);
    expect(minimumIncrement(900_000)).toBe(5_000);
    expect(minimumIncrement(5_000_000)).toBe(10_000);
  });

  it("permite abrir al precio inicial y exige el paso en las siguientes", () => {
    expect(minimumNextBid(10_000, false)).toBe(10_000);
    expect(minimumNextBid(10_000, true)).toBe(11_000);
  });

  it("calcula la garantía como el 10%, nunca cero", () => {
    expect(holdForBid(90_000)).toBe(9_000);
    expect(holdForBid(10_001)).toBe(1_000);
    expect(holdForBid(5)).toBe(1);
  });
});

describe("mensajes de error", () => {
  it("muestra qué campo está mal, no sólo el titular", () => {
    const texto = describeApiError({
      message: "Hay datos inválidos.",
      details: [{ path: "title", message: "Debe tener al menos 3 caracteres." }],
    });
    expect(texto).toContain("Título");
    expect(texto).toContain("al menos 3 caracteres");
  });

  it("junta varios campos en un solo mensaje", () => {
    const texto = describeApiError({
      message: "Hay datos inválidos.",
      details: [
        { path: "amount", message: "Sin decimales." },
        { path: "email", message: "Correo inválido." },
      ],
    });
    expect(texto).toContain("Monto");
    expect(texto).toContain("Correo");
  });

  it("cae en el titular cuando el detalle no es una lista de campos", () => {
    // Los conflictos de negocio mandan `details` como objeto, no como lista.
    expect(
      describeApiError({ message: "La puja debe ser mayor.", details: { currentPrice: 1000 } }),
    ).toBe("La puja debe ser mayor.");
    expect(describeApiError({})).toBe("No pudimos completar la solicitud.");
  });
});
