import { Router } from 'express';
import { DateTime } from 'luxon';
import { pool } from '../db/pool.js';
import { config } from '../config.js';

const router = Router();

// Deliberately NOT wrapped in asyncHandler: a database outage must not surface as the
// generic 500 "Ocurrió un error interno." that every other bug produces. The health
// endpoint answers even when the database is gone, and says so explicitly, so an
// operator can tell a dependency failure apart from an application defect.
router.get('/', async (_request, response) => {
  const startedAt = process.hrtime.bigint();
  let database = { status: 'ok' };

  try {
    await pool.query('SELECT 1');
  } catch (error) {
    database = {
      status: 'down',
      // The driver's real error code (ECONNREFUSED, 57P03, …) is the actionable part.
      code: error?.code ?? null,
      message: error?.message ?? 'Unknown database error',
    };
  }

  database.latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const healthy = database.status === 'ok';
  const now = DateTime.utc();

  if (!healthy) {
    console.error('[health] database check failed', database.code, database.message);
  }

  response.status(healthy ? 200 : 503).json({
    data: {
      status: healthy ? 'ok' : 'degraded',
      checks: { database },
      utcNow: now.toISO(),
      chileNow: now.setZone(config.chileTimeZone).toISO(),
      timeZone: config.chileTimeZone,
    },
  });
});

export default router;
