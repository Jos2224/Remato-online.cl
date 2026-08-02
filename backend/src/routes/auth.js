import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { config } from '../config.js';
import { asyncHandler } from '../lib/async-handler.js';
import { conflict, forbidden, unauthorized } from '../lib/api-error.js';
import { validate } from '../lib/validation.js';
import { serializeUser, serializeWallet } from '../lib/serializers.js';
import { requireAuth, signAccessToken } from '../middleware/auth.js';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

router.post(
  '/register',
  asyncHandler(async (request, response) => {
    const input = validate(credentialsSchema, request.body);
    if (input.email === config.adminEmail) {
      throw forbidden('Ese correo está reservado para la administración.');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await withTransaction(async (client) => {
      const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [
        input.email,
      ]);
      if (existing.rowCount > 0) {
        throw conflict('EMAIL_ALREADY_EXISTS', 'Ya existe una cuenta con ese correo.');
      }

      const inserted = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'USER')
         RETURNING *`,
        [input.email, passwordHash],
      );
      await client.query('INSERT INTO wallets (user_id) VALUES ($1)', [inserted.rows[0].id]);
      return inserted.rows[0];
    });

    response.status(201).json({
      data: {
        token: signAccessToken(user),
        user: serializeUser(user),
      },
    });
  }),
);

router.post(
  '/login',
  asyncHandler(async (request, response) => {
    const input = validate(credentialsSchema, request.body);
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [input.email]);
    const user = result.rows[0];
    const passwordMatches = user && (await bcrypt.compare(input.password, user.password_hash));

    if (!passwordMatches) {
      throw unauthorized('Correo o contraseña incorrectos.');
    }

    response.json({
      data: {
        token: signAccessToken(user),
        user: serializeUser(user),
      },
    });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (request, response) => {
    const result = await pool.query(
      `SELECT u.*, w.available_balance, w.frozen_balance, w.updated_at AS wallet_updated_at
       FROM users u
       JOIN wallets w ON w.user_id = u.id
       WHERE u.id = $1`,
      [request.user.id],
    );
    const row = result.rows[0];
    if (!row) throw unauthorized('La cuenta ya no existe.');

    response.json({
      data: {
        user: serializeUser(row),
        wallet: serializeWallet({
          available_balance: row.available_balance,
          frozen_balance: row.frozen_balance,
          updated_at: row.wallet_updated_at,
        }),
      },
    });
  }),
);

export default router;
