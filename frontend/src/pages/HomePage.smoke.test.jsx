import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { HomePage } from "./HomePage";

// Comprobación de humo sin navegador: renderiza la portada de verdad en el servidor. No
// sustituye a mirarla, pero atrapa lo que la compilación no ve —un `filters.category`
// indefinido, una faceta sin recuento, un `map` sobre algo que no es lista— que si no
// aparecería como pantalla en blanco en producción.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const render = (url) =>
  renderToString(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  store.clear();
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

describe("portada", () => {
  it("se renderiza sin filtros en la URL", () => {
    const html = render("/");
    expect(html).toContain("Filtrar");
    expect(html).toContain("Aceptando ofertas");
  });

  it("acepta facetas, búsqueda, orden y página desde la URL", () => {
    const html = render(
      "/?q=guitarra&status=SOLD,NO_MATCH&category=Coleccionables&condition=Usado" +
        "&shippingMethod=CHILEXPRESS&priceMin=1000&priceMax=90000&sort=priceDesc&page=3&view=list",
    );
    // Las marcas puestas a mano se muestran como fichas quitables.
    expect(html).toContain("Vendidas");
    expect(html).toContain("Precio acotado");
    expect(html).toContain("Limpiar todo");
  });

  it("no muestra fichas cuando sólo está el estado por defecto", () => {
    expect(render("/?status=ACTIVE")).not.toContain("Limpiar todo");
  });

  it("tolera una página o un precio con basura en la URL", () => {
    const html = render("/?page=-4&priceMin=abc&status=");
    expect(html).toContain("Filtrar");
  });

  it("pide a la API exactamente las facetas marcadas", async () => {
    const calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        calls.push(String(url));
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: { get: () => "application/json" },
          json: () =>
            Promise.resolve({
              data: {
                auctions: [],
                facets: { status: { ACTIVE: 0 }, category: {}, condition: {}, shipping: {} },
                pagination: { limit: 24, offset: 48, total: 0 },
              },
            }),
        });
      }),
    );

    const { auctionsApi } = await import("../api/client");
    await auctionsApi.listPaged({
      status: ["SOLD", "NO_MATCH"],
      category: [],
      q: "camión",
      priceMin: 1000,
      limit: 24,
      offset: 48,
    });

    const [url] = calls;
    // Las listas viajan separadas por comas y una faceta vacía no viaja en absoluto:
    // mandar `category=` hacía que la API rechazara la consulta entera.
    expect(url).toContain("status=SOLD%2CNO_MATCH");
    expect(url).not.toContain("category=");
    expect(url).toContain("q=cami%C3%B3n");
    expect(url).toContain("priceMin=1000");
    expect(url).toContain("offset=48");
  });
});
