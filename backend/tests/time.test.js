import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  parseChileDateTime,
  requireAtLeastThreeMinutesAhead,
} from '../src/lib/time.js';

test('a Chile wall-time without offset is interpreted in America/Santiago', () => {
  const parsed = parseChileDateTime('2026-08-01T12:30');
  assert.equal(parsed.toISO(), '2026-08-01T16:30:00.000Z');
});

test('an ISO instant with offset keeps the same instant', () => {
  const parsed = parseChileDateTime('2026-08-01T12:30:00-04:00');
  assert.equal(parsed.toISO(), '2026-08-01T16:30:00.000Z');
});

test('closing time must be at least three minutes ahead', () => {
  const now = DateTime.fromISO('2026-08-01T16:00:00Z');
  assert.throws(
    () => requireAtLeastThreeMinutesAhead('2026-08-01T12:02:59-04:00', now),
    /3 minutos/,
  );
  assert.equal(
    requireAtLeastThreeMinutesAhead('2026-08-01T12:03:00-04:00', now).toISO(),
    '2026-08-01T16:03:00.000Z',
  );
});
