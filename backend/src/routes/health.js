import { Router } from 'express';
import { DateTime } from 'luxon';
import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    await pool.query('SELECT 1');
    const now = DateTime.utc();
    response.json({
      data: {
        status: 'ok',
        utcNow: now.toISO(),
        chileNow: now.setZone(config.chileTimeZone).toISO(),
        timeZone: config.chileTimeZone,
      },
    });
  }),
);

export default router;
