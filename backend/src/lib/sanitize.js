// Strip markup from free-text fields at the boundary.
//
// React escapes on render, so stored markup is not an XSS vector *in the SPA* — but the
// database is not the only consumer. The moment a title reaches an email, a PDF, an
// admin panel or any non-React surface, `<img src=x onerror=...>` stored verbatim
// becomes live. Cleaning on the way in keeps every downstream consumer safe.

const TAG = /<[^>]*>/g;
// C0/C1 control characters; the newline and tab are handled separately below.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Angle brackets written as entities, so a stripped tag cannot be reassembled downstream.
const ANGLE_ENTITIES = /&(?:lt|gt|#0*(?:60|62)|#x0*3[ce]);/gi;

const base = (value) =>
  value.replace(TAG, '').replace(ANGLE_ENTITIES, '').replace(CONTROL, '');

export function stripMarkup(value) {
  if (typeof value !== 'string') return value;
  return base(value).replace(/\s+/g, ' ').trim();
}

// Same, but newlines survive — descriptions are multi-line by nature.
export function stripMarkupMultiline(value) {
  if (typeof value !== 'string') return value;
  return base(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
