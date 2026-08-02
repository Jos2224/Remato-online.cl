import pg from 'pg';
import { config } from '../config.js';

const { Pool, types } = pg;

// CLP amounts are bounded to Number.MAX_SAFE_INTEGER by validation and SQL checks.
types.setTypeParser(20, (value) => Number.parseInt(value, 10));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});
