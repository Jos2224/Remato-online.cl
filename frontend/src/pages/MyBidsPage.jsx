import { Link } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Countdown } from "../components/Countdown";
import { DashboardNav } from "../components/DashboardNav";
import { EmptyState, ErrorState, PageLoader } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { urgencyInterval, usePollingQuery } from "../hooks/usePollingQuery";
import { formatMoney } from "../utils/format";

export function MyBidsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = usePollingQuery(
    () => auctionsApi.list({ participating: true, limit: 100 }),
    { interval: (current) => urgencyInterval((current ?? []).map((item) => item?.endsAt), 10_000) },
  );
  const participating = (data || []).map((auction) => {
    const myBid = auction.myBid || auction.bids.find((bid) => bid.active !== false && (bid.isMine || (user?.id && bid.userId === user.id)));
    return { auction, myBid };
  }).filter(({ myBid }) => Boolean(myBid));

  if (loading) return <PageLoader label="Buscando tus pujas" />;
  if (error && !data) return <div className="container page-space"><ErrorState title="No pudimos cargar tus pujas" error={error} onRetry={reload} /></div>;

  return (
    <div className="dashboard page-space">
      <div className="container">
        <header className="dashboard__header">
          <div><span className="eyebrow">Actividad</span><h1>Mis pujas</h1><p>Ofertas activas y dinero que tienes comprometido.</p></div>
        </header>
        <DashboardNav />

        {participating.length ? (
          <div className="bid-list">
            {participating.map(({ auction, myBid }) => {
              const leading = Number(myBid.amount) === Number(auction.currentPrice);
              return (
                <article className="bid-list__item" key={auction.id}>
                  <div className="bid-list__status"><StatusBadge status={auction.status} />{auction.status === "active" && <Countdown until={auction.endsAt} compact />}</div>
                  <div className="bid-list__main">
                    <span className="eyebrow">Subasta #{auction.id}</span>
                    <h2><Link to={`/subastas/${auction.id}`}>{auction.title}</Link></h2>
                    <p>{leading ? "Tu oferta va primera." : "Otra persona tiene una oferta superior."}</p>
                  </div>
                  <div className="bid-list__money"><span>Tu puja</span><strong>{formatMoney(myBid.amount)}</strong></div>
                  <div className="bid-list__money"><span>Puja actual</span><strong>{formatMoney(auction.currentPrice)}</strong></div>
                  <Link className="button button--ghost" to={`/subastas/${auction.id}`}>{auction.status === "active" ? "Ver o mejorar" : "Ver resultado"}</Link>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState eyebrow="Sin fondos congelados" title="No tienes pujas activas" description="Explora las subastas y haz una oferta cuando encuentres algo interesante." action={<Link className="button button--dark" to="/">Explorar subastas</Link>} />
        )}
      </div>
    </div>
  );
}
