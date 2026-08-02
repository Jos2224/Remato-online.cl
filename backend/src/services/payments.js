import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { badRequest, conflict, notFound } from '../lib/api-error.js';
import { MAX_MONEY } from '../domain/money.js';
import {
  FLOW_INVALID_EMAIL,
  FLOW_STATUS,
  createPayment,
  describeFlowStatus,
  getPaymentStatus,
} from '../lib/flow.js';

// Identificador propio de la orden. Corto, único y sin datos personales.
const newCommerceOrder = () => `RO-${randomUUID().replace(/-/g, '').slice(0, 18).toUpperCase()}`;

export async function startDeposit({ user, amount, payerEmail }) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_MONEY) {
    throw conflict('INVALID_AMOUNT', 'El monto debe ser un entero positivo de pesos.');
  }

  // Flow exige un correo y además valida que el dominio exista y sea entregable, así
  // que rechaza direcciones perfectamente bien formadas. El correo de la cuenta es sólo
  // el valor por defecto: si la pasarela lo rechaza, se puede pagar indicando otro.
  const email = (payerEmail ?? user.email ?? '').trim().toLowerCase();
  if (!email) {
    throw conflict('PAYER_EMAIL_REQUIRED', 'Indica un correo para el pago.');
  }

  const commerceOrder = newCommerceOrder();
  const inserted = await pool.query(
    `INSERT INTO payments (user_id, commerce_order, amount)
     VALUES ($1, $2, $3)
     RETURNING id, commerce_order, amount`,
    [user.id, commerceOrder, amount],
  );

  let created;
  try {
    created = await createPayment({
      commerceOrder,
      subject: 'Abono de saldo en RematoOnline',
      amount,
      email,
      optional: { userId: user.id },
    });
  } catch (error) {
    // La orden queda registrada como cancelada: sirve para auditar por qué un abono no
    // llegó a existir, en vez de desaparecer sin rastro.
    await pool.query(
      `UPDATE payments SET status = 'CANCELLED', updated_at = now() WHERE id = $1`,
      [inserted.rows[0].id],
    );
    // 1620 es "correo no válido" según Flow. Decirle a la persona "no pudimos iniciar el
    // pago" la deja sin saber qué corregir, cuando el arreglo está a su alcance.
    if (Number(error?.code) === FLOW_INVALID_EMAIL) {
      throw badRequest(
        'PAYER_EMAIL_INVALID',
        `La pasarela no acepta el correo ${email}. Indica otro correo para el pago.`,
        { payerEmail: email },
      );
    }
    throw error;
  }

  await pool.query(
    `UPDATE payments SET token = $2, flow_order = $3, updated_at = now() WHERE id = $1`,
    [inserted.rows[0].id, created.token, String(created.flowOrder ?? '')],
  );

  return {
    paymentId: inserted.rows[0].id,
    commerceOrder,
    amount,
    redirectUrl: created.redirectUrl,
  };
}

// Resuelve un pago a partir de un token.
//
// Éste es el corazón de la integración y su regla es una sola: la verdad la dice
// payment/getStatus, nunca el cuerpo del callback ni la URL de retorno. Un callback sólo
// aporta el token; con él se le pregunta a Flow, y se decide con esa respuesta.
//
// Es idempotente: `credited_at` bajo bloqueo de fila garantiza que el saldo se acredite
// una única vez aunque Flow reintente el aviso, que es exactamente lo que hace.
// `fetchStatus` es inyectable únicamente para poder probar la idempotencia sin cobrar
// tarjetas reales; en producción siempre es payment/getStatus de Flow.
export async function settlePaymentByToken(token, { fetchStatus = getPaymentStatus } = {}) {
  if (!token || typeof token !== 'string') {
    throw notFound('Token de pago no válido.');
  }

  const status = await fetchStatus(token);
  const flowStatus = Number(status?.status);
  const label = describeFlowStatus(flowStatus);
  const commerceOrder = status?.commerceOrder;

  if (!commerceOrder) {
    throw notFound('Flow no reconoció este token.');
  }

  return withTransaction(async (client) => {
    const found = await client.query(
      'SELECT * FROM payments WHERE commerce_order = $1 FOR UPDATE',
      [commerceOrder],
    );
    if (found.rowCount === 0) throw notFound('Orden de pago desconocida.');
    const payment = found.rows[0];

    // El monto se compara con lo que Flow dice haber cobrado: si no coinciden, no se
    // acredita nada y queda registro para revisar. Nunca se confía en el monto entrante.
    const paidAmount = Number(status?.amount);
    const amountMatches = Number.isSafeInteger(paidAmount) && paidAmount === Number(payment.amount);

    await client.query(
      `UPDATE payments
       SET status = $2, provider_status = $3::jsonb, token = COALESCE(token, $4), updated_at = now()
       WHERE id = $1`,
      [payment.id, label === 'UNKNOWN' ? payment.status : label, JSON.stringify(status), token],
    );

    if (flowStatus !== FLOW_STATUS.PAID) {
      return { credited: false, status: label, commerceOrder, alreadyCredited: false };
    }
    if (!amountMatches) {
      console.error(
        '[payments] monto informado por Flow distinto al de la orden',
        commerceOrder,
        paidAmount,
        payment.amount,
      );
      return { credited: false, status: 'AMOUNT_MISMATCH', commerceOrder, alreadyCredited: false };
    }
    // Ya acreditado: el reintento del callback no vuelve a mover saldo.
    if (payment.credited_at) {
      return { credited: false, status: 'PAID', commerceOrder, alreadyCredited: true };
    }

    await client.query('SELECT user_id FROM wallets WHERE user_id = $1 FOR UPDATE', [
      payment.user_id,
    ]);
    await client.query(
      `UPDATE wallets
       SET available_balance = available_balance + $2, updated_at = now()
       WHERE user_id = $1`,
      [payment.user_id, payment.amount],
    );
    await client.query(
      `INSERT INTO ledger_entries (user_id, entry_type, available_delta, description)
       VALUES ($1, 'DEPOSIT', $2::bigint, $3)`,
      [payment.user_id, payment.amount, `Abono confirmado por Flow · orden ${commerceOrder}`],
    );
    await client.query(
      `UPDATE payments SET credited_at = now(), updated_at = now() WHERE id = $1`,
      [payment.id],
    );

    return { credited: true, status: 'PAID', commerceOrder, alreadyCredited: false };
  });
}

export async function listPayments(userId, limit = 20) {
  const result = await pool.query(
    `SELECT id, commerce_order, amount, status, credited_at, created_at
     FROM payments
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    commerceOrder: row.commerce_order,
    amount: Number(row.amount),
    status: row.status,
    creditedAt: row.credited_at,
    createdAt: row.created_at,
  }));
}
