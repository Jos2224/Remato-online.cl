import { describe, expect, it } from "vitest";
import { createRunGuard, urgencyInterval } from "./usePollingQuery";

// `createRunGuard` existe por un fallo concreto de la portada: al cambiar de filtro, la
// bandera `mounted` se apagaba en la limpieza del efecto y el efecto siguiente la volvía
// a encender antes de que llegara la respuesta anterior. Esa respuesta vieja se
// encontraba la bandera en verde y pisaba los resultados nuevos. Escribiendo en el
// buscador pasaba en cada palabra.

describe("createRunGuard", () => {
  it("sólo reconoce como vigente a la última petición pedida", () => {
    const begin = createRunGuard();
    const primera = begin();
    const segunda = begin();

    expect(primera()).toBe(false);
    expect(segunda()).toBe(true);
  });

  it("una respuesta lenta y vieja no pisa a una nueva", async () => {
    const begin = createRunGuard();
    const aplicados = [];

    const pedir = async (resultado, demora) => {
      const esMia = begin();
      await new Promise((resolve) => setTimeout(resolve, demora));
      if (esMia()) aplicados.push(resultado);
    };

    // "guitarra" se pide primero y tarda 40 ms; "camión" se pide después y tarda 5 ms.
    // Sin el guardián, "guitarra" llegaría última y quedaría en pantalla.
    await Promise.all([pedir("guitarra", 40), pedir("camión", 5)]);

    expect(aplicados).toEqual(["camión"]);
  });

  it("cada uso del hook lleva su propio contador", () => {
    const unaLista = createRunGuard();
    const otraLista = createRunGuard();
    const deLaPrimera = unaLista();
    otraLista();

    // Una petición de otra pantalla no puede invalidar la de ésta.
    expect(deLaPrimera()).toBe(true);
  });
});

describe("urgencyInterval", () => {
  const enSegundos = (s) => new Date(Date.now() + s * 1000).toISOString();

  it("acelera cerca del cierre y se relaja cuando falta mucho", () => {
    expect(urgencyInterval([enSegundos(30)])).toBe(2_000);
    expect(urgencyInterval([enSegundos(200)])).toBe(5_000);
    expect(urgencyInterval([enSegundos(3600)])).toBe(12_000);
  });

  it("ignora cierres ya pasados y listas vacías", () => {
    expect(urgencyInterval([enSegundos(-10)])).toBe(12_000);
    expect(urgencyInterval([])).toBe(12_000);
    expect(urgencyInterval([null])).toBe(12_000);
  });

  it("manda el cierre más próximo de toda la página", () => {
    expect(urgencyInterval([enSegundos(3600), enSegundos(20), enSegundos(900)])).toBe(2_000);
  });
});
