import { useEffect, useMemo, useState } from "react";
import { chileInputToIso, describeApiError, formatMoney, minimumChileInput, numberFromInput, toChileInputValue } from "../utils/format";
import { serverNowMs } from "../utils/server-clock";
import { InlineNotice, Spinner } from "./States";
import { downscaleImage } from "../utils/image";
import { LegalConsent } from "./LegalConsent";
import { CATEGORIES, CONDITIONS, SHIPPING } from "../utils/taxonomy";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGES = 8;

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Otros",
  condition: "Usado",
  startingPrice: "",
  commune: "",
  delivery: "",
  endsAt: "",
  shippingMethod: "PICKUP",
  shippingCost: "",
};

export function AuctionForm({ auction, onSubmit, submitting, onRemoveImage }) {
  const editing = Boolean(auction);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  // Optional photos. Kept out of `form` because these are Files, not text fields, and
  // they are uploaded in follow-up requests once the auction has an id.
  // Sólo se piden al publicar; al editar no se vuelve a firmar nada.
  const [acceptedDocuments, setAcceptedDocuments] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
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
      shippingMethod: auction.shippingMethod || "PICKUP",
      shippingCost: auction.shippingCost != null ? String(auction.shippingCost) : "",
    });
  }, [auction]);

  const alreadyPublished = auction?.images?.length ?? 0;

  const pickImages = async (event) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError("");
    if (picked.length === 0) return;

    const room = MAX_IMAGES - alreadyPublished - imageFiles.length;
    if (room <= 0) {
      setError(`Ya alcanzaste el máximo de ${MAX_IMAGES} fotos.`);
      return;
    }

    const accepted = [];
    for (const original of picked.slice(0, room)) {
      // Shrink first: a photo straight from a phone is usually far larger than the
      // limit, and rejecting it outright would be needless when scaling works.
      const file = await downscaleImage(original);
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`"${original.name}" sigue pesando más de 3 MB incluso reducida y se omitió.`);
        continue;
      }
      accepted.push(file);
    }
    if (picked.length > room) {
      setError(`Sólo se agregaron ${room} fotos: el máximo es ${MAX_IMAGES}.`);
    }

    setImageFiles((current) => [...current, ...accepted]);
    setImagePreviews((current) => [...current, ...accepted.map((file) => URL.createObjectURL(file))]);
  };

  const dropPending = (position) => {
    setImageFiles((current) => current.filter((_, index) => index !== position));
    setImagePreviews((current) => {
      // Release the object URL so the blob can be collected.
      URL.revokeObjectURL(current[position]);
      return current.filter((_, index) => index !== position);
    });
  };

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
    if (form.shippingMethod === "CHILEXPRESS" && numberFromInput(form.shippingCost) <= 0) {
      setError("Indica el costo del despacho por Chilexpress.");
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
      shippingMethod: form.shippingMethod,
      shippingCost:
        form.shippingMethod === "CHILEXPRESS" ? numberFromInput(form.shippingCost) : null,
      imageFiles,
      ...(editing ? {} : { acceptedDocuments }),
    }).catch((submitError) => setError(describeApiError(submitError)));
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
        <small>{form.description.length}/3000 caracteres.</small>
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

      <div className="field">
        <label htmlFor="shippingMethod">Cómo se entrega</label>
        <select id="shippingMethod" name="shippingMethod" value={form.shippingMethod} onChange={update}>
          {SHIPPING.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
        <small>El sello que ve quien compra depende de esto, así que debe reflejar lo que harás de verdad.</small>
      </div>

      {form.shippingMethod === "CHILEXPRESS" && (
        <div className="field">
          <label htmlFor="shippingCost">Costo del despacho</label>
          <div className="money-input">
            <span>$</span>
            <input id="shippingCost" name="shippingCost" inputMode="numeric" value={form.shippingCost} onChange={update} placeholder="4990" />
          </div>
          <small>{formatMoney(numberFromInput(form.shippingCost))} · lo paga quien compra, aparte del precio.</small>
        </div>
      )}

      <div className="field field--wide">
        <label htmlFor="delivery">Coordinación de entrega</label>
        <input id="delivery" name="delivery" maxLength="160" value={form.delivery} onChange={update} required placeholder="Ej: Retiro a coordinar en Providencia" />
        <small>La entrega se coordina directamente entre vendedor y comprador.</small>
      </div>

      <div className="field field--wide">
        <label htmlFor="images">Fotografías del producto <span className="field__optional">(opcional)</span></label>
        <input id="images" name="images" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={pickImages} />
        <small>
          Hasta {MAX_IMAGES} fotos JPG, PNG o WebP. Se reducen automáticamente antes de subirlas.
          Si no subes ninguna, la publicación se muestra sin fotos.
        </small>
        {(imagePreviews.length > 0 || alreadyPublished > 0) && (
          <ul className="image-previews">
            {auction?.images?.map((image) => (
              <li key={image.id}>
                <img src={image.url} alt="Foto publicada" />
                <button type="button" onClick={() => onRemoveImage?.(image.id)} aria-label="Quitar esta foto">×</button>
              </li>
            ))}
            {imagePreviews.map((preview, position) => (
              <li key={preview}>
                <img src={preview} alt={`Foto por subir ${position + 1}`} />
                <button type="button" onClick={() => dropPending(position)} aria-label="Quitar esta foto">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field field--wide">
        <label htmlFor="endsAt">Fecha y hora exacta de cierre</label>
        <input id="endsAt" name="endsAt" type="datetime-local" min={minimum} value={form.endsAt} onChange={update} required />
        <small>
          Hora de Chile (America/Santiago). Debe quedar entre 3 minutos y 30 días desde este momento.
        </small>
      </div>

      <div className="auction-form__rules field--wide">
        <strong>Antes de {editing ? "guardar" : "publicar"}</strong>
        <p>La subasta se cierra a la hora indicada; una puja en los últimos 2 minutos la prorroga otros 2. Cada puja es un compromiso de compra y deja ese dinero congelado. Una vez que haya pujas, la fecha de cierre queda fija.</p>
      </div>

      {!editing && (
        <div className="field--wide">
          <LegalConsent context="PUBLISH" onChange={setAcceptedDocuments} disabled={submitting} />
        </div>
      )}

      <div className="auction-form__actions field--wide">
        <button className="button button--red button--large" type="submit" disabled={submitting}>
          {submitting && <Spinner small />}
          {editing ? "Guardar cambios" : "Publicar subasta"}
        </button>
      </div>
    </form>
  );
}
