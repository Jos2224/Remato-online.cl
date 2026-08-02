import bcrypt from 'bcryptjs';
import { config } from '../config.js';

export async function ensureAdmin(client) {
  const currentAdmin = await client.query(
    `SELECT id, email FROM users WHERE role = 'ADMIN' LIMIT 1`,
  );
  if (
    currentAdmin.rowCount > 0 &&
    currentAdmin.rows[0].email !== config.adminEmail
  ) {
    throw new Error(
      `There is already an ADMIN (${currentAdmin.rows[0].email}). ` +
        `Set ADMIN_EMAIL to that address or resolve it explicitly.`,
    );
  }

  const passwordHash = await bcrypt.hash(config.adminPassword, 12);
  const result = await client.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'ADMIN')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'ADMIN',
           updated_at = now()
     RETURNING id, email`,
    [config.adminEmail, passwordHash],
  );
  await client.query(
    `INSERT INTO wallets (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [result.rows[0].id],
  );
  return result.rows[0];
}
