import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { MAX_MONEY } from '../domain/money.js';
import { asyncHandler } from '../lib/async-handler.js';
import { conflict } from '../lib/api-error.js';
import { serializeLedgerEntry, serializeWallet } from '../lib/serializers.js';
import { validate } from '../lib/validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const amountSchema = z.object({
  amount: z.number().int().positive().max(MAX_MONEY),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  '/',
  asyncHandler(async (request, response) => {
    const result = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [
      request.user.id,
    ]);
    response.json({ data: serializeWallet(result.rows[0]) });
  }),
);

router.post(
  '/deposit',
  asyncHandler(async (request, response) => {
    const { amount } = validate(amountSchema, request.body);
    const wallet = await withTransaction(async (client) => {
      const locked = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [request.user.id],
      );
      const resultingTotal =
        BigInt(locked.rows[0].available_balance) +
        BigInt(locked.rows[0].frozen_balance) +
        BigInt(amount);
      if (resultingTotal > BigInt(MAX_MONEY)) {
        throw conflict('BALANCE_LIMIT', 'El saldo excedería el máximo permitido.');
      }
      const updated = await client.query(
        `UPDATE wallets
         SET available_balance = available_balance + $2, updated_at = now()
         WHERE user_id = $1
         RETURNING *`,
        [request.user.id, amount],
      );
      await client.query(
        `INSERT INTO ledger_entries
          (user_id, entry_type, available_delta, description)
         VALUES ($1, 'DEPOSIT', $2, 'Abono simulado por el usuario')`,
        [request.user.id, amount],
      );
      return updated.rows[0];
    });
    response.json({ data: serializeWallet(wallet) });
  }),
);

router.post(
  '/withdraw',
  asyncHandler(async (request, response) => {
    const { amount } = validate(amountSchema, request.body);
    const wallet = await withTransaction(async (client) => {
      const locked = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [request.user.id],
      );
      if (locked.rows[0].available_balance < amount) {
        throw conflict(
          'INSUFFICIENT_AVAILABLE_BALANCE',
          'No tienes saldo disponible suficiente. El saldo congelado no se puede retirar.',
        );
      }
      const updated = await client.query(
        `UPDATE wallets
         SET available_balance = available_balance - $2, updated_at = now()
         WHERE user_id = $1
         RETURNING *`,
        [request.user.id, amount],
      );
      await client.query(
        `INSERT INTO ledger_entries
          (user_id, entry_type, available_delta, description)
         VALUES ($1, 'WITHDRAWAL', -$2, 'Retiro simulado por el usuario')`,
        [request.user.id, amount],
      );
      return updated.rows[0];
    });
    response.json({ data: serializeWallet(wallet) });
  }),
);

router.get(
  '/entries',
  asyncHandler(async (request, response) => {
    const { limit, offset } = validate(paginationSchema, request.query);
    const [entries, count] = await Promise.all([
      pool.query(
        `SELECT * FROM ledger_entries
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [request.user.id, limit, offset],
      ),
      pool.query('SELECT count(*)::int AS total FROM ledger_entries WHERE user_id = $1', [
        request.user.id,
      ]),
    ]);
    response.json({
      data: {
        entries: entries.rows.map(serializeLedgerEntry),
        pagination: { limit, offset, total: count.rows[0].total },
      },
    });
  }),
);

export default router;
