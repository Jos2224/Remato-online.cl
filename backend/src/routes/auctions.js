import express, { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { ANTI_SNIPE_WINDOW_MS, minimumIncrement, minimumNextBid } from '../domain/auction.js';
import { MAX_MONEY, holdForBid } from '../domain/money.js';
import { CATEGORIES, CONDITIONS, SHIPPING_METHODS } from '../domain/taxonomy.js';
import { stripMarkup, stripMarkupMultiline } from '../lib/sanitize.js';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/api-error.js';
import { MAX_IMAGES_PER_AUCTION, MAX_IMAGE_BYTES, deleteImage, storeImage } from '../lib/images.js';
import { mailEnabled } from '../lib/mailer.js';
import { ACCEPTANCE_CONTEXTS } from '../domain/legal.js';
import { requireAcceptance, signatureEvidence } from '../services/legal.js';
import { requireAtLeastThreeMinutesAhead } from '../lib/time.js';
import { moneySchema, validate } from '../lib/validation.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  AUCTION_SORTS,
  AUCTION_STATUSES,
  getAuctionById,
  getPublicBids,
  listAuctions,
  suggestSearchTerms,
} from '../services/auction-read.js';
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
  shippingMethod: z
    .enum(SHIPPING_METHODS, {
      errorMap: () => ({ message: 'El método de envío debe ser retiro en persona o Chilexpress.' }),
    })
    .default('PICKUP'),
  // Entero en pesos. Sólo tiene sentido con despacho; se valida más abajo.
  shippingCost: z
    .number({ invalid_type_error: 'El costo de envío debe ser un número.' })
    .int('El costo de envío debe ser un monto entero en pesos, sin decimales.')
    .min(0, 'El costo de envío no puede ser negativo.')
    .max(MAX_MONEY, 'El costo de envío supera el máximo permitido.')
    .nullish(),
};

// Un costo de despacho en una publicación de sólo retiro es incoherente, y prometer
// Chilexpress sin decir cuánto cuesta deja a quien compra sin saber el total.
const shippingIsCoherent = (value) => {
  if (value.shippingMethod === 'CHILEXPRESS') {
    return value.shippingCost != null;
  }
  return value.shippingCost == null || value.shippingCost === 0;
};
const SHIPPING_MESSAGE =
  'Si despachas por Chilexpress debes indicar el costo; si es retiro en persona, no lleva costo de envío.';

const createSchema = z
  .object({
    ...auctionFields,
    startingPrice: moneySchema('El precio inicial'),
    // Casillas marcadas al publicar. Se validan contra los documentos realmente exigidos.
    acceptedDocuments: z.array(z.string().trim().min(1)).default([]),
  })
  .strict()
  .refine(shippingIsCoherent, { message: SHIPPING_MESSAGE, path: ['shippingCost'] });

const updateSchema = z
  .object(auctionFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debes enviar al menos un cambio.')
  .refine(
    (value) => value.shippingMethod === undefined || shippingIsCoherent(value),
    { message: SHIPPING_MESSAGE, path: ['shippingCost'] },
  );

const bidSchema = z
  .object({
    amount: moneySchema('La puja'),
    acceptedDocuments: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

// Las facetas llegan como lista separada por comas ("ACTIVE,SOLD"), que es lo que sabe
// escribir un enlace compartible. Un valor que no está en el vocabulario cerrado es un
// error de quien llama, no algo que haya que ignorar en silencio.
const facetList = (allowed, label) =>
  z
    .string()
    .transform((value) => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))])
    .refine((list) => list.length > 0, `Debes indicar al menos un valor de ${label}.`)
    .refine(
      (list) => list.every((item) => allowed.includes(item)),
      `${label} debe ser uno de: ${allowed.join(', ')}.`,
    )
    .optional();

const listSchema = z
  .object({
    status: facetList(AUCTION_STATUSES, 'El estado'),
    category: facetList(CATEGORIES, 'La categoría'),
    condition: facetList(CONDITIONS, 'El estado del producto'),
    shippingMethod: facetList(SHIPPING_METHODS, 'El método de envío'),
    // 120 caracteres es holgado para buscar y corto para que nadie use el buscador como
    // canal para empujar textos largos al motor de búsqueda.
    q: z.string().trim().max(120, 'La búsqueda no puede superar los 120 caracteres.').optional(),
    priceMin: z.coerce.number().int().min(0).max(MAX_MONEY).optional(),
    priceMax: z.coerce.number().int().min(0).max(MAX_MONEY).optional(),
    sort: z.enum(Object.keys(AUCTION_SORTS)).optional(),
    sellerId: z.string().uuid().optional(),
    mine: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    participating: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (value) => value.priceMin == null || value.priceMax == null || value.priceMin <= value.priceMax,
    { message: 'El precio mínimo no puede superar al máximo.', path: ['priceMin'] },
  );

const suggestSchema = z.object({
  q: z.string().trim().min(1, 'Debes indicar qué buscar.').max(120),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

function requireCommonUser(request) {
  if (request.user.role !== 'USER') {
    throw forbidden('La cuenta administradora no publica ni puja en el marketplace.');
  }
}

// Only enforced when a mail transport exists. Without one nothing can be confirmed, so
// requiring confirmation would lock everybody out of their own marketplace.
async function requireVerifiedEmail(request) {
  if (!mailEnabled()) return;
  const result = await pool.query('SELECT email_verified_at FROM users WHERE id = $1', [
    request.user.id,
  ]);
  if (!result.rows[0]?.email_verified_at) {
    throw forbidden('Confirma tu correo antes de publicar o pujar.');
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
    const { status, ...rest } = query;
    const data = await listAuctions({ viewer: request.user, statuses: status, ...rest });
    response.json({ data });
  }),
);

// Sugerencias del buscador. Devuelve títulos y categorías reales, nunca datos de quien
// vende: el desplegable se ve sin haber iniciado sesión.
router.get(
  '/suggestions',
  asyncHandler(async (request, response) => {
    const query = validate(suggestSchema, request.query);
    response.json({ data: { suggestions: await suggestSearchTerms(query) } });
  }),
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (request, response) => {
    requireCommonUser(request);
    await requireVerifiedEmail(request);
    const input = validate(createSchema, request.body);
    const closesAt = requireAtLeastThreeMinutesAhead(input.endsAt, DateTime.utc());

    // Publicar y firmar las Reglas de Venta ocurren en la misma transacción: no puede
    // quedar una publicación sin su consentimiento asociado.
    const auctionId = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO auctions
          (seller_id, title, description, category, product_condition,
           starting_price, commune, delivery_method, closes_at,
           shipping_method, shipping_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
          input.shippingMethod,
          input.shippingMethod === 'CHILEXPRESS' ? input.shippingCost : null,
        ],
      );
      await requireAcceptance(
        {
          userId: request.user.id,
          context: ACCEPTANCE_CONTEXTS.PUBLISH,
          accepted: input.acceptedDocuments,
          auctionId: inserted.rows[0].id,
          evidence: signatureEvidence(request),
        },
        client,
      );
      return inserted.rows[0].id;
    });
    const auction = await getAuctionById(auctionId, request.user);
    response.status(201).json({ data: { auction } });
  }),
);

// Optional product image, one per auction. Raw binary rather than multipart: it needs no
// extra dependency and the format is decided by the file's magic bytes, not by the
// client-declared content type.
async function requireOwnedAuction(request) {
  const owned = await pool.query('SELECT seller_id FROM auctions WHERE id = $1', [
    request.params.id,
  ]);
  if (owned.rowCount === 0) throw notFound('Subasta no encontrada.');
  if (owned.rows[0].seller_id !== request.user.id) throw forbidden();
}

// Append one photo. Each call adds an image to the end of the gallery rather than
// replacing it, so the seller builds the set up one shot at a time.
router.post(
  '/:id/images',
  requireAuth,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_IMAGE_BYTES }),
  asyncHandler(async (request, response) => {
    requireCommonUser(request);
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      throw badRequest('IMAGE_REQUIRED', 'Envía una imagen JPG, PNG o WebP.');
    }
    await requireOwnedAuction(request);

    const count = await pool.query(
      'SELECT count(*)::int AS total FROM auction_images WHERE auction_id = $1',
      [request.params.id],
    );
    if (count.rows[0].total >= MAX_IMAGES_PER_AUCTION) {
      throw conflict(
        'IMAGE_LIMIT_REACHED',
        `Puedes subir hasta ${MAX_IMAGES_PER_AUCTION} fotos por subasta.`,
      );
    }

    const stored = await storeImage(request.body);
    if (!stored) {
      throw badRequest('IMAGE_INVALID', 'El archivo no es una imagen JPG, PNG o WebP válida.');
    }

    await pool.query(
      `INSERT INTO auction_images (auction_id, filename, position)
       VALUES ($1, $2, COALESCE((SELECT max(position) + 1 FROM auction_images WHERE auction_id = $1), 0))`,
      [request.params.id, stored.filename],
    );
    await pool.query('UPDATE auctions SET updated_at = now() WHERE id = $1', [request.params.id]);

    const auction = await getAuctionById(request.params.id, request.user);
    response.status(201).json({ data: { auction } });
  }),
);

router.delete(
  '/:id/images/:imageId',
  requireAuth,
  asyncHandler(async (request, response) => {
    await requireOwnedAuction(request);

    const removed = await pool.query(
      'DELETE FROM auction_images WHERE id = $1 AND auction_id = $2 RETURNING filename',
      [request.params.imageId, request.params.id],
    );
    if (removed.rowCount === 0) throw notFound('Foto no encontrada.');

    await pool.query('UPDATE auctions SET updated_at = now() WHERE id = $1', [request.params.id]);
    // Remove the file only after the row is gone, so a failure never leaves a listing
    // pointing at something that no longer exists.
    await deleteImage(removed.rows[0].filename);

    const auction = await getAuctionById(request.params.id, request.user);
    response.json({ data: { auction } });
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
      const nextShippingMethod = input.shippingMethod ?? auction.shipping_method;
      const nextShippingCost =
        input.shippingCost !== undefined ? input.shippingCost : auction.shipping_cost;

      await client.query(
        `UPDATE auctions SET
           title = $2,
           description = $3,
           category = $4,
           product_condition = $5,
           commune = $6,
           delivery_method = $7,
           closes_at = $8,
           updated_at = $9,
           shipping_method = $10,
           shipping_cost = $11
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
          nextShippingMethod,
          nextShippingMethod === 'CHILEXPRESS' ? nextShippingCost : null,
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
    await requireVerifiedEmail(request);
    const input = validate(bidSchema, request.body);
    const { amount } = input;

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

      // Las Reglas de Compra se firman en la misma transacción que congela el dinero:
      // la garantía del 10% es una cláusula penal y sólo obliga si consta el acuerdo.
      await requireAcceptance(
        {
          userId: request.user.id,
          context: ACCEPTANCE_CONTEXTS.BID,
          accepted: input.acceptedDocuments,
          auctionId: auction.id,
          evidence: signatureEvidence(request),
        },
        client,
      );

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
      // Only a deposit is frozen, so improving a bid only tops the deposit up.
      const holdAmount = holdForBid(amount);
      const previousHold = previousBid ? Number(previousBid.held_amount) : 0;
      const additionalHold = holdAmount - previousHold;

      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [request.user.id],
      );
      if (walletResult.rows[0].available_balance < additionalHold) {
        throw conflict(
          'INSUFFICIENT_AVAILABLE_BALANCE',
          `Necesitas $${additionalHold} disponibles como garantía para esta puja.`,
          {
            availableBalance: walletResult.rows[0].available_balance,
            requiredAdditionalBalance: additionalHold,
            holdAmount,
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
        `INSERT INTO bids (auction_id, bidder_id, amount, held_amount)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [auction.id, request.user.id, amount, holdAmount],
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
      const heldAmount = Number(bid.held_amount);
      const walletUpdate = await client.query(
        `UPDATE wallets
         SET available_balance = available_balance + $2,
             frozen_balance = frozen_balance - $2,
             updated_at = $3
         WHERE user_id = $1 AND frozen_balance >= $2
         RETURNING user_id`,
        [request.user.id, heldAmount, now],
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
         VALUES ($1, 'BID_RELEASE', $2::bigint, -$2::bigint, $3, $4, 'Garantía liberada al retirar la puja antes del cierre')`,
        [request.user.id, heldAmount, auction.id, bid.id],
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
