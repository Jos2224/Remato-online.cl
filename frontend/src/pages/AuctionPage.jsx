import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Countdown } from "../components/Countdown";
import { StatusBadge } from "../components/StatusBadge";
import { ErrorState, InlineNotice, PageLoader, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { urgencyInterval, usePollingQuery } from "../hooks/usePollingQuery";
import { formatChileDate, formatChileDateLong, formatMoney, numberFromInput } from "../utils/format";

export function AuctionPage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { data: auction, setData: setAuction, loading, error, reload } = usePollingQuery(() => auctionsApi.get(id), {
    // 2s inside the final minute so the closing price is actually visible moving.
    interval: (current) => urgencyInterval(current?.endsAt, 10_000),
    deps: [id],
  });
  const [amount, setAmount] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auction?.currentPrice) setAmount(String(auction.currentPrice + 1));
  }, [auction?.currentPrice]);

  const activeBids = useMemo(
    () => (auction?.bids || []).filter((bid) => bid.active !== false).sort((a, b) => b.amount - a.amount || new Date(b.createdAt) - new Date(a.createdAt)),
    [auction?.bids],
  );

  if (loading) return <PageLoader label="Abriendo la subasta" />;
  if (error && !auction) return <div className="container page-space"><ErrorState title="No encontramos esta subasta" error={error} onRetry={reload} /></div>;
  if (!auction) return null;

  const isOwner = Boolean(
    user && auction.sellerId === user.id,
  );
  const canEdit = auction.canEdit ?? auction.capabilities?.canEdit ?? isOwner;
  const isActive = auction.status === "active";
  const myBid = auction.myBid || activeBids.find((bid) => bid.isMine || (user?.id && bid.userId === user.id));
  const canBid =
    isActive &&
    !isOwner &&
    (!isAuthenticated || (auction.canBid ?? auction.capabilities?.canBid ?? user?.role === "user"));

  const placeBid = async (event) => {
    event.preventDefault();
    setActionError("");
    const numericAmount = numberFromInput(amount);
    if (numericAmount <= auction.currentPrice) {
      setActionError(`Tu oferta debe superar la puja actual de ${formatMoney(auction.currentPrice)}.`);
      return;
    }
    setSubmitting(true);
    try {
      const updated = await auctionsApi.bid(auction.id, numericAmount);
      setAuction(updated);
      showToast(`Puja de ${formatMoney(numericAmount)} registrada. Ese monto quedó congelado.`);
    } catch (nextError) {
      setActionError(nextError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawBid = async () => {
    if (!window.confirm("¿Retirar tu puja? Dejará de competir y el dinero congelado volverá a tu saldo disponible.")) return;
    setSubmitting(true);
    setActionError("");
    try {
      await auctionsApi.withdrawBid(auction.id);
      await reload();
      showToast("Puja retirada. El saldo fue liberado.");
    } catch (nextError) {
      setActionError(nextError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auction-detail page-space">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Migas de pan">
          <Link to="/">Subastas</Link><span>/</span><span>{auction.category}</span><span>/</span><span>#{auction.id}</span>
        </nav>

        <div className="auction-detail__heading">
          <div>
            <div className="auction-detail__badges">
              <StatusBadge status={auction.status} />
              <span className="plain-badge">{auction.category}</span>
              <span className="plain-badge">{auction.condition}</span>
            </div>
            <h1>{auction.title}</h1>
            <p className="auction-detail__seller">
              Publicada por <strong>{auction.seller.displayName}</strong>
              {auction.seller.createdAt && <> · cuenta desde {formatChileDate(auction.seller.createdAt, { hour: undefined, minute: undefined })}</>}
              <> · {auction.seller.salesCount} ventas</>
            </p>
          </div>
          {canEdit && <Link className="button button--ghost" to={`/subastas/${auction.id}/editar`}>Editar publicación</Link>}
        </div>

        <div className="auction-detail__grid">
          <div className="auction-detail__body">
            <section className="detail-block">
              <span className="eyebrow">Descripción del producto</span>
              <p className="product-description">{auction.description || "El vendedor no agregó una descripción."}</p>
            </section>

            <section className="detail-block detail-facts">
              <div><span>Estado</span><strong>{auction.condition}</strong></div>
              <div><span>Comuna</span><strong>{auction.commune}</strong></div>
              <div><span>Entrega</span><strong>{auction.delivery}</strong></div>
              <div><span>Precio inicial</span><strong>{formatMoney(auction.startingPrice)}</strong></div>
            </section>

            <section className="detail-block bid-history">
              <div className="section-heading section-heading--compact">
                <div>
                  <span className="eyebrow">Registro público</span>
                  <h2>Historial de pujas</h2>
                </div>
                <span className="bid-count">{activeBids.length} activas</span>
              </div>
              {activeBids.length ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Postor</th><th>Oferta</th><th>Fecha · hora Chile</th></tr></thead>
                    <tbody>
                      {activeBids.map((bid, index) => (
                        <tr key={bid.id || `${bid.userId}-${bid.amount}`} className={index === 0 ? "table-row--leader" : ""}>
                          <td><span className="rank">{index + 1}</span>{bid.displayName}</td>
                          <td><strong>{formatMoney(bid.amount)}</strong></td>
                          <td>{formatChileDate(bid.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="history-empty"><strong>Aún no hay pujas.</strong><p>La primera puede ser por cualquier monto superior al precio inicial.</p></div>
              )}
              <p className="fine-print">Las pujas retiradas o reemplazadas dejan de mostrarse aquí, pero permanecen registradas internamente para auditoría.</p>
            </section>
          </div>

          <aside className="bid-panel">
            <div className="bid-panel__status">
              <span>{isActive ? "La subasta termina en" : "Resultado de la subasta"}</span>
              {isActive ? <Countdown until={auction.endsAt} onEnd={() => reload({ quiet: true })} /> : <StatusBadge status={auction.status} />}
              <small>{formatChileDateLong(auction.endsAt)}</small>
            </div>
            <div className="bid-panel__price">
              <span>{isActive ? "Puja actual" : "Precio final"}</span>
              <strong>{formatMoney(auction.currentPrice)}</strong>
              <small>{auction.bidCount} {auction.bidCount === 1 ? "oferta" : "ofertas"}</small>
            </div>

            {actionError && <InlineNotice type="error">{actionError}</InlineNotice>}

            {canBid && isAuthenticated && (
              <form className="bid-form" onSubmit={placeBid}>
                <label htmlFor="bidAmount">Tu oferta</label>
                <div className="money-input money-input--large">
                  <span>$</span>
                  <input id="bidAmount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </div>
                <small>Sin incremento mínimo. Debe superar {formatMoney(auction.currentPrice)}.</small>
                <button className="button button--red button--large button--full" type="submit" disabled={submitting}>
                  {submitting && <Spinner small />} Confirmar puja
                </button>
              </form>
            )}

            {canBid && !isAuthenticated && (
              <div className="bid-panel__login">
                <p>Ingresa para hacer una oferta. El monto quedará congelado en tu cuenta.</p>
                <Link className="button button--red button--full" to="/ingresar" state={{ from: { pathname: `/subastas/${auction.id}` } }}>Ingresar para pujar</Link>
              </div>
            )}

            {myBid && isActive && (
              <div className="my-bid">
                <span>Tu puja activa</span>
                <strong>{formatMoney(myBid.amount)}</strong>
                <button className="text-button text-button--danger" type="button" disabled={submitting} onClick={withdrawBid}>Retirar mi puja</button>
              </div>
            )}

            {isOwner && isActive && <InlineNotice>Esta subasta es tuya. Puedes editar sus datos, excepto el precio inicial.</InlineNotice>}
            {!isActive && auction.status === "matching" && <InlineNotice type="warning">La subasta cerró y está recorriendo la posta de postores. Cada turno dura una hora.</InlineNotice>}
            {!isActive && auction.status === "sold" && <InlineNotice type="success">El trato fue aceptado y la venta quedó registrada.</InlineNotice>}
            {!isActive && auction.status === "no_match" && <InlineNotice>La posta terminó sin una aceptación. Esta subasta murió sin match.</InlineNotice>}

            <div className="bid-panel__rule">
              <span aria-hidden="true">!</span>
              <p><strong>Pujar es comprometerse.</strong> Si te corresponde el turno y rechazas, pierdes el 10% de tu oferta congelada.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
