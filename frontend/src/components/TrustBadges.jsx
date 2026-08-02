// Sellos de confianza.
//
// Sólo se muestra lo que es verdad. El sello de pago aparece porque Flow procesa
// realmente los abonos; el de envío aparece por publicación y sólo cuando esa
// publicación declara despacho por Chilexpress. Un sello que promete algo que el
// sistema no hace es publicidad engañosa, no diseño.

// Marca denominativa, no el logotipo: usar el isotipo de un tercero exige su archivo y
// su autorización de uso. El texto es igual de claro y no se apropia de nada.
export function FlowBadge({ compact = false }) {
  return (
    <span className={`trust-badge trust-badge--flow${compact ? " trust-badge--compact" : ""}`}>
      <span className="trust-badge__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      </span>
      <span>
        Pago procesado por <strong>Flow</strong>
      </span>
    </span>
  );
}

export function ChilexpressBadge({ cost = null, compact = false }) {
  return (
    <span className={`trust-badge trust-badge--shipping${compact ? " trust-badge--compact" : ""}`}>
      <span className="trust-badge__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7h11v9H3z" />
          <path d="M14 10h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17.5" cy="18" r="1.6" />
        </svg>
      </span>
      <span>
        Envío por <strong>Chilexpress</strong>
        {cost != null && cost > 0 && <> · {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(cost)}</>}
      </span>
    </span>
  );
}

export function PickupBadge({ commune, compact = false }) {
  return (
    <span className={`trust-badge${compact ? " trust-badge--compact" : ""}`}>
      <span className="trust-badge__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      </span>
      <span>
        Retiro en persona{commune ? <> · {commune}</> : null}
      </span>
    </span>
  );
}

// Elige el sello correcto para una publicación.
export function ShippingBadge({ auction, compact = false }) {
  if (auction?.shippingMethod === "CHILEXPRESS") {
    return <ChilexpressBadge cost={auction.shippingCost} compact={compact} />;
  }
  return <PickupBadge commune={auction?.commune} compact={compact} />;
}
