export function Spinner({ small = false }) {
  return <span className={`spinner${small ? " spinner--small" : ""}`} aria-hidden="true" />;
}

export function PageLoader({ label = "Cargando" }) {
  return (
    <div className="state state--loading" role="status">
      <Spinner />
      <p>{label}…</p>
    </div>
  );
}

export function ErrorState({ title = "Algo no resultó", error, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__mark">!</span>
      <h2>{title}</h2>
      <p>{error?.message || "No pudimos conectar con el servidor."}</p>
      {onRetry && (
        <button className="button button--dark" type="button" onClick={() => onRetry()}>
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

export function EmptyState({ eyebrow = "Sin resultados", title, description, action }) {
  return (
    <div className="state state--empty">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function InlineNotice({ type = "info", children }) {
  return (
    <div className={`notice notice--${type}`} role={type === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
