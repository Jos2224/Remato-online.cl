import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { MAX_AUCTION_DAYS, minimumIncrement, minimumNextBid } from '../src/domain/auction.js';
import { stripMarkup, stripMarkupMultiline } from '../src/lib/sanitize.js';
import { maskEmail, publicAlias } from '../src/lib/privacy.js';
import { requireAtLeastThreeMinutesAhead } from '../src/lib/time.js';

test('the minimum increment grows with the price band', () => {
  assert.equal(minimumIncrement(5_000), 500);
  assert.equal(minimumIncrement(10_000), 1_000);
  assert.equal(minimumIncrement(120_000), 2_000);
  assert.equal(minimumIncrement(900_000), 5_000);
  assert.equal(minimumIncrement(5_000_000), 10_000);
});

test('the opening bid may equal the starting price, later bids must clear the step', () => {
  assert.equal(minimumNextBid(10_000, false), 10_000);
  assert.equal(minimumNextBid(10_000, true), 11_000);
});

test('markup is removed from free text', () => {
  assert.equal(stripMarkup('<img src=x onerror="alert(1)">Notebook'), 'Notebook');
  // Entity-encoded angle brackets are dropped too, so the text can never be reassembled
  // into a live tag by a downstream consumer that decodes entities.
  assert.equal(stripMarkup('&lt;script&gt;alert(1)&lt;/script&gt; Bici'), 'scriptalert(1)/script Bici');
  assert.equal(stripMarkup('Hola <b>mundo</b>  con   espacios'), 'Hola mundo con espacios');
  assert.equal(stripMarkupMultiline('Linea 1\n\n\n\nLinea 2'), 'Linea 1\n\nLinea 2');
});

test('a public alias is stable and never leaks the address', () => {
  const id = '7845a1b2-0000-4000-8000-000000000001';
  assert.equal(publicAlias(id), publicAlias(id));
  assert.equal(publicAlias(id).includes('@'), false);
});

test('a masked email keeps only the shape of the address', () => {
  const masked = maskEmail('juan.perez@gmail.com');
  assert.equal(masked.startsWith('j'), true);
  assert.equal(masked.includes('juan.perez'), false);
  assert.equal(masked.endsWith('.com'), true);
  assert.equal(maskEmail('not-an-email'), null);
});

test('a closing date beyond the maximum is rejected', () => {
  const now = DateTime.utc();
  const tooFar = now.plus({ days: MAX_AUCTION_DAYS + 1 }).toISO();
  assert.throws(() => requireAtLeastThreeMinutesAhead(tooFar, now), /CLOSING_TIME_TOO_FAR|30/);

  const acceptable = now.plus({ days: MAX_AUCTION_DAYS - 1 }).toISO();
  assert.doesNotThrow(() => requireAtLeastThreeMinutesAhead(acceptable, now));
});
