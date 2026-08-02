import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { legalApi } from "../api/client";

// Casillas de aceptación de documentos legales.
//
// Se piden únicamente los documentos que la persona todavía no ha firmado en su versión
// vigente: si ya aceptó, no vuelve a aparecer nada. Cada casilla enlaza al texto completo,
// porque una firma sobre un documento que no se pudo leer no vale gran cosa.
//
// El componente informa hacia arriba mediante `onChange(slugsAceptados)`; el formulario
// que lo contiene envía esa lista junto a la operación, y el servidor vuelve a verificar.
export function LegalConsent({ context, onChange, disabled = false }) {
  const [pending, setPending] = useState([]);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    legalApi
      .pending(context)
      .then((documents) => {
        if (cancelled) return;
        setPending(documents);
        setFailed(false);
        // Sin documentos pendientes el formulario debe poder enviarse de inmediato.
        if (documents.length === 0) onChange?.([]);
      })
      .catch(() => {
        if (cancelled) return;
        // Si no podemos saber qué falta, no bloqueamos el formulario en el cliente: el
        // servidor rechazará la operación igual y con el mensaje correcto.
        setFailed(true);
        setPending([]);
        onChange?.([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  const toggle = (slug) => {
    setChecked((current) => {
      const next = { ...current, [slug]: !current[slug] };
      onChange?.(Object.keys(next).filter((key) => next[key]));
      return next;
    });
  };

  if (loading) return <p className="legal-consent__loading">Cargando documentos…</p>;
  if (failed || pending.length === 0) return null;

  return (
    <fieldset className="legal-consent">
      <legend>Antes de continuar</legend>
      {pending.map((document) => (
        <label className="legal-consent__item" key={document.slug}>
          <input
            type="checkbox"
            checked={Boolean(checked[document.slug])}
            onChange={() => toggle(document.slug)}
            disabled={disabled}
          />
          <span>
            He leído y acepto{" "}
            <Link to={`/legal/${document.slug}`} target="_blank" rel="noreferrer">
              {document.title}
            </Link>{" "}
            <small>(versión {document.version})</small>
          </span>
        </label>
      ))}
      <p className="legal-consent__note">
        Al marcar y continuar firmas electrónicamente estos documentos. Se registrará la
        fecha, la hora y la versión exacta aceptada, conforme a la Ley 19.799.
      </p>
    </fieldset>
  );
}

// Utilidad para los formularios: ¿están marcadas todas las casillas pendientes?
export function useLegalConsent() {
  const [accepted, setAccepted] = useState(null);
  const [required, setRequired] = useState(null);
  return {
    accepted: accepted ?? [],
    // `null` significa "todavía no sabemos"; el formulario no debe bloquear por eso.
    ready: accepted !== null,
    setAccepted,
    required,
    setRequired,
  };
}
