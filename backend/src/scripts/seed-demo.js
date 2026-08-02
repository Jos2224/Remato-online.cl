import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { ensureAdmin } from './seed-common.js';

const DEMO_BALANCE = 500_000;
const demoUsers = ['vendedor.demo@rematoonline.cl', 'postor.demo@rematoonline.cl'];

async function ensureDemoUser(client, email, passwordHash) {
  const userResult = await client.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'USER')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           updated_at = now()
     RETURNING id, email`,
    [email, passwordHash],
  );
  const user = userResult.rows[0];
  await client.query(
    `INSERT INTO wallets (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [user.id],
  );
  await client.query('SELECT user_id FROM wallets WHERE user_id = $1 FOR UPDATE', [
    user.id,
  ]);

  const marker = `Saldo inicial del seed demo: ${email}`;
  const priorDeposit = await client.query(
    `SELECT 1 FROM ledger_entries
     WHERE user_id = $1 AND entry_type = 'DEPOSIT' AND description = $2`,
    [user.id, marker],
  );
  if (priorDeposit.rowCount === 0) {
    await client.query(
      `UPDATE wallets
       SET available_balance = available_balance + $2, updated_at = now()
       WHERE user_id = $1`,
      [user.id, DEMO_BALANCE],
    );
    await client.query(
      `INSERT INTO ledger_entries
        (user_id, entry_type, available_delta, description)
       VALUES ($1, 'DEPOSIT', $2, $3)`,
      [user.id, DEMO_BALANCE, marker],
    );
  }
  return user;
}

async function seedDemo() {
  if (config.isProduction) {
    throw new Error('The demo seed is disabled when NODE_ENV=production');
  }
  if (!config.demoPassword) {
    throw new Error(
      'DEMO_PASSWORD is not configured. Set one (min 12 chars) to create the demo accounts, ' +
        'or skip the demo seed entirely.',
    );
  }

  const passwordHash = await bcrypt.hash(config.demoPassword, 12);
  await withTransaction(async (client) => {
    await ensureAdmin(client);
    const [seller, secondUser] = await Promise.all(
      demoUsers.map((email) => ensureDemoUser(client, email, passwordHash)),
    );

    const now = DateTime.utc();
    await client.query(
      `INSERT INTO auctions
        (id, seller_id, title, description, category, product_condition,
         starting_price, commune, delivery_method, closes_at)
       VALUES
        ('10000000-0000-4000-8000-000000000001', $1,
         'Bicicleta urbana de demostración',
         'Bicicleta usada en buen estado. Esta publicación sirve para conocer el flujo de RematoOnline.',
         'Deportes', 'Usado - buen estado', 45000, 'Providencia',
         'Entrega coordinada directamente con el vendedor', $3),
        ('10000000-0000-4000-8000-000000000002', $2,
         'Escritorio de madera de demostración',
         'Escritorio firme con espacio para computador. Sin fotografías en esta versión del producto.',
         'Hogar', 'Usado', 30000, 'Ñuñoa',
         'Retiro coordinado directamente con el vendedor', $4)
       ON CONFLICT (id) DO NOTHING`,
      [seller.id, secondUser.id, now.plus({ days: 2 }).toJSDate(), now.plus({ days: 3 }).toJSDate()],
    );
  });

  console.log(`Demo ready. Users: ${demoUsers.join(', ')}`);
  console.log('Demo password comes from DEMO_PASSWORD.');
  await pool.end();
}

seedDemo().catch(async (error) => {
  console.error('Demo seed failed', error);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
