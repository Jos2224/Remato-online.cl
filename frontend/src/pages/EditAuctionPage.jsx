import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuctionForm } from "../components/AuctionForm";
import { ErrorState, PageLoader } from "../components/States";
import { useToast } from "../components/Toast";
import { usePollingQuery } from "../hooks/usePollingQuery";

export function EditAuctionPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const { data: auction, loading, error, reload } = usePollingQuery(() => auctionsApi.get(id), { interval: 0, deps: [id] });

  if (loading) return <PageLoader label="Cargando la publicación" />;
  if (error || !auction) return <div className="container page-space"><ErrorState title="No pudimos abrir esta publicación" error={error} onRetry={reload} /></div>;

  const isOwner = auction.sellerId === user?.id;
  const canEdit = auction.canEdit ?? auction.capabilities?.canEdit ?? isOwner;
  if (!canEdit) {
    return <div className="container page-space"><ErrorState title="Esta publicación no es tuya" error={{ message: "Solo la cuenta vendedora puede editarla." }} /></div>;
  }

  const update = async (payload) => {
    setSubmitting(true);
    try {
      await auctionsApi.update(auction.id, payload);
      showToast("Cambios guardados. La nueva fecha ya es visible para los postores.");
      navigate(`/subastas/${auction.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-page page-space">
      <div className="container form-page__layout">
        <header className="form-page__intro">
          <span className="eyebrow">Subasta #{auction.id}</span>
          <h1>Edita tu publicación</h1>
          <p>Puedes cambiar todos los datos excepto el precio inicial. No se enviarán notificaciones por cambios de fecha.</p>
          <div className="side-note side-note--warning">
            <strong>Cambio de cierre</strong>
            <p>La nueva fecha debe quedar al menos 3 minutos por delante de la hora actual de Chile.</p>
          </div>
        </header>
        <AuctionForm auction={auction} onSubmit={update} submitting={submitting} />
      </div>
    </div>
  );
}
