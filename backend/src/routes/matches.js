import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { getAuctionById, getPublicBids } from '../services/auction-read.js';
import { respondToMatch, synchronizeDueAuctions } from '../services/auction-sync.js';

const router = Router();
router.use(requireAuth);

const iso = (value) => (value ? new Date(value).toISOString() : null);

function serializeMatch(row) {
  return {
    id: row.id,
    status: row.status,
    position: row.position,
    amount: Number(row.offered_amount),
    startedAt: iso(row.started_at),
    expiresAt: iso(row.expires_at),
    respondedAt: iso(row.responded_at),
    canRespond:
      row.status === 'PENDING' &&
      row.auction_status === 'MATCHING' &&
      new Date(row.expires_at) > new Date(),
    auction: {
      id: row.auction_id,
      title: row.auction_title,
      status: row.auction_status,
      endsAt: iso(row.auction_closes_at),
      sellerEmail: row.seller_email,
    },
  };
}

router.get(
  '/mine',
  asyncHandler(async (request, response) => {
    await synchronizeDueAuctions();
    const result = await pool.query(
      `SELECT
         m.*,
         a.title AS auction_title,
         a.status AS auction_status,
         a.closes_at AS auction_closes_at,
         seller.email AS seller_email
       FROM auction_matches m
       JOIN auctions a ON a.id = m.auction_id
       JOIN users seller ON seller.id = a.seller_id
       WHERE m.candidate_id = $1
       ORDER BY
         CASE m.status WHEN 'PENDING' THEN 0 ELSE 1 END,
         m.created_at DESC`,
      [request.user.id],
    );
    response.json({ data: { matches: result.rows.map(serializeMatch) } });
  }),
);

async function handleDecision(request, response, decision) {
  const updated = await respondToMatch(
    request.params.id,
    request.user.id,
    decision,
  );
  const [auction, bids] = await Promise.all([
    getAuctionById(updated.id, request.user),
    getPublicBids(updated.id),
  ]);
  response.json({ data: { auction: { ...auction, bids } } });
}

router.post(
  '/:id/accept',
  asyncHandler((request, response) => handleDecision(request, response, 'ACCEPT')),
);

router.post(
  '/:id/reject',
  asyncHandler((request, response) => handleDecision(request, response, 'REJECT')),
);

export default router;
