import express, { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { asyncHandler } from '../lib/async-handler.js';
import { conflict } from '../lib/api-error.js';
import { flowEnabled } from '../lib/flow.js';
import { moneySchema, validate } from '../lib/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { listPayments, settlePaymentByToken, startDeposit } from '../services/payments.js';

const router = Router();

const requireFlow = () => {
  if (!flowEnabled()) {
    throw conflict('PAYMENTS_DISABLED', 'Los pagos con tarjeta no están habilitados.');
  }
};

// Inicia el abono y devuelve la URL a la que el navegador debe ir.
router.post(
  '/flow/deposit',
  requireAuth,
  asyncHandler(async (request, response) => {
    requireFlow();
    const { amount } = validate(z.object({ amount: moneySchema('El monto') }), request.body);
    const started = await startDeposit({ user: request.user, amount });
    response.status(201).json({ data: started });
  }),
);

// Aviso servidor a servidor. ESTA es la única vía en la que se acredita saldo.
//
// Flow envía sólo un token por POST. No se confía en nada de este cuerpo salvo el token,
// y con él se le pregunta a Flow por el estado real. Flow reintenta este aviso, por lo
// que el manejador es idempotente por diseño.
//
// Va sin autenticación de sesión a propósito: quien llama es Flow, no una persona. La
// seguridad no está en quién llama, sino en que el token debe ser válido para Flow y en
// que el resultado se pide directamente a Flow.
router.post(
  '/flow/confirm',
  express.urlencoded({ extended: false }),
  asyncHandler(async (request, response) => {
    requireFlow();
    const token = request.body?.token;
    if (!token) {
      // Se responde 200 igual: un 4xx haría que Flow reintente eternamente algo que
      // nunca va a mejorar.
      console.error('[payments] confirmación de Flow sin token');
      return response.status(200).send('OK');
    }

    try {
      const result = await settlePaymentByToken(String(token));
      console.log(
        `[payments] confirmación ${result.commerceOrder}: ${result.status}` +
          (result.credited ? ' (acreditado)' : result.alreadyCredited ? ' (ya acreditado)' : ''),
      );
    } catch (error) {
      // Un fallo transitorio (Flow caído, base ocupada) sí debe reintentarse.
      console.error('[payments] no se pudo resolver la confirmación', error?.message ?? error);
      return response.status(500).send('RETRY');
    }
    return response.status(200).send('OK');
  }),
);

// Donde aterriza el navegador después de pagar.
//
// No decide nada: sólo consulta el estado y redirige a la página de resultado. Marcar un
// pago como recibido aquí sería regalar saldo, porque esta URL la puede visitar cualquiera.
router.all(
  '/flow/return',
  express.urlencoded({ extended: false }),
  asyncHandler(async (request, response) => {
    const token = request.body?.token ?? request.query?.token;
    const base = `${config.appUrl.replace(/\/$/, '')}/cuenta`;

    if (!token) return response.redirect(`${base}?pago=desconocido`);

    try {
      // Se resuelve también aquí por comodidad: si el aviso servidor a servidor aún no
      // llegó, la persona ve su saldo actualizado igual. La idempotencia hace que sea
      // seguro que ambos caminos se ejecuten.
      const result = await settlePaymentByToken(String(token));
      const outcome =
        result.credited || result.alreadyCredited ? 'exito' : result.status.toLowerCase();
      return response.redirect(`${base}?pago=${encodeURIComponent(outcome)}`);
    } catch (error) {
      console.error('[payments] retorno no resuelto', error?.message ?? error);
      return response.redirect(`${base}?pago=pendiente`);
    }
  }),
);

router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json({
      data: { payments: await listPayments(request.user.id), enabled: flowEnabled() },
    });
  }),
);

export default router;
