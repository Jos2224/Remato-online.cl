import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { AuctionForm } from "../components/AuctionForm";
import { useToast } from "../components/Toast";

export function PublishPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const create = async ({ imageFile, ...payload }) => {
    setSubmitting(true);
    try {
      const auction = await auctionsApi.create(payload);
      // The image needs the auction id, so it goes up right after creation. A failed
      // upload must not lose the publication itself.
      if (imageFile) {
        try {
          await auctionsApi.uploadImage(auction.id, imageFile);
        } catch {
          showToast("Publicamos la subasta, pero no pudimos subir la foto. Puedes agregarla editándola.");
          navigate(`/subastas/${auction.id}`);
          return;
        }
      }
      showToast("Tu subasta ya está publicada.");
      navigate(`/subastas/${auction.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-page page-space">
      <div className="container form-page__layout">
        <header className="form-page__intro">
          <span className="eyebrow">Vender</span>
          <h1>Publica una subasta</h1>
          <p>Cuenta bien qué vendes. Los compradores definirán el precio final con sus ofertas.</p>
          <div className="side-note">
            <strong>La foto es opcional</strong>
            <p>Puedes publicar sin imagen, pero una foto y una descripción precisa ayudan a decidir.</p>
          </div>
        </header>
        <AuctionForm onSubmit={create} submitting={submitting} />
      </div>
    </div>
  );
}
