import { DateTime } from 'luxon';
import { config } from '../config.js';
import { badRequest } from './api-error.js';

export const chileNow = () => DateTime.now().setZone(config.chileTimeZone);

export function parseChileDateTime(value) {
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const parsed = hasExplicitZone
    ? DateTime.fromISO(value, { setZone: true })
    : DateTime.fromISO(value, { zone: config.chileTimeZone });

  if (!parsed.isValid) {
    throw badRequest(
      'INVALID_CLOSING_TIME',
      'La fecha de cierre debe ser una fecha ISO válida.',
    );
  }

  return parsed.toUTC();
}

export function requireAtLeastThreeMinutesAhead(value, now = DateTime.utc()) {
  const parsed = parseChileDateTime(value);
  if (parsed.toMillis() < now.plus({ minutes: 3 }).toMillis()) {
    throw badRequest(
      'CLOSING_TIME_TOO_SOON',
      'El cierre debe quedar al menos 3 minutos en el futuro.',
    );
  }
  return parsed;
}

export const toIso = (value) =>
  value == null ? null : DateTime.fromJSDate(new Date(value)).toUTC().toISO();
