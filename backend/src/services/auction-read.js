import { pool } from '../db/pool.js';
import { notFound } from '../lib/api-error.js';

const auctionSelect = `
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
    current_match.expires_at AS current_match_expires_at
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
    SELECT id, amount, status, created_at
    FROM bids
    WHERE auction_id = a.id
      AND bidder_id = $1
      AND status NOT IN ('REPLACED', 'WITHDRAWN')
    ORDER BY created_at DESC
    LIMIT 1
  ) my_bid ON true
`;

const iso = (value) => (value ? new Date(value).toISOString() : null);

export function serializeBid(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    status: row.status,
    bidder: {
      id: row.bidder_id,
      email: row.bidder_email,
    },
    createdAt: iso(row.created_at),
  };
}

export function serializeAuction(row, viewer) {
  const isOwner = viewer?.id === row.seller_id;
  const isActiveInTime = row.status === 'ACTIVE' && new Date(row.closes_at) > new Date();

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
    endsAt: iso(row.closes_at),
    status: row.status,
    bidCount: Number(row.bid_count),
    seller: {
      id: row.seller_id,
      email: row.seller_email,
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
          candidateEmail: row.current_match_candidate_email,
          position: row.current_match_position,
          amount: Number(row.current_match_amount),
          startedAt: iso(row.current_match_started_at),
          expiresAt: iso(row.current_match_expires_at),
          isMine: viewer?.id === row.current_match_candidate_id,
        }
      : null,
    winningBidderEmail: row.winning_bidder_email ?? null,
    canEdit: Boolean(isOwner && isActiveInTime),
    canBid: Boolean(viewer?.role === 'USER' && !isOwner && isActiveInTime),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function getAuctionById(auctionId, viewer, db = pool) {
  const result = await db.query(`${auctionSelect} WHERE a.id = $2`, [
    viewer?.id ?? null,
    auctionId,
  ]);
  if (result.rowCount === 0) throw notFound('Subasta no encontrada.');
  return serializeAuction(result.rows[0], viewer);
}

export async function getPublicBids(auctionId, db = pool) {
  const result = await db.query(
    `SELECT b.*, u.email AS bidder_email
     FROM bids b
     JOIN users u ON u.id = b.bidder_id
     WHERE b.auction_id = $1
       AND b.status NOT IN ('REPLACED', 'WITHDRAWN')
     ORDER BY b.amount DESC, b.created_at ASC`,
    [auctionId],
  );
  return result.rows.map(serializeBid);
}

export async function listAuctions({
  viewer,
  status,
  sellerId,
  mine,
  participating,
  limit,
  offset,
}) {
  const conditions = [];
  const countConditions = [];
  const values = [viewer?.id ?? null];
  const countValues = [];
  if (status) {
    values.push(status);
    conditions.push(`a.status = $${values.length}`);
    countValues.push(status);
    countConditions.push(`a.status = $${countValues.length}`);
  }
  if (sellerId) {
    values.push(sellerId);
    conditions.push(`a.seller_id = $${values.length}`);
    countValues.push(sellerId);
    countConditions.push(`a.seller_id = $${countValues.length}`);
  }
  if (mine) {
    values.push(viewer.id);
    conditions.push(`a.seller_id = $${values.length}`);
    countValues.push(viewer.id);
    countConditions.push(`a.seller_id = $${countValues.length}`);
  }
  if (participating) {
    values.push(viewer.id);
    conditions.push(
      `EXISTS (
        SELECT 1 FROM bids viewer_bid
        WHERE viewer_bid.auction_id = a.id
          AND viewer_bid.bidder_id = $${values.length}
          AND viewer_bid.status NOT IN ('REPLACED', 'WITHDRAWN')
      )`,
    );
    countValues.push(viewer.id);
    countConditions.push(
      `EXISTS (
        SELECT 1 FROM bids viewer_bid
        WHERE viewer_bid.auction_id = a.id
          AND viewer_bid.bidder_id = $${countValues.length}
          AND viewer_bid.status NOT IN ('REPLACED', 'WITHDRAWN')
      )`,
    );
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countWhere =
    countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';
  values.push(limit, offset);
  const limitParameter = `$${values.length - 1}`;
  const offsetParameter = `$${values.length}`;

  const [rows, count] = await Promise.all([
    pool.query(
      `${auctionSelect}
       ${where}
       ORDER BY
         CASE a.status WHEN 'ACTIVE' THEN 0 WHEN 'MATCHING' THEN 1 ELSE 2 END,
         CASE WHEN a.status = 'ACTIVE' THEN a.closes_at END ASC,
         CASE WHEN a.status <> 'ACTIVE' THEN a.updated_at END DESC,
         a.created_at DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    ),
    pool.query(`SELECT count(*)::int AS total FROM auctions a ${countWhere}`, countValues),
  ]);

  return {
    auctions: rows.rows.map((row) => serializeAuction(row, viewer)),
    pagination: { limit, offset, total: count.rows[0].total },
  };
}
