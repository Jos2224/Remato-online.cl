import { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { MAX_MONEY } from '../domain/money.js';
import { asyncHandler } from '../lib/async-handler.js';
import { conflict, forbidden, notFound, unauthorized } from '../lib/api-error.js';
import { requireAtLeastThreeMinutesAhead } from '../lib/time.js';
import { validate } from '../lib/validation.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getAuctionById, getPublicBids, listAuctions } from '../services/auction-read.js';
import {
  advanceAuctionLocked,
  synchronizeAuction,
  synchronizeDueAuctions,
} from '../services/auction-sync.js';

const router = Router();

const auctionFields = {
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(3).max(10_000),
  category: z.string().trim().min(2).max(80),
  condition: z.string().trim().min(2).max(80),
  commune: z.string().trim().min(2).max(100),
  delivery: z.string().trim().min(2).max(160),
  endsAt: z.string().trim().min(1),
};

const createSchema = z
  .object({
    ...auctionFields,
    startingPrice: z.number().int().positive().max(MAX_MONEY),
  })
  .strict();

const updateSchema = z
  .object(auctionFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debes enviar al menos un cambio.');

const bidSchema = z
  .object({ amount: z.number().int().positive().max(MAX_MONEY) })
  .strict();

const listSchema = z.object({
  status: z.enum(['ACTIVE', 'MATCHING', 'SOLD', 'NO_MATCH']).optional(),
  sellerId: z.string().uuid().optional(),
  mine: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  participating: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

function requireCommonUser(request) {
  if (request.user.role !== 'USER') {
    throw forbidden('La cuenta administradora no publica ni puja en el marketplace.');
  }
}

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (request, response) => {
    const query = validate(listSchema, request.query);
    if ((query.mine || query.participating) && !request.user) {
      throw unauthorized();
    }
    await synchronizeDueAuctions();
    const data = await listAuctions({ viewer: request.user, ...query });
    response.json({ data });
  }),
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (request, response) => {
    requireCommonUser(request);
    const input = validate(createSchema, request.body);
    const closesAt = requireAtLeastThreeMinutesAhead(input.endsAt, DateTime.utc());

    const inserted = await pool.query(
      `INSERT INTO auctions
        (seller_id, title, description, category, product_condition,
         starting_price, commune, delivery_method, closes_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        request.user.id,
        input.title,
        input.description,
        input.category,
        input.condition,
        input.startingPrice,
        input.commune,
        input.delivery,
        closesAt.toJSDate(),
      ],
    );
    const auction = await getAuctionById(inserted.rows[0].id, request.user);
    response.status(201).json({ data: { auction } });
  }),
);

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (request, response) => {
    await synchronizeAuction(request.params.id);
    const [auction, bids] = await Promise.all([
      getAuctionById(request.params.id, request.user),
      getPublicBids(request.params.id),
    ]);
    response.json({ data: { auction: { ...auction, bids } } });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    requireCommonUser(request);
    const input = validate(updateSchema, request.body);

    const outcome = await withTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
        [request.params.id],
      );
      if (result.rowCount === 0) throw notFound('Subasta no encontrada.');
      const now = new Date();
      if (result.rows[0].seller_id !== request.user.id) throw forbidden();
      const auction = await advanceAuctionLocked(client, result.rows[0], now);
      if (auction.status !== 'ACTIVE') {
        return { closed: true };
      }

      const closesAt = input.endsAt
        ? requireAtLeastThreeMinutesAhead(input.endsAt, DateTime.fromJSDate(now))
        : DateTime.fromJSDate(new Date(auction.closes_at));

      await client.query(
        `UPDATE auctions SET
           title = $2,
           description = $3,
           category = $4,
           product_condition = $5,
           commune = $6,
           delivery_method = $7,
           closes_at = $8,
           updated_at = $9
         WHERE id = $1`,
        [
          auction.id,
          input.title ?? auction.title,
          input.description ?? auction.description,
          input.category ?? auction.category,
          input.condition ?? auction.product_condition,
          input.commune ?? auction.commune,
          input.delivery ?? auction.delivery_method,
          closesAt.toJSDate(),
          now,
        ],
      );
      return { closed: false };
    });

    if (outcome.closed) {
      throw conflict('AUCTION_ALREADY_CLOSED', 'Una subasta cerrada ya no se puede editar.');
    }

    const auction = await getAuctionById(request.params.id, request.user);
    response.json({ data: { auction } });
  }),
);

router.post(
  '/:id/bids',
  requireAuth,
  asyncHandler(async (request, response) => {
    requireCommonUser(request);
    const { amount } = validate(bidSchema, request.body);

    const outcome = await withTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
        [request.params.id],
      );
      if (result.rowCount === 0) throw notFound('Subasta no encontrada.');
      const now = new Date();
      if (result.rows[0].seller_id === request.user.id) {
        throw forbidden('No puedes pujar en tu propia subasta.');
      }
      const auction = await advanceAuctionLocked(client, result.rows[0], now);
      if (auction.status !== 'ACTIVE' || new Date(auction.closes_at) <= now) {
        return { closed: true };
      }

      const highestResult = await client.query(
        `SELECT max(amount) AS highest FROM bids
         WHERE auction_id = $1 AND status = 'ACTIVE'`,
        [auction.id],
      );
      const currentPrice = highestResult.rows[0].highest ?? auction.starting_price;
      if (amount <= currentPrice) {
        throw conflict(
          'BID_TOO_LOW',
          `La puja debe ser mayor al precio actual de $${currentPrice}.`,
          { currentPrice },
        );
      }

      const existingResult = await client.query(
        `SELECT * FROM bids
         WHERE auction_id = $1 AND bidder_id = $2 AND status = 'ACTIVE'
         FOR UPDATE`,
        [auction.id, request.user.id],
      );
      const previousBid = existingResult.rows[0];
      const additionalHold = amount - (previousBid?.amount ?? 0);

      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [request.user.id],
      );
      if (walletResult.rows[0].available_balance < additionalHold) {
        throw conflict(
          'INSUFFICIENT_AVAILABLE_BALANCE',
          'No tienes saldo disponible suficiente para esta puja.',
          {
            availableBalance: walletResult.rows[0].available_balance,
            requiredAdditionalBalance: additionalHold,
          },
        );
      }

      if (previousBid) {
        await client.query(
          `UPDATE bids SET status = 'REPLACED', updated_at = $2 WHERE id = $1`,
          [previousBid.id, now],
        );
      }
      const inserted = await client.query(
        `INSERT INTO bids (auction_id, bidder_id, amount)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [auction.id, request.user.id, amount],
      );
      if (previousBid) {
        await client.query('UPDATE bids SET replaced_by_id = $2 WHERE id = $1', [
          previousBid.id,
          inserted.rows[0].id,
        ]);
      }
      await client.query(
        `UPDATE wallets
         SET available_balance = available_balance - $2,
             frozen_balance = frozen_balance + $2,
             updated_at = $3
         WHERE user_id = $1`,
        [request.user.id, additionalHold, now],
      );
      await client.query(
        `INSERT INTO ledger_entries
          (user_id, entry_type, available_delta, frozen_delta,
           auction_id, bid_id, description)
         VALUES ($1, 'BID_HOLD', -$2, $2, $3, $4, $5)`,
        [
          request.user.id,
          additionalHold,
          auction.id,
          inserted.rows[0].id,
          previousBid
            ? 'Aumento de fondos congelados al mejorar la puja'
            : 'Fondos congelados al crear una puja',
        ],
      );
      return { closed: false };
    });

    if (outcome.closed) {
      throw conflict('AUCTION_ALREADY_CLOSED', 'La subasta ya cerró.');
    }

    const [auction, bids] = await Promise.all([
      getAuctionById(request.params.id, request.user),
      getPublicBids(request.params.id),
    ]);
    response.status(201).json({ data: { auction: { ...auction, bids } } });
  }),
);

router.delete(
  '/:id/bids/mine',
  requireAuth,
  asyncHandler(async (request, response) => {
    requireCommonUser(request);

    const outcome = await withTransaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
        [request.params.id],
      );
      if (result.rowCount === 0) throw notFound('Subasta no encontrada.');
      const now = new Date();
      const auction = await advanceAuctionLocked(client, result.rows[0], now);
      if (auction.status !== 'ACTIVE' || new Date(auction.closes_at) <= now) {
        return { closed: true };
      }

      const bidResult = await client.query(
        `SELECT * FROM bids
         WHERE auction_id = $1 AND bidder_id = $2 AND status = 'ACTIVE'
         FOR UPDATE`,
        [auction.id, request.user.id],
      );
      if (bidResult.rowCount === 0) throw notFound('No tienes una puja activa en esta subasta.');
      const bid = bidResult.rows[0];

      await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [
        request.user.id,
      ]);
      const walletUpdate = await client.query(
        `UPDATE wallets
         SET available_balance = available_balance + $2,
             frozen_balance = frozen_balance - $2,
             updated_at = $3
         WHERE user_id = $1 AND frozen_balance >= $2
         RETURNING user_id`,
        [request.user.id, bid.amount, now],
      );
      if (walletUpdate.rowCount === 0) {
        throw new Error('Wallet invariant violated while withdrawing a bid');
      }
      await client.query(
        `UPDATE bids SET status = 'WITHDRAWN', updated_at = $2 WHERE id = $1`,
        [bid.id, now],
      );
      await client.query(
        `INSERT INTO ledger_entries
          (user_id, entry_type, available_delta, frozen_delta,
           auction_id, bid_id, description)
         VALUES ($1, 'BID_RELEASE', $2, -$2, $3, $4, 'Puja retirada antes del cierre')`,
        [request.user.id, bid.amount, auction.id, bid.id],
      );
      return { closed: false };
    });

    if (outcome.closed) {
      throw conflict('AUCTION_ALREADY_CLOSED', 'La puja ya no se puede retirar.');
    }

    const [auction, bids] = await Promise.all([
      getAuctionById(request.params.id, request.user),
      getPublicBids(request.params.id),
    ]);
    response.json({ data: { auction: { ...auction, bids } } });
  }),
);

export default router;
