import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { FLOW_STATUS, describeFlowStatus, signParameters, signatureMatches } from '../src/lib/flow.js';

const SECRET = 'clave-de-prueba-para-firmar';

// Referencia independiente de la implementación: se calcula a mano lo que la regla de
// Flow exige, para que el test falle si alguien cambia el orden o el separador.
const referenceSignature = (parameters, secret = SECRET) => {
  const names = Object.keys(parameters).filter((name) => name !== 's').sort();
  const concatenated = names.map((name) => name + parameters[name]).join('');
  return createHmac('sha256', secret).update(concatenated, 'utf8').digest('hex');
};

test('la firma ordena los parámetros alfabéticamente y concatena nombre y valor', () => {
  const parameters = {
    subject: 'Abono',
    apiKey: 'ABC-123',
    amount: 5000,
    commerceOrder: 'RO-1',
    currency: 'CLP',
  };
  assert.equal(signParameters(parameters, SECRET), referenceSignature(parameters));
});

test('el orden en que se escriben los parámetros no altera la firma', () => {
  const a = { b: '2', a: '1', c: '3' };
  const c = { c: '3', a: '1', b: '2' };
  assert.equal(signParameters(a, SECRET), signParameters(c, SECRET));
});

test('el parámetro s nunca se firma a sí mismo', () => {
  const base = { apiKey: 'K', amount: 100 };
  const withSignature = { ...base, s: 'firma-anterior' };
  assert.equal(signParameters(withSignature, SECRET), signParameters(base, SECRET));
});

test('los valores nulos o ausentes se omiten', () => {
  const base = { apiKey: 'K', amount: 100 };
  assert.equal(
    signParameters({ ...base, optional: undefined, extra: null }, SECRET),
    signParameters(base, SECRET),
  );
});

test('cambiar un solo carácter cambia la firma', () => {
  const original = signParameters({ apiKey: 'K', amount: 1000 }, SECRET);
  assert.notEqual(original, signParameters({ apiKey: 'K', amount: 1001 }, SECRET));
  // Y una secretKey distinta produce una firma distinta con los mismos parámetros.
  assert.notEqual(original, signParameters({ apiKey: 'K', amount: 1000 }, 'otra-clave'));
});

test('el monto entra como entero, sin notación decimal', () => {
  // Un float cerca del dinero rompe la firma además del monto: 5000.0 se serializa
  // distinto que 5000 y Flow recibiría una cadena que no coincide con lo firmado.
  const asInteger = signParameters({ amount: 5000 }, SECRET);
  const asString = signParameters({ amount: '5000' }, SECRET);
  assert.equal(asInteger, asString, 'un entero y su texto deben firmar igual');
  assert.notEqual(asInteger, signParameters({ amount: 5000.0.toFixed(1) }, SECRET));
});

test('la comparación de firmas resiste longitudes distintas', () => {
  const firma = signParameters({ apiKey: 'K' }, SECRET);
  assert.equal(signatureMatches(firma, firma), true);
  assert.equal(signatureMatches(firma, 'corta'), false);
  assert.equal(signatureMatches(firma, null), false);
  assert.equal(signatureMatches(firma, `${firma}x`), false);
});

test('sólo el estado 2 significa pagado', () => {
  assert.equal(FLOW_STATUS.PAID, 2);
  assert.equal(describeFlowStatus(2), 'PAID');
  assert.equal(describeFlowStatus(1), 'PENDING');
  assert.equal(describeFlowStatus(3), 'REJECTED');
  assert.equal(describeFlowStatus(4), 'CANCELLED');
  // Un estado desconocido nunca debe interpretarse como pagado.
  assert.equal(describeFlowStatus(99), 'UNKNOWN');
  assert.equal(describeFlowStatus(undefined), 'UNKNOWN');
});
