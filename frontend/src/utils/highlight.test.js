import { describe, expect, it } from "vitest";
import { findFolded } from "./highlight";

// Ayuda a leer los casos: devuelve el trozo que se resaltaría.
//
// Se compara en NFC porque cortar un texto descompuesto devuelve un trozo descompuesto:
// "montaña" con la tilde aparte y "montaña" con la ñ entera se pintan igual en pantalla y
// son la misma palabra, pero no son la misma cadena. Lo que se afirma aquí es lo que se
// ve, no en qué forma vino guardado.
const marcado = (text, term) => {
  const match = findFolded(text, term);
  return match ? text.slice(match.start, match.end).normalize("NFC") : null;
};

describe("findFolded", () => {
  it("encuentra ignorando tildes y mayúsculas", () => {
    expect(marcado("Camión de juguete", "camion")).toBe("Camión");
    expect(marcado("Camión de juguete", "CAMIÓN")).toBe("Camión");
    expect(marcado("guitarra eléctrica", "ELECTRICA")).toBe("eléctrica");
  });

  // El fallo original: sobre un título en forma descompuesta el corte salía movido una
  // letra por cada acento anterior, y "Sillón reclinable" resaltaba " reclinabl".
  it("no se desplaza cuando el texto viene descompuesto", () => {
    const descompuesto = "Sillón reclinable de cuero".normalize("NFD");
    expect(marcado(descompuesto, "reclinable")).toBe("reclinable");

    const dosAcentos = "Ñuñoa: sillón económico".normalize("NFD");
    expect(marcado(dosAcentos, "economico")).toBe("económico");
  });

  it("da el mismo resultado esté como esté normalizado el título", () => {
    const texto = "Bicicleta de montaña aro 29";
    expect(marcado(texto.normalize("NFC"), "montana")).toBe("montaña");
    expect(marcado(texto.normalize("NFD"), "montana")).toBe("montaña");
  });

  it("resalta también cuando la coincidencia empieza en la primera letra", () => {
    expect(marcado("Ñuñoa", "nun")).toBe("Ñuñ");
  });

  it("devuelve null cuando no hay coincidencia o falta algún lado", () => {
    expect(findFolded("Notebook", "guitarra")).toBeNull();
    expect(findFolded("Notebook", "")).toBeNull();
    expect(findFolded("", "note")).toBeNull();
    expect(findFolded("Notebook", "   ")).toBeNull();
  });
});
