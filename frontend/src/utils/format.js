export const CHILE_TIME_ZONE = "America/Santiago";

export function formatMoney(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatChileDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...options,
  }).format(date);
}

export function formatChileDateLong(value) {
  return formatChileDate(value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZoneName: "short",
  });
}

function zonedParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHILE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  return Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, part]),
  );
}

export function toChileInputValue(value = new Date()) {
  const parts = zonedParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function chileInputToIso(value) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map((part, index) =>
    index === 0 ? part : Number(part),
  );
  const wantedAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = wantedAsUtc;

  // Two passes resolve Chile's UTC offset, including daylight-saving changes.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = zonedParts(new Date(instant));
    const actualAsUtc = Date.UTC(
      Number(actual.year),
      Number(actual.month) - 1,
      Number(actual.day),
      Number(actual.hour),
      Number(actual.minute),
      0,
    );
    instant += wantedAsUtc - actualAsUtc;
  }

  return new Date(instant).toISOString();
}

export function minimumChileInput(minutesAhead = 3, now = Date.now()) {
  return toChileInputValue(new Date(now + minutesAhead * 60_000));
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (number) => String(number).padStart(2, "0");

  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function numberFromInput(value) {
  const normalized = String(value ?? "").replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

// Field labels for validation errors coming back from the API.
const FIELD_LABELS = {
  title: "Título",
  description: "Descripción",
  category: "Categoría",
  condition: "Estado del producto",
  commune: "Comuna",
  delivery: "Coordinación de entrega",
  endsAt: "Fecha de cierre",
  startingPrice: "Precio inicial",
  amount: "Monto",
  email: "Correo",
  password: "Contraseña",
};

// The API returns a generic headline plus a per-field breakdown. Showing only the
// headline ("Hay datos inválidos.") leaves the user with no idea what to correct, so
// the details are folded into the message.
export function describeApiError(error) {
  const headline = error?.message || "No pudimos completar la solicitud.";
  const details = error?.details;
  if (!Array.isArray(details) || details.length === 0) return headline;

  const lines = details
    .map((detail) => {
      const message = detail?.message ?? String(detail ?? "").trim();
      if (!message) return null;
      const path = detail?.path ? String(detail.path).split(".").pop() : "";
      const label = FIELD_LABELS[path] ?? path;
      return label ? `${label}: ${message}` : message;
    })
    .filter(Boolean);

  return lines.length ? lines.join(" · ") : headline;
}
