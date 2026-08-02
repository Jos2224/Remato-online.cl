import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCEPTANCE_CONTEXTS,
  LEGAL_DOCUMENTS,
  documentsRequiredFor,
  findDocument,
} from '../src/domain/legal.js';

test('cada documento declara versión, título y contextos válidos', () => {
  const contexts = new Set(Object.values(ACCEPTANCE_CONTEXTS));
  for (const document of LEGAL_DOCUMENTS) {
    assert.ok(document.slug, 'falta slug');
    assert.match(document.version, /^\d+\.\d+$/, `versión inválida en ${document.slug}`);
    assert.ok(document.title.length > 0, `falta título en ${document.slug}`);
    assert.ok(document.body.length > 500, `cuerpo sospechosamente corto en ${document.slug}`);
    assert.ok(document.requiredFor.length > 0, `${document.slug} no se exige en ningún flujo`);
    for (const context of document.requiredFor) {
      assert.ok(contexts.has(context), `contexto desconocido en ${document.slug}: ${context}`);
    }
  }
});

test('la huella identifica el texto y es estable', () => {
  for (const document of LEGAL_DOCUMENTS) {
    assert.match(document.contentHash, /^[a-f0-9]{64}$/);
  }
  // Dos documentos distintos no pueden compartir huella.
  const hashes = new Set(LEGAL_DOCUMENTS.map((document) => document.contentHash));
  assert.equal(hashes.size, LEGAL_DOCUMENTS.length);
  // Releer el mismo documento devuelve la misma huella.
  assert.equal(
    findDocument('reglas-de-compra').contentHash,
    findDocument('reglas-de-compra').contentHash,
  );
});

test('los tres flujos exigen firma', () => {
  for (const context of Object.values(ACCEPTANCE_CONTEXTS)) {
    assert.ok(
      documentsRequiredFor(context).length > 0,
      `ningún documento se exige para ${context}`,
    );
  }
  assert.deepEqual(
    documentsRequiredFor(ACCEPTANCE_CONTEXTS.BID).map((document) => document.slug),
    ['reglas-de-compra'],
  );
});

test('los slugs son únicos y no hay documentos desconocidos', () => {
  const slugs = LEGAL_DOCUMENTS.map((document) => document.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(findDocument('no-existe'), null);
});

test('las reglas de compra explican la cláusula penal y su reparto', () => {
  // El reparto 70/30 obliga sólo si está pactado: si el texto deja de decirlo, la
  // penalidad que cobra el código pierde su respaldo contractual.
  const body = findDocument('reglas-de-compra').body;
  assert.match(body, /cláusula penal/i);
  assert.match(body, /1535/);
  assert.match(body, /70%/);
  assert.match(body, /30%/);
  assert.match(body, /10%/);
});
