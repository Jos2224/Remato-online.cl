import { Link } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuctionCard } from "../components/AuctionCard";
import { DashboardNav } from "../components/DashboardNav";
import { EmptyState, ErrorState, PageLoader } from "../components/States";
import { usePollingQuery } from "../hooks/usePollingQuery";

export function MyAuctionsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = usePollingQuery(
    () => auctionsApi.list({ mine: true, limit: 100 }),
    { interval: 12_000 },
  );
  const mine = (data || []).filter(
    (auction) => auction.canEdit || auction.capabilities?.canEdit || auction.sellerId === user?.id || auction.seller.email?.toLowerCase() === user?.email?.toLowerCase(),
  );
  const active = mine.filter((auction) => auction.status === "active");
  const ended = mine.filter((auction) => auction.status !== "active");

  if (loading) return <PageLoader label="Buscando tus subastas" />;
  if (error && !data) return <div className="container page-space"><ErrorState title="No pudimos cargar tus subastas" error={error} onRetry={reload} /></div>;

  return (
    <div className="dashboard page-space">
      <div className="container">
        <header className="dashboard__header">
          <div><span className="eyebrow">Actividad</span><h1>Mis subastas</h1><p>Administra tus publicaciones y revisa cómo terminaron.</p></div>
          <Link className="button button--red" to="/publicar">Nueva subasta</Link>
        </header>
        <DashboardNav />

        <section className="dashboard-section">
          <div className="section-heading section-heading--compact"><div><h2>Activas</h2><p>{active.length} publicaciones recibiendo ofertas</p></div></div>
          {active.length ? <div className="auction-grid">{active.map((auction) => <AuctionCard auction={auction} key={auction.id} />)}</div> : (
            <EmptyState title="No tienes subastas activas" description="Publica un producto para empezar." action={<Link className="button button--dark" to="/publicar">Publicar</Link>} />
          )}
        </section>

        {ended.length > 0 && (
          <section className="dashboard-section dashboard-section--muted">
            <div className="section-heading section-heading--compact"><div><h2>Cerradas</h2><p>Vendidas, en posta o sin match</p></div></div>
            <div className="auction-grid">{ended.map((auction) => <AuctionCard auction={auction} muted key={auction.id} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
