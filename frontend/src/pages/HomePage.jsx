import { useCallback, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuctionCard } from "../components/AuctionCard";
import { BrowseFilters } from "../components/BrowseFilters";
import { SearchBar } from "../components/SearchBar";
import { EmptyState, ErrorState, PageLoader } from "../components/States";
import { urgencyInterval, usePollingQuery } from "../hooks/usePollingQuery";
import { AUCTION_STATES, CATEGORIES, CONDITIONS, SHIPPING } from "../utils/taxonomy";

const PER_PAGE = 24;

// Lo que ve quien llega sin pedir nada: sólo lo que todavía acepta ofertas. Las vendidas y
// las terminadas siguen ahí, pero se piden marcando su casilla. Es una portada de lo que
// se puede comprar ahora, no un archivo histórico.
const DEFAULT_STATUS = ["ACTIVE"];

const SORTS = [
  { value: "closing", label: "Cierre más próximo" },
  { value: "newest", label: "Publicadas hace poco" },
  { value: "priceAsc", label: "Precio: menor a mayor" },
  { value: "priceDesc", label: "Precio: mayor a menor" },
  { value: "bids", label: "Más pujas" },
];

// Facetas que admiten varias marcas a la vez.
const MULTI = ["status", "category", "condition", "shippingMethod"];

const LABELS = {
  status: Object.fromEntries(AUCTION_STATES.map(({ value, label }) => [value, label])),
  category: Object.fromEntries(CATEGORIES.map((value) => [value, value])),
  condition: Object.fromEntries(CONDITIONS.map((value) => [value, value])),
  shippingMethod: Object.fromEntries(SHIPPING.map(({ value, label }) => [value, label])),
};

const readList = (params, key, fallback = []) => {
  const raw = params.get(key);
  if (raw == null) return fallback;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
};

const readNumber = (params, key) => {
  const raw = params.get(key);
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
};

export function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const canTrade = !isAuthenticated || user?.role === "user";
  const [params, setParams] = useSearchParams();

  // Todo el estado del buscador vive en la URL. Así el botón "atrás" funciona, se puede
  // recargar sin perder los filtros, y un resultado se comparte pegando el enlace.
  const filters = useMemo(
    () => ({
      q: params.get("q") ?? "",
      status: readList(params, "status", DEFAULT_STATUS),
      category: readList(params, "category"),
      condition: readList(params, "condition"),
      shippingMethod: readList(params, "shippingMethod"),
      priceMin: readNumber(params, "priceMin"),
      priceMax: readNumber(params, "priceMax"),
      sort: params.get("sort") ?? "",
      page: Math.max(1, Number(params.get("page")) || 1),
      view: params.get("view") === "list" ? "list" : "grid",
    }),
    [params],
  );

  const update = useCallback(
    (patch, { keepPage = false } = {}) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
        if (empty) next.delete(key);
        else next.set(key, Array.isArray(value) ? value.join(",") : String(value));
      }
      // Cambiar un filtro estando en la página 4 dejaba una lista vacía sin explicación:
      // cualquier cambio que no sea de paginación vuelve al principio.
      if (!keepPage) next.delete("page");
      // Volver a enviar la misma búsqueda no cambia nada, pero sí apilaba una entrada más
      // en el historial: había que pulsar "atrás" tantas veces como veces se hubiera
      // pulsado Enter para salir de la página.
      if (next.toString() === params.toString()) return;
      setParams(next);
    },
    [params, setParams],
  );

  const toggle = useCallback(
    (key, value) => {
      const current = filters[key];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      // Desmarcar el último estado no significa "no quiero ver nada": vuelve al defecto.
      if (key === "status" && next.length === 0) update({ status: null });
      else update({ [key]: next });
    },
    [filters, update],
  );

  const offset = (filters.page - 1) * PER_PAGE;
  // Sin orden elegido y con texto buscado, el servidor ya ordena por relevancia.
  const sort = filters.sort || undefined;
  const requestKey = params.toString();

  const { data, loading, error, reload } = usePollingQuery(
    () =>
      auctionsApi.listPaged({
        q: filters.q || undefined,
        status: filters.status,
        category: filters.category,
        condition: filters.condition,
        shippingMethod: filters.shippingMethod,
        priceMin: filters.priceMin ?? undefined,
        priceMax: filters.priceMax ?? undefined,
        sort,
        limit: PER_PAGE,
        offset,
      }),
    {
      interval: (current) => urgencyInterval((current?.items ?? []).map((item) => item.endsAt)),
      deps: [requestKey],
    },
  );

  const auctions = data?.items ?? [];
  const total = data?.total ?? 0;
  const facets = data?.facets ?? { status: {}, category: {}, condition: {}, shipping: {} };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const firstShown = total === 0 ? 0 : offset + 1;
  const lastShown = Math.min(offset + auctions.length, total);

  // Una página que se quedó sin resultados —un enlace compartido con `page=9`, o subastas
  // que cerraron mientras se miraba— se corrige sola. Sin esto la lista queda vacía y
  // parece que no hay nada publicado, cuando lo que sobra es el número de página.
  useEffect(() => {
    if (data && total > 0 && filters.page > pages) {
      update({ page: pages > 1 ? pages : null }, { keepPage: true });
    }
  }, [data, total, pages, filters.page, update]);

  // Las marcas puestas a mano, para poder contarlas y quitarlas de una en una. El estado
  // por defecto no cuenta: nadie lo eligió.
  const chips = useMemo(() => {
    const list = [];
    for (const key of MULTI) {
      const isDefaultStatus =
        key === "status" &&
        filters.status.length === DEFAULT_STATUS.length &&
        filters.status.every((value) => DEFAULT_STATUS.includes(value));
      if (isDefaultStatus) continue;
      for (const value of filters[key]) {
        list.push({ key, value, label: LABELS[key][value] ?? value });
      }
    }
    if (filters.priceMin != null || filters.priceMax != null) {
      list.push({ key: "price", value: "price", label: "Precio acotado" });
    }
    return list;
  }, [filters]);

  const removeChip = (chip) => {
    if (chip.key === "price") update({ priceMin: null, priceMax: null });
    else toggle(chip.key, chip.value);
  };

  const EMPTY_FILTERS = {
    status: null,
    category: null,
    condition: null,
    shippingMethod: null,
    priceMin: null,
    priceMax: null,
  };

  const clearAll = () => update(EMPTY_FILTERS);
  // El botón de la pantalla vacía borra también el texto buscado. Cuando lo único puesto
  // era la búsqueda, "Limpiar los filtros" no quitaba nada y la pantalla se quedaba igual:
  // un botón que no hace nada es peor que no tener botón.
  const resetAll = () => update({ ...EMPTY_FILTERS, q: null });

  const hasQuery = Boolean(filters.q);
  const isFiltered = chips.length > 0 || hasQuery;

  return (
    <>
      {/* Banda de entrada, no portada de revista: el buscador es lo primero y la lista
          empieza inmediatamente debajo. */}
      <section className="browse-hero">
        <div className="container browse-hero__inner">
          <div className="browse-hero__lead">
            <span className="eyebrow eyebrow--light">Subastas en línea · Chile</span>
            <h1>Lo publicas. <em>Ellos deciden cuánto vale.</em></h1>
          </div>
          <SearchBar
            value={filters.q}
            onSearch={(term) => update({ q: term || null })}
            onPickCategory={(category) => update({ q: null, category: [category] })}
          />
          <div className="browse-hero__shortcuts">
            <ul className="browse-hero__categories">
              {CATEGORIES.map((category) => (
                <li key={category}>
                  <button
                    type="button"
                    className={`chip${filters.category.includes(category) ? " chip--on" : ""}`}
                    onClick={() => toggle("category", category)}
                  >
                    {category}
                  </button>
                </li>
              ))}
            </ul>
            {canTrade && (
              <Link className="button button--light button--small" to={isAuthenticated ? "/publicar" : "/registro"}>
                Publicar un producto
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="container browse" id="activas">
        <BrowseFilters
          facets={facets}
          filters={filters}
          onToggle={toggle}
          onPrice={(priceMin, priceMax) => update({ priceMin, priceMax })}
          onClear={clearAll}
          activeCount={chips.length}
        />

        <section className="browse__results" aria-live="polite">
          <div className="results-bar">
            <p className="results-bar__count">
              {total === 0 ? (
                "Sin resultados"
              ) : (
                <>
                  <strong>{firstShown}–{lastShown}</strong> de <strong>{total}</strong>{" "}
                  {total === 1 ? "subasta" : "subastas"}
                  {hasQuery && <> para “{filters.q}”</>}
                </>
              )}
            </p>
            <div className="results-bar__tools">
              <label className="results-bar__sort">
                <span className="sr-only">Ordenar resultados</span>
                <select value={filters.sort} onChange={(event) => update({ sort: event.target.value || null })}>
                  <option value="">{hasQuery ? "Más relevantes" : "Orden por defecto"}</option>
                  {SORTS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div className="view-toggle" role="group" aria-label="Forma de ver los resultados">
                {[
                  { value: "grid", label: "Cuadrícula", glyph: "▦" },
                  { value: "list", label: "Lista", glyph: "☰" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={filters.view === option.value ? "is-on" : ""}
                    aria-pressed={filters.view === option.value}
                    title={option.label}
                    onClick={() => update({ view: option.value === "grid" ? null : option.value }, { keepPage: true })}
                  >
                    <span aria-hidden="true">{option.glyph}</span>
                    <span className="sr-only">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="applied-filters">
              {chips.map((chip) => (
                <li key={`${chip.key}-${chip.value}`}>
                  <button type="button" className="chip chip--removable" onClick={() => removeChip(chip)}>
                    {chip.label}
                    <span aria-hidden="true">×</span>
                    <span className="sr-only">Quitar filtro</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="applied-filters__clear" onClick={clearAll}>
                  Limpiar todo
                </button>
              </li>
            </ul>
          )}

          {loading && !data ? (
            <PageLoader label="Buscando subastas" />
          ) : error && !data ? (
            <ErrorState title="No pudimos cargar las subastas" error={error} onRetry={reload} />
          ) : auctions.length ? (
            <>
              <div className={`auction-grid${filters.view === "list" ? " auction-grid--list" : ""}`}>
                {auctions.map((auction) => (
                  <AuctionCard auction={auction} muted={auction.status !== "active"} key={auction.id} />
                ))}
              </div>

              {pages > 1 && (
                <nav className="pager" aria-label="Paginación de resultados">
                  <button
                    type="button"
                    disabled={filters.page <= 1}
                    onClick={() => update({ page: filters.page - 1 }, { keepPage: true })}
                  >
                    ← Anterior
                  </button>
                  <span className="pager__position">
                    Página {filters.page} de {pages}
                  </span>
                  <button
                    type="button"
                    disabled={filters.page >= pages}
                    onClick={() => update({ page: filters.page + 1 }, { keepPage: true })}
                  >
                    Siguiente →
                  </button>
                </nav>
              )}
            </>
          ) : (
            <EmptyState
              eyebrow={isFiltered ? "Sin coincidencias" : "Mercado tranquilo"}
              title={isFiltered ? "No encontramos subastas con esos filtros" : "Todavía no hay subastas activas"}
              description={
                isFiltered
                  ? "Prueba con otras palabras, o quita algún filtro. Lo ya cerrado se ve marcando “Vendidas” o “Terminadas sin comprador”."
                  : "Sé la primera persona en publicar un producto."
              }
              action={
                isFiltered ? (
                  <button type="button" className="button button--dark" onClick={resetAll}>
                    Limpiar la búsqueda
                  </button>
                ) : canTrade ? (
                  <Link className="button button--dark" to={isAuthenticated ? "/publicar" : "/registro"}>
                    Publicar una subasta
                  </Link>
                ) : null
              }
            />
          )}
        </section>
      </div>

      <section className="how-it-works container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Cómo funciona</span>
            <h2>Tres momentos. Una regla clara.</h2>
          </div>
        </div>
        <div className="steps">
          <article><span>01</span><h3>Publica</h3><p>Describe el producto, define precio inicial y un cierre exacto.</p></article>
          <article><span>02</span><h3>Puja</h3><p>Ofrece directamente. El monto queda congelado hasta retirar la puja o resolver la subasta.</p></article>
          <article><span>03</span><h3>Confirma</h3><p>Al cerrar comienza la posta. El mejor postor tiene una hora para aceptar o rechazar.</p></article>
        </div>
      </section>
    </>
  );
}
