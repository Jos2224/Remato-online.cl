import { Link } from "react-router-dom";
import { Countdown } from "./Countdown";
import { StatusBadge } from "./StatusBadge";
import { formatChileDate, formatMoney } from "../utils/format";

export function AuctionCard({ auction, muted = false }) {
  const isActive = auction.status === "active";
  return (
    <article className={`auction-card${muted ? " auction-card--muted" : ""}`}>
      <Link className="auction-card__main" to={`/subastas/${auction.id}`} aria-label={`Ver ${auction.title}`}>
        <div className="auction-card__topline">
          <div className="auction-card__tags">
            <span>{auction.category}</span>
            <span>{auction.condition}</span>
          </div>
          <StatusBadge status={auction.status} />
        </div>

        <div className="auction-card__content">
          <div>
            <p className="auction-card__lot">Subasta #{auction.id}</p>
            <h3>{auction.title}</h3>
            <p className="auction-card__description">{auction.description || "Sin descripción."}</p>
          </div>
          <div className="auction-card__price">
            <span>{isActive ? "Puja actual" : "Precio de cierre"}</span>
            <strong>{formatMoney(auction.currentPrice)}</strong>
            <small>{auction.bidCount} {auction.bidCount === 1 ? "puja" : "pujas"}</small>
          </div>
        </div>

        <div className="auction-card__meta">
          <div>
            <span>Vendedor</span>
            <strong>{auction.seller.email || "Cuenta no disponible"}</strong>
          </div>
          <div>
            <span>{isActive ? "Cierra" : "Cerró"}</span>
            <strong>{formatChileDate(auction.endsAt)}</strong>
          </div>
          <div className="auction-card__timer">
            {isActive ? <Countdown until={auction.endsAt} compact /> : <span className="link-arrow">Ver resultado →</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
