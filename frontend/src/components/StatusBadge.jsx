const STATUS = {
  active: { label: "Activa", className: "status-badge--active" },
  matching: { label: "En posta", className: "status-badge--matching" },
  sold: { label: "Vendida", className: "status-badge--sold" },
  no_match: { label: "Sin match", className: "status-badge--dead" },
  pending: { label: "Tu turno", className: "status-badge--matching" },
  accepted: { label: "Aceptado", className: "status-badge--sold" },
  rejected: { label: "Rechazado", className: "status-badge--dead" },
  expired: { label: "Vencido", className: "status-badge--dead" },
};

export function StatusBadge({ status }) {
  const config = STATUS[status] ?? { label: status || "Estado desconocido", className: "" };
  return <span className={`status-badge ${config.className}`}>{config.label}</span>;
}
