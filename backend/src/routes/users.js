import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../lib/async-handler.js';
import { notFound } from '../lib/api-error.js';
import { serializePublicUser } from '../lib/serializers.js';

const router = Router();

router.get(
  '/:id',
  asyncHandler(async (request, response) => {
    const result = await pool.query(
      `SELECT id, email, created_at, sales_count
       FROM users
       WHERE id = $1`,
      [request.params.id],
    );
    if (result.rowCount === 0) throw notFound('Usuario no encontrado.');
    response.json({ data: serializePublicUser(result.rows[0]) });
  }),
);

export default router;
