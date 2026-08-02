import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { config } from '../config.js';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest, conflict, forbidden, unauthorized } from '../lib/api-error.js';
import { mailEnabled, sendMail, verificationEmail } from '../lib/mailer.js';
import { validate } from '../lib/validation.js';
import { serializeUser, serializeWallet } from '../lib/serializers.js';
import { requireAuth, signAccessToken } from '../middleware/auth.js';

const router = Router();

const credentialsSchema = z.object({
  email: z
    .string({ required_error: 'Debes indicar tu correo.' })
    .trim()
    .email('Ingresa un correo electrónico válido.')
    .max(320, 'El correo es demasiado largo.')
    .transform((value) => value.toLowerCase()),
  password: z
    .string({ required_error: 'Debes indicar tu contraseña.' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(128, 'La contraseña no puede superar los 128 caracteres.'),
});

router.post(
  '/register',
  asyncHandler(async (request, response) => {
    const input = validate(credentialsSchema, request.body);
    if (input.email === config.adminEmail) {
      throw forbidden('Ese correo está reservado para la administración.');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    // With no mail transport configured the account is usable immediately; otherwise it
    // starts unverified and a confirmation link is sent.
    const requiresVerification = mailEnabled();
    const verificationToken = requiresVerification ? randomBytes(32).toString('hex') : null;

    const user = await withTransaction(async (client) => {
      const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [
        input.email,
      ]);
      if (existing.rowCount > 0) {
        throw conflict('EMAIL_ALREADY_EXISTS', 'Ya existe una cuenta con ese correo.');
      }

      const inserted = await client.query(
        `INSERT INTO users
          (email, password_hash, role, email_verified_at,
           email_verification_token, email_verification_sent_at)
         VALUES ($1, $2, 'USER', $3, $4, $5)
         RETURNING *`,
        [
          input.email,
          passwordHash,
          requiresVerification ? null : new Date(),
          verificationToken,
          requiresVerification ? new Date() : null,
        ],
      );
      await client.query('INSERT INTO wallets (user_id) VALUES ($1)', [inserted.rows[0].id]);
      // Crear la cuenta no exige firmar nada: mirar el catálogo no compromete a nada.
      // Los documentos se firman al publicar o al pujar, que es cuando la persona
      // asume obligaciones reales (la garantía del 10%, la cláusula penal, la entrega).
      return inserted.rows[0];
    });

    if (requiresVerification) {
      // Sent after the transaction commits: a mail failure must not roll back the account.
      await sendMail(verificationEmail(user.email, verificationToken));
    }

    response.status(201).json({
      data: {
        token: signAccessToken(user),
        user: serializeUser(user),
        requiresVerification,
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

// Confirmation link target. Idempotent: a token that was already consumed reports
// success so a double click does not look like a failure.
router.post(
  '/verify',
  asyncHandler(async (request, response) => {
    const { token } = validate(
      z.object({ token: z.string().trim().min(16, 'El enlace de confirmación no es válido.') }),
      request.body,
    );

    const result = await pool.query(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, now()),
           email_verification_token = NULL,
           updated_at = now()
       WHERE email_verification_token = $1
       RETURNING *`,
      [token],
    );
    if (result.rowCount === 0) {
      throw badRequest(
        'INVALID_VERIFICATION_TOKEN',
        'El enlace de confirmación no es válido o ya fue utilizado.',
      );
    }

    response.json({ data: { user: serializeUser(result.rows[0]), verified: true } });
  }),
);

router.post(
  '/resend-verification',
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!mailEnabled()) {
      throw conflict('MAIL_DISABLED', 'La confirmación por correo no está habilitada.');
    }
    const current = await pool.query('SELECT * FROM users WHERE id = $1', [request.user.id]);
    const user = current.rows[0];
    if (!user) throw unauthorized('La cuenta ya no existe.');
    if (user.email_verified_at) {
      return response.json({ data: { alreadyVerified: true } });
    }

    const token = randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE users
       SET email_verification_token = $2, email_verification_sent_at = now(), updated_at = now()
       WHERE id = $1`,
      [user.id, token],
    );
    await sendMail(verificationEmail(user.email, token));
    return response.json({ data: { sent: true } });
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
