import { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { ANTI_SNIPE_WINDOW_MS, minimumIncrement, minimumNextBid } from '../domain/auction.js';
import { CATEGORIES, CONDITIONS } from '../domain/taxonomy.js';
import { stripMarkup, stripMarkupMultiline } from '../lib/sanitize.js';
import { asyncHandler } from '../lib/async-handler.js';
import { conflict, forbidden, notFound, unauthorized } from '../lib/api-error.js';
import { requireAtLeastThreeMinutesAhead } from '../lib/time.js';
import { moneySchema, validate } from '../lib/validation.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getAuctionById, getPublicBids, listAuctions } from '../services/auction-read.js';
import {
  advanceAuctionLocked,
  synchronizeAuction,
  synchronizeDueAuctions,
} from '../services/auction-sync.js';

const router = Router();

// Free text is stripped of markup before the length checks run, so padding a short
// title with tags cannot sneak past the minimum.
const cleanText = (min, max, field) =>
  z
    .string({ required_error: `Debes indicar ${field}.`, invalid_type_error: `${field} debe ser texto.` })
    .transform(stripMarkup)
    .refine((value) => value.length >= min, {
      message: `${field} debe tener al menos ${min} caracteres.`,
    })
    .refine((value) => value.length <= max, {
      message: `${field} no puede superar los ${max} caracteres.`,
    });

const auctionFields = {
  title: cleanText(3, 140, 'El título'),
  description: z
    .string({ required_error: 'Debes indicar la descripción.' })
    .transform(stripMarkupMultiline)
    .refine((value) => value.length >= 3, {
      message: 'La descripción debe tener al menos 3 caracteres.',
    })
    .refine((value) => value.length <= 10_000, {
      message: 'La descripción no puede superar los 10.000 caracteres.',
    }),
  category: z.enum(CATEGORIES, {
    errorMap: () => ({ message: `La categoría debe ser una de: ${CATEGORIES.join(', ')}.` }),
  }),
  condition: z.enum(CONDITIONS, {
    errorMap: () => ({ message: `El estado debe ser uno de: ${CONDITIONS.join(', ')}.` }),
  }),
  commune: cleanText(2, 100, 'La comuna'),
  delivery: cleanText(2, 160, 'La coordinación de entrega'),
  endsAt: z
    .string({ required_error: 'Debes indicar la fecha de cierre.' })
    .trim()
    .min(1, 'Debes indicar la fecha de cierre.'),
};

const createSchema = z
  .object({
    ...auctionFields,
    startingPrice: moneySchema('El precio inicial'),
  })
  .strict();

const updateSchema = z
  .object(auctionFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debes enviar al menos un cambio.');

const bidSchema = z.object({ amount: moneySchema('La puja') }).strict();

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
      getPublicBids(request.params.id, request.user),
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

      // Once real money is committed the closing time is frozen. Moving it in either
      // direction abuses the bidders: bringing it forward cuts the auction short while
      // a high bid is live, pushing it back keeps their funds frozen indefinitely.
      if (input.endsAt) {
        const liveBids = await client.query(
          `SELECT 1 FROM bids WHERE auction_id = $1 AND status = 'ACTIVE' LIMIT 1`,
          [auction.id],
        );
        const sameInstant =
          requireAtLeastThreeMinutesAhead(input.endsAt, DateTime.fromJSDate(now)).toMillis() ===
          new Date(auction.closes_at).getTime();
        if (liveBids.rowCount > 0 && !sameInstant) {
          return { frozen: true };
        }
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

    if (outcome.frozen) {
      throw conflict(
        'CLOSING_TIME_LOCKED',
        'La fecha de cierre queda fija cuando la subasta ya tiene pujas activas.',
      );
    }
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
      const hasBids = highestResult.rows[0].highest != null;
      const currentPrice = highestResult.rows[0].highest ?? auction.starting_price;
      // A minimum step keeps a closing auction from turning into a war of $1 raises.
      const requiredAmount = minimumNextBid(currentPrice, hasBids);
      if (amount < requiredAmount) {
        throw conflict(
          'BID_TOO_LOW',
          hasBids
            ? `La puja debe ser de al menos $${requiredAmount} (incremento mínimo $${minimumIncrement(currentPrice)}).`
            : `La puja debe ser de al menos $${requiredAmount}.`,
          { currentPrice, minimumBid: requiredAmount, minimumIncrement: minimumIncrement(currentPrice) },
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
         VALUES ($1, 'BID_HOLD', -$2::bigint, $2::bigint, $3, $4, $5)`,
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

      // Anti-sniping: a bid inside the final window pushes the close out, so the
      // previous leader always gets a chance to answer. Re-arms on every late bid.
      const remainingMs = new Date(auction.closes_at).getTime() - now.getTime();
      if (remainingMs <= ANTI_SNIPE_WINDOW_MS) {
        await client.query(
          `UPDATE auctions
           SET closes_at = $2::timestamptz, updated_at = $3
           WHERE id = $1`,
          [auction.id, new Date(now.getTime() + ANTI_SNIPE_WINDOW_MS), now],
        );
      }
      return { closed: false };
    });

    if (outcome.closed) {
      throw conflict('AUCTION_ALREADY_CLOSED', 'La subasta ya cerró.');
    }

    const [auction, bids] = await Promise.all([
      getAuctionById(request.params.id, request.user),
      getPublicBids(request.params.id, request.user),
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
         VALUES ($1, 'BID_RELEASE', $2::bigint, -$2::bigint, $3, $4, 'Puja retirada antes del cierre')`,
        [request.user.id, bid.amount, auction.id, bid.id],
      );
      return { closed: false };
    });

    if (outcome.closed) {
      throw conflict('AUCTION_ALREADY_CLOSED', 'La puja ya no se puede retirar.');
    }

    const [auction, bids] = await Promise.all([
      getAuctionById(request.params.id, request.user),
      getPublicBids(request.params.id, request.user),
    ]);
    response.json({ data: { auction: { ...auction, bids } } });
  }),
);

export default router;
