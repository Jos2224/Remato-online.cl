import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

// Cliente de Flow.
//
// La especificación OpenAPI no puede describir la parte más importante: cada petición se
// firma con HMAC-SHA256 sobre los propios parámetros. Un cliente generado desde la spec
// produce llamadas que Flow rechaza. Por eso la firma se escribe aquí, explícita.
//
// Regla de firma de Flow:
//   1. tomar todos los parámetros excepto `s`
//   2. ordenarlos alfabéticamente por nombre
//   3. concatenar nombre y valor, sin separadores
//   4. HMAC-SHA256 de esa cadena con la secretKey, en hexadecimal
//   5. enviar el resultado como parámetro `s`
export function signParameters(parameters, secretKey = config.flow.secretKey) {
  const toSign = Object.keys(parameters)
    .filter((name) => name !== 's' && parameters[name] !== undefined && parameters[name] !== null)
    .sort()
    .map((name) => `${name}${parameters[name]}`)
    .join('');

  return createHmac('sha256', secretKey).update(toSign, 'utf8').digest('hex');
}

// Comparación en tiempo constante: una firma se compara como un secreto, no como texto.
export function signatureMatches(expected, received) {
  if (typeof expected !== 'string' || typeof received !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const flowEnabled = () =>
  Boolean(config.flow.apiKey && config.flow.secretKey && config.flow.baseUrl);

function assertEnabled() {
  if (!flowEnabled()) {
    throw new Error('Flow no está configurado (FLOW_API_KEY / FLOW_SECRET_KEY).');
  }
}

export class FlowError extends Error {
  constructor(message, { status = 0, code = null, body = null } = {}) {
    super(message);
    this.name = 'FlowError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function readResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Flow devuelve errores como JSON con `code` y `message`, incluso con HTTP 200 en algunos
// casos, así que ambos caminos se revisan.
function ensureOk(response, payload, endpoint) {
  if (!response.ok || payload?.code) {
    throw new FlowError(payload?.message ?? `Flow rechazó ${endpoint}`, {
      status: response.status,
      code: payload?.code ?? null,
      body: payload,
    });
  }
  return payload;
}

export async function flowPost(endpoint, parameters) {
  assertEnabled();
  const withKey = { ...parameters, apiKey: config.flow.apiKey };
  const body = new URLSearchParams({ ...withKey, s: signParameters(withKey) });

  const response = await fetch(`${config.flow.baseUrl}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  return ensureOk(response, await readResponse(response), endpoint);
}

export async function flowGet(endpoint, parameters) {
  assertEnabled();
  const withKey = { ...parameters, apiKey: config.flow.apiKey };
  const query = new URLSearchParams({ ...withKey, s: signParameters(withKey) });

  const response = await fetch(`${config.flow.baseUrl}/${endpoint}?${query}`, {
    method: 'GET',
    signal: AbortSignal.timeout(20_000),
  });
  return ensureOk(response, await readResponse(response), endpoint);
}

// Flow valida que el dominio del correo exista y sea entregable, así que rechaza
// direcciones sintácticamente correctas. Este es el código con que lo informa.
export const FLOW_INVALID_EMAIL = 1620;

// Estados de Flow. 2 es el único que significa "el dinero llegó".
export const FLOW_STATUS = Object.freeze({
  PENDING: 1,
  PAID: 2,
  REJECTED: 3,
  CANCELLED: 4,
});

export const describeFlowStatus = (status) =>
  ({
    [FLOW_STATUS.PENDING]: 'PENDING',
    [FLOW_STATUS.PAID]: 'PAID',
    [FLOW_STATUS.REJECTED]: 'REJECTED',
    [FLOW_STATUS.CANCELLED]: 'CANCELLED',
  })[Number(status)] ?? 'UNKNOWN';

// Crea la orden y devuelve la URL a la que hay que enviar al navegador.
export async function createPayment({ commerceOrder, subject, amount, email, optional }) {
  // CLP no admite decimales. Cualquier resto decimal aquí es un error de programación,
  // no algo que deba redondearse en silencio cerca de dinero.
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new FlowError('El monto debe ser un entero positivo de pesos.');
  }

  const payload = await flowPost('payment/create', {
    commerceOrder,
    subject,
    currency: 'CLP',
    amount,
    email,
    urlConfirmation: `${config.appUrl.replace(/\/$/, '')}/api/payments/flow/confirm`,
    urlReturn: `${config.appUrl.replace(/\/$/, '')}/api/payments/flow/return`,
    ...(optional ? { optional: JSON.stringify(optional) } : {}),
  });

  if (!payload?.url || !payload?.token) {
    throw new FlowError('Flow no devolvió una URL de pago utilizable.', { body: payload });
  }
  // Flow entrega la URL y el token por separado; el navegador va a la unión de ambos.
  return { ...payload, redirectUrl: `${payload.url}?token=${payload.token}` };
}

// Única fuente de verdad sobre si un pago ocurrió. Nunca se confía en el cuerpo del
// callback ni en la URL de retorno: sólo en lo que Flow responde aquí.
export async function getPaymentStatus(token) {
  return flowGet('payment/getStatus', { token });
}
