import { useState } from "react";
import { Link } from "react-router-dom";
import { matchesApi } from "../api/client";
import { Countdown } from "../components/Countdown";
import { DashboardNav } from "../components/DashboardNav";
import { EmptyState, ErrorState, InlineNotice, PageLoader, Spinner } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { usePollingQuery } from "../hooks/usePollingQuery";
import { formatChileDateLong, formatMoney, holdForBid } from "../utils/format";

export function MatchesPage() {
  const { showToast } = useToast();
  const { data: matches, loading, error, reload } = usePollingQuery(() => matchesApi.mine(), { interval: 10_000 });
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const pending = (matches || []).filter((match) => match.actionRequired);
  const history = (matches || []).filter((match) => !pending.includes(match));

  if (loading) return <PageLoader label="Revisando la posta" />;
  if (error && !matches) return <div className="container page-space"><ErrorState title="No pudimos consultar la posta" error={error} onRetry={reload} /></div>;

  const act = async (match, action) => {
    if (action === "reject" && !window.confirm(`Rechazar hace que pierdas tu garantía de ${formatMoney(holdForBid(match.amount))} (el 10% de tu oferta). ¿Continuar?`)) return;
    setBusyId(match.id);
    setActionError("");
    try {
      if (action === "accept") await matchesApi.accept(match.id);
      else await matchesApi.reject(match.id);
      await reload();
      showToast(
        action === "accept"
          ? "Trato aceptado. La venta y las transferencias quedaron registradas."
          : "Oferta rechazada. Perdiste la garantía y la posta continúa con el siguiente postor.",
        action === "accept" ? "success" : "warning",
      );
    } catch (nextError) {
      setActionError(nextError.message);
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="dashboard page-space">
      <div className="container">
        <header className="dashboard__header">
          <div><span className="eyebrow">Adjudicación</span><h1>Posta pendiente</h1><p>Cuando sea tu turno tienes una hora exacta para aceptar o rechazar.</p></div>
        </header>
        <DashboardNav />

        <div className="rule-banner">
          <div><span>Si aceptas</span><strong>El match se concreta</strong><p>95% se transfiere al vendedor y 5% a la plataforma. Los demás recuperan íntegro su dinero.</p></div>
          <div><span>Si rechazas o vence tu hora</span><strong>Pierdes la garantía</strong><p>La garantía del 10% se reparte: 70% para el vendedor y 30% para costos de la plataforma. La oportunidad pasa al siguiente postor.</p></div>
        </div>

        {actionError && <InlineNotice type="error">{actionError}</InlineNotice>}

        <section className="dashboard-section">
          <div className="section-heading section-heading--compact"><div><h2>Requieren tu respuesta</h2><p>{pending.length} turnos activos</p></div></div>
          {pending.length ? (
            <div className="match-list">
              {pending.map((match) => (
                <article className="match-card" key={match.id}>
                  <div className="match-card__timer">
                    <span>Tu turno termina en</span>
                    <Countdown until={match.expiresAt} endedLabel="Turno vencido" onEnd={() => reload({ quiet: true })} />
                    <small>{formatChileDateLong(match.expiresAt)}</small>
                  </div>
                  <div className="match-card__body">
                    <span className="eyebrow">Posición #{match.position} · Subasta #{match.auctionId}</span>
                    <h2><Link to={`/subastas/${match.auctionId}`}>{match.auction.title}</Link></h2>
                    <p>Tu oferta comprometida</p>
                    <strong className="match-card__amount">{formatMoney(match.amount)}</strong>
                  </div>
                  <div className="match-card__breakdown">
                    <div><span>Vendedor (95%)</span><strong>{formatMoney(match.amount * 0.95)}</strong></div>
                    <div><span>Comisión (5%)</span><strong>{formatMoney(match.amount * 0.05)}</strong></div>
                    <div className="match-card__penalty"><span>Costo si rechazas</span><strong>{formatMoney(match.amount * 0.1)}</strong></div>
                  </div>
                  <div className="match-card__actions">
                    <button className="button button--green button--large" type="button" disabled={Boolean(busyId)} onClick={() => act(match, "accept")}>
                      {busyId === match.id && <Spinner small />} Aceptar y pagar
                    </button>
                    <button className="button button--danger-ghost" type="button" disabled={Boolean(busyId)} onClick={() => act(match, "reject")}>Rechazar oferta</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState eyebrow="Todo al día" title="No tienes un turno pendiente" description="Si una subasta te corresponde, aparecerá aquí durante una hora." />
          )}
        </section>

        {history.length > 0 && (
          <section className="dashboard-section dashboard-section--muted">
            <div className="section-heading section-heading--compact"><div><h2>Historial de posta</h2></div></div>
            <div className="compact-list">
              {history.map((match) => (
                <Link to={`/subastas/${match.auctionId}`} key={match.id}>
                  <div><StatusBadge status={match.status} /><strong>{match.auction.title}</strong></div>
                  <span>{formatMoney(match.amount)} →</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
