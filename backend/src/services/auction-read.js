import { pool } from '../db/pool.js';
import { notFound } from '../lib/api-error.js';
import { isAdmin, maskEmail, publicAlias } from '../lib/privacy.js';
import { imageUrlFor } from '../lib/images.js';

// Se construye como función porque la portada necesita añadir la tabla de búsqueda y su
// columna de relevancia sin duplicar los joins de abajo.
const auctionSelect = (extraColumns = '', extraJoins = '') => `
  SELECT
    a.*,
    seller.email AS seller_email,
    seller.created_at AS seller_created_at,
    seller.sales_count AS seller_sales_count,
    COALESCE(bid_stats.bid_count, 0)::int AS bid_count,
    CASE
      WHEN a.status = 'SOLD' THEN sale.gross_amount
      WHEN a.status = 'MATCHING' THEN COALESCE(current_match.offered_amount, bid_stats.active_max, a.starting_price)
      WHEN a.status = 'ACTIVE' THEN COALESCE(bid_stats.active_max, a.starting_price)
      ELSE COALESCE(bid_stats.historical_max, a.starting_price)
    END AS current_price,
    sale.gross_amount AS sold_price,
    sale.buyer_id AS winning_bidder_id,
    buyer.email AS winning_bidder_email,
    my_bid.id AS my_bid_id,
    my_bid.amount AS my_bid_amount,
    my_bid.status AS my_bid_status,
    my_bid.created_at AS my_bid_created_at,
    current_match.id AS current_match_id,
    current_match.candidate_id AS current_match_candidate_id,
    candidate.email AS current_match_candidate_email,
    current_match.position AS current_match_position,
    current_match.offered_amount AS current_match_amount,
    current_match.started_at AS current_match_started_at,
    current_match.expires_at AS current_match_expires_at,
    COALESCE(gallery.images, '[]'::json) AS images${extraColumns ? `,\n    ${extraColumns}` : ''}
  FROM auctions a
  JOIN users seller ON seller.id = a.seller_id
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE status NOT IN ('REPLACED', 'WITHDRAWN')) AS bid_count,
      max(amount) FILTER (WHERE status = 'ACTIVE') AS active_max,
      max(amount) FILTER (WHERE status NOT IN ('REPLACED', 'WITHDRAWN')) AS historical_max
    FROM bids
    WHERE auction_id = a.id
  ) bid_stats ON true
  LEFT JOIN LATERAL (
    SELECT *
    FROM auction_matches
    WHERE auction_id = a.id AND status = 'PENDING'
    LIMIT 1
  ) current_match ON true
  LEFT JOIN users candidate ON candidate.id = current_match.candidate_id
  LEFT JOIN sales sale ON sale.auction_id = a.id
  LEFT JOIN users buyer ON buyer.id = sale.buyer_id
  LEFT JOIN LATERAL (
    SELECT json_agg(
             json_build_object('id', image.id, 'filename', image.filename)
             ORDER BY image.position, image.created_at
           ) AS images
    FROM auction_images image
    WHERE image.auction_id = a.id
  ) gallery ON true
  LEFT JOIN LATERAL (
    SELECT id, amount, status, created_at
    FROM bids
    WHERE auction_id = a.id
      AND bidder_id = $1
      AND status NOT IN ('REPLACED', 'WITHDRAWN')
    ORDER BY created_at DESC
    LIMIT 1
  ) my_bid ON true
  ${extraJoins}
`;

const iso = (value) => (value ? new Date(value).toISOString() : null);

export function serializeBid(row, viewer) {
  // The bid history is public, the bidders are not: a full address here is both
  // personal data and an invitation to close the deal off-platform.
  const isOwnBid = viewer?.id === row.bidder_id;
  const privileged = isOwnBid || isAdmin(viewer);

  return {
    id: row.id,
    amount: Number(row.amount),
    status: row.status,
    bidder: {
      id: row.bidder_id,
      alias: publicAlias(row.bidder_id),
      ...(privileged ? { email: row.bidder_email } : {}),
      isMe: Boolean(isOwnBid),
    },
    createdAt: iso(row.created_at),
  };
}

export function serializeAuction(row, viewer) {
  const isOwner = viewer?.id === row.seller_id;
  const isActiveInTime = row.status === 'ACTIVE' && new Date(row.closes_at) > new Date();
  const admin = isAdmin(viewer);
  // The winner's address is shared only with the two parties to the sale (and the
  // administrator), never with anonymous visitors browsing a sold listing.
  const isWinner = viewer?.id && viewer.id === row.winning_bidder_id;
  const canSeeCounterparty = isOwner || isWinner || admin;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.product_condition,
    startingPrice: Number(row.starting_price),
    currentPrice: Number(row.current_price),
    commune: row.commune,
    delivery: row.delivery_method,
    // Método declarado por quien vende. De esto depende el sello que ve quien compra,
    // por eso es un valor cerrado y no el texto libre de `delivery`.
    shippingMethod: row.shipping_method ?? 'PICKUP',
    shippingCost: row.shipping_cost == null ? null : Number(row.shipping_cost),
    shippingTrackingCode: row.shipping_tracking_code ?? null,
    // Optional gallery: an empty array when the seller published without photos.
    images: (row.images ?? []).map((image) => ({
      id: image.id,
      url: imageUrlFor(image.filename),
    })),
    // The lead photo, kept as a convenience for cards and previews.
    imageUrl: row.images?.[0] ? imageUrlFor(row.images[0].filename) : null,
    endsAt: iso(row.closes_at),
    status: row.status,
    bidCount: Number(row.bid_count),
    seller: {
      id: row.seller_id,
      alias: publicAlias(row.seller_id),
      // Only the seller themselves, the buyer of a closed sale, and the admin get the
      // real address. Everyone else sees the alias and, once sold, a masked hint.
      ...(isOwner || admin ? { email: row.seller_email } : {}),
      ...(isWinner ? { email: maskEmail(row.seller_email) } : {}),
      createdAt: iso(row.seller_created_at),
      salesCount: row.seller_sales_count,
    },
    myBid: row.my_bid_id
      ? {
          id: row.my_bid_id,
          amount: Number(row.my_bid_amount),
          status: row.my_bid_status,
          createdAt: iso(row.my_bid_created_at),
        }
      : null,
    currentMatch: row.current_match_id
      ? {
          id: row.current_match_id,
          candidateId: row.current_match_candidate_id,
          candidateAlias: publicAlias(row.current_match_candidate_id),
          // The seller needs to know who is deciding; the public does not.
          ...(isOwner || admin || viewer?.id === row.current_match_candidate_id
            ? { candidateEmail: row.current_match_candidate_email }
            : {}),
          position: row.current_match_position,
          amount: Number(row.current_match_amount),
          startedAt: iso(row.current_match_started_at),
          expiresAt: iso(row.current_match_expires_at),
          isMine: viewer?.id === row.current_match_candidate_id,
        }
      : null,
    winningBidderId: row.winning_bidder_id ?? null,
    winningBidderAlias: row.winning_bidder_id ? publicAlias(row.winning_bidder_id) : null,
    winningBidderEmail: canSeeCounterparty ? (row.winning_bidder_email ?? null) : null,
    canEdit: Boolean(isOwner && isActiveInTime),
    canBid: Boolean(viewer?.role === 'USER' && !isOwner && isActiveInTime),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function getAuctionById(auctionId, viewer, db = pool) {
  const result = await db.query(`${auctionSelect()} WHERE a.id = $2`, [
    viewer?.id ?? null,
    auctionId,
  ]);
  if (result.rowCount === 0) throw notFound('Subasta no encontrada.');
  return serializeAuction(result.rows[0], viewer);
}

export async function getPublicBids(auctionId, viewer, db = pool) {
  const result = await db.query(
    `SELECT b.*, u.email AS bidder_email
     FROM bids b
     JOIN users u ON u.id = b.bidder_id
     WHERE b.auction_id = $1
       AND b.status NOT IN ('REPLACED', 'WITHDRAWN')
     ORDER BY b.amount DESC, b.created_at ASC`,
    [auctionId],
  );
  return result.rows.map((row) => serializeBid(row, viewer));
}


export const AUCTION_STATUSES = Object.freeze(['ACTIVE', 'MATCHING', 'SOLD', 'NO_MATCH']);

// El orden por defecto de la portada: primero lo que todavía acepta ofertas, y dentro de
// eso lo que cierra antes. Es la única lista donde la urgencia importa más que la fecha.
const URGENCY_ORDER = `
  CASE status WHEN 'ACTIVE' THEN 0 WHEN 'MATCHING' THEN 1 ELSE 2 END,
  CASE WHEN status = 'ACTIVE' THEN closes_at END ASC,
  CASE WHEN status <> 'ACTIVE' THEN updated_at END DESC,
  created_at DESC
`;

export const AUCTION_SORTS = Object.freeze({
  relevance: `relevance DESC NULLS LAST, ${URGENCY_ORDER}`,
  closing: URGENCY_ORDER,
  newest: 'created_at DESC',
  // NULLS LAST porque una venta sin monto registrado no es "lo más caro": sin esto se
  // colaba a la cabeza de la lista al ordenar de mayor a menor.
  priceAsc: 'current_price ASC NULLS LAST, closes_at ASC',
  priceDesc: 'current_price DESC NULLS LAST, closes_at ASC',
  bids: 'bid_count DESC, closes_at ASC',
});

// Un `%` o un `_` escritos por quien busca son literales, no comodines: si no se escapan,
// buscar "50_" devuelve media base.
const escapeLike = (term) => term.replace(/([\\%_])/g, '\\$1');

/**
 * Acumula parámetros posicionales para que las condiciones puedan escribirse en cualquier
 * orden sin llevar la cuenta de los `$n` a mano.
 */
function parameters(initial = []) {
  const values = [...initial];
  return {
    values,
    add(value) {
      values.push(value);
      return `$${values.length}`;
    },
  };
}

const clauses = (conditions) => {
  const present = conditions.filter(Boolean);
  return present.length > 0 ? `WHERE ${present.join(' AND ')}` : '';
};

export async function listAuctions({
  viewer,
  status,
  statuses,
  sellerId,
  mine,
  participating,
  q,
  category,
  condition,
  shippingMethod,
  priceMin,
  priceMax,
  sort,
  limit,
  offset,
}) {
  const parameter = parameters([viewer?.id ?? null]);
  const term = typeof q === 'string' ? q.trim() : '';

  // --- Condiciones que definen el conjunto sobre el que se cuenta todo -----------------
  // Van dentro del CTE porque acotan "de qué estamos hablando". Los filtros de las facetas
  // van fuera, para que cada faceta pueda contarse ignorándose a sí misma.
  const base = [];
  let relevanceColumn = '0::float4 AS relevance';
  let searchJoin = '';

  if (term) {
    const needle = parameter.add(term);
    searchJoin = 'LEFT JOIN auction_search search ON search.auction_id = a.id';
    // Tres formas de encontrar lo mismo, porque quien busca falla de tres maneras
    // distintas: escribe bien pero con otra flexión ("camiones" → "camión"), escribe con
    // una errata ("guitara"), o escribe a medias porque va tecleando ("guit").
    base.push(`(
      search.search_vector @@ websearch_to_tsquery('spanish', remato_unaccent(lower(${needle})))
      OR remato_unaccent(lower(${needle})) <% search.search_terms
      OR search.search_terms LIKE '%' || remato_unaccent(lower(${parameter.add(escapeLike(term))})) || '%' ESCAPE '\\'
    )`);
    // El texto completo manda sobre el parecido tipográfico: una coincidencia real vale
    // más que una errata que se le parece.
    relevanceColumn = `(
      ts_rank(
        COALESCE(search.search_vector, ''::tsvector),
        websearch_to_tsquery('spanish', remato_unaccent(lower(${needle})))
      ) * 4
      + word_similarity(remato_unaccent(lower(${needle})), COALESCE(search.search_terms, ''))
    )::float4 AS relevance`;
  }

  if (sellerId) base.push(`a.seller_id = ${parameter.add(sellerId)}`);
  if (mine) base.push(`a.seller_id = ${parameter.add(viewer.id)}`);
  if (participating) {
    base.push(`EXISTS (
      SELECT 1 FROM bids viewer_bid
      WHERE viewer_bid.auction_id = a.id
        AND viewer_bid.bidder_id = ${parameter.add(viewer.id)}
        AND viewer_bid.status NOT IN ('REPLACED', 'WITHDRAWN')
    )`);
  }

  const listing = `${auctionSelect(relevanceColumn, searchJoin)} ${clauses(base)}`;

  // --- Filtros de faceta, aplicados por fuera ----------------------------------------
  const selectedStatuses = (statuses?.length ? statuses : status ? [status] : []).filter((value) =>
    AUCTION_STATUSES.includes(value),
  );
  const statusFilter = selectedStatuses.length
    ? `status = ANY(${parameter.add(selectedStatuses)})`
    : null;
  const categoryFilter = category?.length ? `category = ANY(${parameter.add(category)})` : null;
  const conditionFilter = condition?.length
    ? `product_condition = ANY(${parameter.add(condition)})`
    : null;
  const shippingFilter = shippingMethod?.length
    ? `shipping_method = ANY(${parameter.add(shippingMethod)})`
    : null;
  // El precio se filtra por el precio vigente (la puja más alta), no por el inicial: es el
  // número que quien mira tiene delante en la tarjeta.
  const priceFilter = [
    priceMin != null ? `current_price >= ${parameter.add(priceMin)}` : null,
    priceMax != null ? `current_price <= ${parameter.add(priceMax)}` : null,
  ]
    .filter(Boolean)
    .join(' AND ');

  const facetFilters = {
    status: statusFilter,
    category: categoryFilter,
    condition: conditionFilter,
    shipping: shippingFilter,
    price: priceFilter || null,
  };
  const allFilters = Object.values(facetFilters);
  // Cada faceta se cuenta con todos los filtros puestos MENOS el suyo. Es lo que hace que
  // los números de la barra lateral sigan siendo útiles después de marcar una casilla:
  // "Vendidas (12)" tiene que seguir diciendo cuántas habría si cambiaras de estado.
  const excluding = (name) => clauses(allFilters.filter((filter) => filter !== facetFilters[name]));

  const order = AUCTION_SORTS[sort] ?? (term ? AUCTION_SORTS.relevance : AUCTION_SORTS.closing);
  // La consulta de facetas no pagina, así que no puede recibir los parámetros de la
  // página: Postgres rechaza un bind con más parámetros de los que el enunciado usa.
  const facetValues = [...parameter.values];
  const limitParameter = parameter.add(limit);
  const offsetParameter = parameter.add(offset);

  const [rows, facetRows] = await Promise.all([
    pool.query(
      `WITH listing AS (${listing})
       SELECT *, count(*) OVER ()::int AS total_count
       FROM listing
       ${clauses(allFilters)}
       ORDER BY ${order}
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      parameter.values,
    ),
    pool.query(
      `WITH listing AS (${listing})
       SELECT 'status' AS facet, status AS value, count(*)::int AS total
         FROM listing ${excluding('status')} GROUP BY status
       UNION ALL
       SELECT 'category', category, count(*)::int
         FROM listing ${excluding('category')} GROUP BY category
       UNION ALL
       SELECT 'condition', product_condition, count(*)::int
         FROM listing ${excluding('condition')} GROUP BY product_condition
       UNION ALL
       SELECT 'shipping', shipping_method, count(*)::int
         FROM listing ${excluding('shipping')} GROUP BY shipping_method`,
      facetValues,
    ),
  ]);

  // El total real lo trae la ventana sobre el conjunto filtrado; cuando la página viene
  // vacía no hay fila que lo cargue, y entonces el total es cero por definición.
  const total = rows.rows[0]?.total_count ?? 0;

  const facets = { status: {}, category: {}, condition: {}, shipping: {} };
  for (const row of facetRows.rows) {
    if (row.value == null) continue;
    facets[row.facet][row.value] = row.total;
  }

  return {
    auctions: rows.rows.map((row) => serializeAuction(row, viewer)),
    facets,
    pagination: { limit, offset, total },
  };
}

/**
 * Sugerencias del buscador: lo que se ofrece mientras se teclea.
 *
 * Devuelve títulos reales del catálogo y categorías con su recuento; nunca nombres,
 * correos ni comunas de quien vende, porque el desplegable se ve sin sesión iniciada y
 * un buscador que autocompleta personas es un directorio de usuarios disfrazado.
 */
export async function suggestSearchTerms({ q, limit }) {
  const term = q.trim();
  if (!term) return [];

  const needle = `remato_unaccent(lower($1))`;
  const matches = `(
    search.search_vector @@ websearch_to_tsquery('spanish', ${needle})
    OR ${needle} <% search.search_terms
    OR search.search_terms LIKE '%' || remato_unaccent(lower($2)) || '%' ESCAPE '\\'
  )`;

  const result = await pool.query(
    `WITH matched AS (
       SELECT a.id, a.title, a.category, a.status, search.search_terms
       FROM auctions a
       JOIN auction_search search ON search.auction_id = a.id
       WHERE ${matches}
     )
     SELECT * FROM (
       SELECT
         'auction' AS kind,
         title AS label,
         id::text AS value,
         NULL::int AS total,
         -- Lo que todavía acepta ofertas se ofrece primero: sugerir una subasta cerrada
         -- es mandar a quien busca a una página donde no puede hacer nada.
         (CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END)::float4
           + word_similarity(remato_unaccent(lower($1)), search_terms) AS score
       FROM matched
       ORDER BY score DESC
       LIMIT $3
     ) titles
     UNION ALL
     SELECT * FROM (
       SELECT 'category' AS kind, category AS label, category AS value,
              count(*)::int AS total, 0::float4 AS score
       FROM matched
       GROUP BY category
       ORDER BY count(*) DESC
       LIMIT 3
     ) categories`,
    [term, escapeLike(term), limit],
  );

  return result.rows.map((row) => ({
    kind: row.kind,
    label: row.label,
    value: row.value,
    ...(row.total == null ? {} : { count: row.total }),
  }));
}
