import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { ensureAdmin } from './seed-common.js';

async function seed() {
  const admin = await withTransaction((client) => ensureAdmin(client));
  console.log(`Admin ready: ${admin.email}`);
  await pool.end();
}

seed().catch(async (error) => {
  console.error('Admin seed failed', error);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
