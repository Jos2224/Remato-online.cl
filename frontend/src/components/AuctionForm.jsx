import { useEffect, useMemo, useState } from "react";
import { chileInputToIso, formatMoney, minimumChileInput, numberFromInput, toChileInputValue } from "../utils/format";
import { serverNowMs } from "../utils/server-clock";
import { InlineNotice, Spinner } from "./States";

const CATEGORIES = [
  "Tecnología",
  "Vehículos",
  "Hogar",
  "Herramientas",
  "Deportes",
  "Moda",
  "Coleccionables",
  "Industrial",
  "Otros",
];

const CONDITIONS = ["Nuevo", "Como nuevo", "Usado", "Para reparar"];

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Otros",
  condition: "Usado",
  startingPrice: "",
  commune: "",
  delivery: "",
  endsAt: "",
};

export function AuctionForm({ auction, onSubmit, submitting }) {
  const editing = Boolean(auction);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const minimum = useMemo(() => minimumChileInput(3, serverNowMs()), []);

  useEffect(() => {
    if (!auction) return;
    setForm({
      title: auction.title || "",
      description: auction.description || "",
      category: auction.category || "Otros",
      condition: auction.condition || "Usado",
      startingPrice: String(auction.startingPrice || ""),
      commune: auction.commune || "",
      delivery: auction.delivery || "",
      endsAt: auction.endsAt ? toChileInputValue(auction.endsAt) : "",
    });
  }, [auction]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const amount = numberFromInput(form.startingPrice);
    const endsAt = chileInputToIso(form.endsAt);

    if (!form.title.trim() || !form.description.trim() || !form.commune.trim() || !form.delivery.trim()) {
      setError("Completa todos los campos antes de continuar.");
      return;
    }
    if (!editing && amount <= 0) {
      setError("El precio inicial debe ser mayor a $0.");
      return;
    }
    const minimumClosingTime = serverNowMs() + 3 * 60_000;
    if (!endsAt || new Date(endsAt).getTime() < minimumClosingTime - 5_000) {
      setError("El cierre debe quedar al menos 3 minutos por delante de la hora actual de Chile.");
      return;
    }

    await onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      condition: form.condition,
      ...(!editing ? { startingPrice: amount } : {}),
      commune: form.commune.trim(),
      delivery: form.delivery.trim(),
      endsAt,
    }).catch((submitError) => setError(submitError.message));
  };

  return (
    <form className="auction-form" onSubmit={submit} noValidate>
      {error && <InlineNotice type="error">{error}</InlineNotice>}

      <div className="field field--wide">
        <label htmlFor="title">Título del producto</label>
        <input id="title" name="title" maxLength="120" value={form.title} onChange={update} required placeholder="Ej: Notebook Lenovo ThinkPad T490" />
        <small>{form.title.length}/120 caracteres</small>
      </div>

      <div className="field field--wide">
        <label htmlFor="description">Descripción</label>
        <textarea id="description" name="description" rows="6" maxLength="3000" value={form.description} onChange={update} required placeholder="Describe el producto, sus detalles y cualquier defecto relevante." />
        <small>{form.description.length}/3000 caracteres. No se admiten fotos en esta versión.</small>
      </div>

      <div className="field">
        <label htmlFor="category">Categoría</label>
        <select id="category" name="category" value={form.category} onChange={update}>
          {CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="condition">Estado del producto</label>
        <select id="condition" name="condition" value={form.condition} onChange={update}>
          {CONDITIONS.map((condition) => <option value={condition} key={condition}>{condition}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="startingPrice">Precio inicial</label>
        <div className={`money-input${editing ? " money-input--readonly" : ""}`}>
          <span>$</span>
          <input
            id="startingPrice"
            name="startingPrice"
            inputMode="numeric"
            value={form.startingPrice}
            onChange={update}
            readOnly={editing}
            required
            aria-describedby={editing ? "price-help" : undefined}
          />
        </div>
        {editing ? <small id="price-help">El precio inicial no se puede cambiar después de publicar.</small> : <small>{formatMoney(numberFromInput(form.startingPrice))}</small>}
      </div>

      <div className="field">
        <label htmlFor="commune">Comuna</label>
        <input id="commune" name="commune" value={form.commune} onChange={update} required placeholder="Ej: Providencia" />
      </div>

      <div className="field field--wide">
        <label htmlFor="delivery">Coordinación de entrega</label>
        <input id="delivery" name="delivery" maxLength="160" value={form.delivery} onChange={update} required placeholder="Ej: Retiro a coordinar en Providencia" />
        <small>La entrega se coordina directamente entre vendedor y comprador.</small>
      </div>

      <div className="field field--wide">
        <label htmlFor="endsAt">Fecha y hora exacta de cierre</label>
        <input id="endsAt" name="endsAt" type="datetime-local" min={minimum} value={form.endsAt} onChange={update} required />
        <small>
          Hora de Chile (America/Santiago). Debe quedar a 3 minutos o más desde este momento y no tiene duración máxima.
        </small>
      </div>

      <div className="auction-form__rules field--wide">
        <strong>Antes de {editing ? "guardar" : "publicar"}</strong>
        <p>La subasta se cierra exactamente a la hora indicada. Cada puja es un compromiso de compra y deja ese dinero congelado.</p>
      </div>

      <div className="auction-form__actions field--wide">
        <button className="button button--red button--large" type="submit" disabled={submitting}>
          {submitting && <Spinner small />}
          {editing ? "Guardar cambios" : "Publicar subasta"}
        </button>
      </div>
    </form>
  );
}
