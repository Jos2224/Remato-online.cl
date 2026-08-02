import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuctionCard } from "../components/AuctionCard";
import { EmptyState, ErrorState, PageLoader } from "../components/States";
import { urgencyInterval, usePollingQuery } from "../hooks/usePollingQuery";

const SORTS = {
  closing: { label: "Cierre más próximo", compare: (a, b) => new Date(a.endsAt) - new Date(b.endsAt) },
  priceAsc: { label: "Precio: menor a mayor", compare: (a, b) => a.currentPrice - b.currentPrice },
  priceDesc: { label: "Precio: mayor a menor", compare: (a, b) => b.currentPrice - a.currentPrice },
  bids: { label: "Más pujas", compare: (a, b) => b.bidCount - a.bidCount },
};

export function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const canTrade = !isAuthenticated || user?.role === "user";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [sort, setSort] = useState("closing");
  const { data: page, loading, error, reload } = usePollingQuery(
    () => auctionsApi.listPaged({ limit: 100 }),
    // Speeds up to 2s in the final minute of the auction closing soonest.
    { interval: (current) => urgencyInterval((current?.items ?? []).map((item) => item.endsAt)) },
  );
  const auctions = page?.items;
  const total = page?.total ?? 0;

  const categories = useMemo(
    () => ["Todas", ...new Set((auctions || []).map((auction) => auction.category).filter(Boolean))],
    [auctions],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    return (auctions || []).filter((auction) => {
      const matchesCategory = category === "Todas" || auction.category === category;
      const haystack = `${auction.title} ${auction.description} ${auction.seller.displayName} ${auction.commune}`.toLocaleLowerCase("es");
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [auctions, category, query]);

  const active = visible
    .filter((auction) => auction.status === "active")
    .sort(SORTS[sort]?.compare ?? SORTS.closing.compare);
  const ended = visible
    .filter((auction) => auction.status !== "active")
    .sort((a, b) => new Date(b.endsAt) - new Date(a.endsAt));

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <span className="eyebrow eyebrow--light">Subastas en línea · Chile</span>
            <h1>Lo publicas.<br />Ellos deciden<br /><em>cuánto vale.</em></h1>
            <p>Subastas simples entre personas, con pujas públicas y fondos comprometidos de verdad.</p>
            <div className="hero__actions">
              <a className="button button--light button--large" href="#activas">Ver subastas</a>
              {canTrade && (
                <Link className="button button--outline-light button--large" to={isAuthenticated ? "/publicar" : "/registro"}>
                  Publicar un producto
                </Link>
              )}
            </div>
          </div>
          <aside className="hero__rules" aria-label="Reglas principales">
            <p className="hero__number">01</p>
            <h2>Directo y transparente.</h2>
            <ul>
              <li><span>Incremento mínimo por tramo</span><strong>Pujas que suman de verdad</strong></li>
              <li><span>Cierre exacto con prórroga</span><strong>Reloj de Chile</strong></li>
              <li><span>Historial público</span><strong>Cada puja activa queda visible</strong></li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="market container" id="activas">
        <div className="market__toolbar">
          <div>
            <span className="eyebrow">Mercado abierto</span>
            <h2>Subastas activas</h2>
            <p>
              Productos que todavía aceptan ofertas.
              {total > 0 && ` ${active.length} de ${total} publicaciones.`}
            </p>
          </div>
          <div className="filters" role="search">
            <label className="search-field">
              <span className="sr-only">Buscar subastas</span>
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto o vendedor" />
            </label>
            <label>
              <span className="sr-only">Filtrar por categoría</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Ordenar subastas</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                {Object.entries(SORTS).map(([key, option]) => (
                  <option value={key} key={key}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <PageLoader label="Buscando subastas" />
        ) : error && !auctions ? (
          <ErrorState title="No pudimos cargar las subastas" error={error} onRetry={reload} />
        ) : active.length ? (
          <div className="auction-grid">
            {active.map((auction) => <AuctionCard auction={auction} key={auction.id} />)}
          </div>
        ) : (
          <EmptyState
            eyebrow={query || category !== "Todas" ? "Sin coincidencias" : "Mercado tranquilo"}
            title={query || category !== "Todas" ? "No encontramos subastas con esos filtros" : "Todavía no hay subastas activas"}
            description={query || category !== "Todas" ? "Prueba con otra búsqueda o categoría." : "Sé la primera persona en publicar un producto."}
            action={canTrade ? <Link className="button button--dark" to={isAuthenticated ? "/publicar" : "/registro"}>Publicar una subasta</Link> : null}
          />
        )}
      </section>

      <section className="archive">
        <div className="container">
          <div className="section-heading section-heading--archive">
            <div>
              <span className="eyebrow">Archivo público</span>
              <h2>Subastas vencidas</h2>
            </div>
            <p>Resultados cerrados: vendidas, en proceso de match o terminadas sin comprador.</p>
          </div>
          {ended.length ? (
            <div className="auction-grid auction-grid--archive">
              {ended.map((auction) => <AuctionCard auction={auction} muted key={auction.id} />)}
            </div>
          ) : (
            <EmptyState title="Aún no hay subastas vencidas" description="Cuando finalicen, sus resultados aparecerán aquí." />
          )}
        </div>
      </section>

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
