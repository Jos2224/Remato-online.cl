import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { AuctionForm } from "../components/AuctionForm";
import { useToast } from "../components/Toast";

export function PublishPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const create = async (payload) => {
    setSubmitting(true);
    try {
      const auction = await auctionsApi.create(payload);
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
            <strong>Sin fotos, por ahora</strong>
            <p>Una descripción precisa ayuda a tomar una decisión informada.</p>
          </div>
        </header>
        <AuctionForm onSubmit={create} submitting={submitting} />
      </div>
    </div>
  );
}
