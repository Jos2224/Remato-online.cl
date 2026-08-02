import { DateTime } from 'luxon';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { rejectionSplit, saleSplit } from '../domain/money.js';
import { conflict, notFound } from '../lib/api-error.js';

async function getAdmin(client) {
  const result = await client.query(
    `SELECT id, email FROM users WHERE role = 'ADMIN' LIMIT 1`,
  );
  if (result.rowCount === 0) {
    throw conflict(
      'ADMIN_NOT_CONFIGURED',
      'La cuenta administradora aún no está configurada. Ejecuta el seed.',
    );
  }
  return result.rows[0];
}

async function lockWallets(client, userIds) {
  const ids = [...new Set(userIds)].sort();
  const result = await client.query(
    `SELECT * FROM wallets
     WHERE user_id = ANY($1::uuid[])
     ORDER BY user_id
     FOR UPDATE`,
    [ids],
  );
  if (result.rowCount !== ids.length) {
    throw new Error('Wallet invariant violated: a user has no wallet');
  }
  return new Map(result.rows.map((wallet) => [wallet.user_id, wallet]));
}

async function addLedgerEntry(client, entry) {
  if (entry.availableDelta === 0 && entry.frozenDelta === 0) return;
  await client.query(
    `INSERT INTO ledger_entries
      (user_id, entry_type, available_delta, frozen_delta,
       auction_id, bid_id, match_id, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.userId,
      entry.type,
      entry.availableDelta,
      entry.frozenDelta,
      entry.auctionId ?? null,
      entry.bidId ?? null,
      entry.matchId ?? null,
      entry.description,
    ],
  );
}

async function markNoMatch(client, auctionId, at) {
  await client.query(
    `UPDATE auctions
     SET status = 'NO_MATCH', updated_at = $2
     WHERE id = $1`,
    [auctionId, at],
  );
}

async function startNextMatch(client, auctionId, startedAt) {
  const candidateResult = await client.query(
    `SELECT * FROM bids
     WHERE auction_id = $1 AND status = 'ACTIVE'
     ORDER BY amount DESC, created_at ASC, id ASC
     LIMIT 1
     FOR UPDATE`,
    [auctionId],
  );

  if (candidateResult.rowCount === 0) {
    await markNoMatch(client, auctionId, startedAt);
    return null;
  }

  const positionResult = await client.query(
    `SELECT COALESCE(max(position), 0)::int + 1 AS next_position
     FROM auction_matches
     WHERE auction_id = $1`,
    [auctionId],
  );
  const bid = candidateResult.rows[0];
  const expiresAt = DateTime.fromJSDate(new Date(startedAt)).plus({ hours: 1 }).toJSDate();
  const inserted = await client.query(
    `INSERT INTO auction_matches
      (auction_id, bid_id, candidate_id, position, offered_amount,
       status, started_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)
     RETURNING *`,
    [
      auctionId,
      bid.id,
      bid.bidder_id,
      positionResult.rows[0].next_position,
      bid.amount,
      startedAt,
      expiresAt,
    ],
  );
  return inserted.rows[0];
}

async function penalizeMatch(client, match, outcome, at) {
  const admin = await getAdmin(client);
  await lockWallets(client, [match.candidate_id, admin.id]);
  const split = rejectionSplit(match.offered_amount);

  const candidateUpdate = await client.query(
    `UPDATE wallets
     SET available_balance = available_balance + $2,
         frozen_balance = frozen_balance - $3,
         updated_at = $4
     WHERE user_id = $1 AND frozen_balance >= $3
     RETURNING user_id`,
    [match.candidate_id, split.returnedAmount, split.frozenAmount, at],
  );
  if (candidateUpdate.rowCount === 0) {
    throw new Error('Wallet invariant violated: candidate frozen balance is insufficient');
  }

  if (split.penalty > 0) {
    await client.query(
      `UPDATE wallets
       SET available_balance = available_balance + $2, updated_at = $3
       WHERE user_id = $1`,
      [admin.id, split.penalty, at],
    );
  }

  await addLedgerEntry(client, {
    userId: match.candidate_id,
    type: 'BID_PENALTY',
    availableDelta: split.returnedAmount,
    frozenDelta: -split.frozenAmount,
    auctionId: match.auction_id,
    bidId: match.bid_id,
    matchId: match.id,
    description:
      outcome === 'EXPIRED'
        ? 'Devolución del 90% al expirar el turno de aceptación'
        : 'Devolución del 90% al rechazar la adjudicación',
  });
  await addLedgerEntry(client, {
    userId: admin.id,
    type: 'PENALTY_RECEIVED',
    availableDelta: split.penalty,
    frozenDelta: 0,
    auctionId: match.auction_id,
    bidId: match.bid_id,
    matchId: match.id,
    description: 'Penalización del 10% por adjudicación no aceptada',
  });

  await client.query(
    `UPDATE auction_matches
     SET status = $2, responded_at = CASE WHEN $2 = 'REJECTED' THEN $3::timestamptz ELSE NULL END
     WHERE id = $1`,
    [match.id, outcome, at],
  );
  await client.query(
    `UPDATE bids SET status = $2, updated_at = $3 WHERE id = $1`,
    [match.bid_id, outcome, at],
  );
}

async function releaseOtherBids(client, auctionId, bids, at) {
  for (const bid of bids) {
    const updated = await client.query(
      `UPDATE wallets
       SET available_balance = available_balance + $2,
           frozen_balance = frozen_balance - $2,
           updated_at = $3
       WHERE user_id = $1 AND frozen_balance >= $2
       RETURNING user_id`,
      [bid.bidder_id, bid.amount, at],
    );
    if (updated.rowCount === 0) {
      throw new Error('Wallet invariant violated while releasing a losing bid');
    }
    await client.query(
      `UPDATE bids SET status = 'RELEASED', updated_at = $2 WHERE id = $1`,
      [bid.id, at],
    );
    await addLedgerEntry(client, {
      userId: bid.bidder_id,
      type: 'BID_RELEASE',
      availableDelta: bid.amount,
      frozenDelta: -bid.amount,
      auctionId,
      bidId: bid.id,
      description: 'Fondos liberados al finalizar la adjudicación a otro postor',
    });
  }
}

async function settleAcceptedMatch(client, auction, match, at) {
  const admin = await getAdmin(client);
  const activeBidsResult = await client.query(
    `SELECT * FROM bids
     WHERE auction_id = $1 AND status = 'ACTIVE'
     ORDER BY bidder_id
     FOR UPDATE`,
    [auction.id],
  );
  const winningBid = activeBidsResult.rows.find((bid) => bid.id === match.bid_id);
  if (!winningBid) {
    throw conflict('MATCH_NOT_AVAILABLE', 'Esta adjudicación ya no está disponible.');
  }
  const losingBids = activeBidsResult.rows.filter((bid) => bid.id !== match.bid_id);
  const split = saleSplit(match.offered_amount);

  await lockWallets(client, [
    ...activeBidsResult.rows.map((bid) => bid.bidder_id),
    auction.seller_id,
    admin.id,
  ]);
  const buyerUpdate = await client.query(
    `UPDATE wallets
     SET frozen_balance = frozen_balance - $2, updated_at = $3
     WHERE user_id = $1 AND frozen_balance >= $2
     RETURNING user_id`,
    [winningBid.bidder_id, match.offered_amount, at],
  );
  if (buyerUpdate.rowCount === 0) {
    throw new Error('Wallet invariant violated: winner frozen balance is insufficient');
  }
  await client.query(
    `UPDATE wallets
     SET available_balance = available_balance + $2, updated_at = $3
     WHERE user_id = $1`,
    [auction.seller_id, split.sellerProceeds, at],
  );
  if (split.platformFee > 0) {
    await client.query(
      `UPDATE wallets
       SET available_balance = available_balance + $2, updated_at = $3
       WHERE user_id = $1`,
      [admin.id, split.platformFee, at],
    );
  }

  await addLedgerEntry(client, {
    userId: winningBid.bidder_id,
    type: 'PURCHASE',
    availableDelta: 0,
    frozenDelta: -match.offered_amount,
    auctionId: auction.id,
    bidId: winningBid.id,
    matchId: match.id,
    description: 'Pago de subasta adjudicada',
  });
  await addLedgerEntry(client, {
    userId: auction.seller_id,
    type: 'SALE_PROCEEDS',
    availableDelta: split.sellerProceeds,
    frozenDelta: 0,
    auctionId: auction.id,
    bidId: winningBid.id,
    matchId: match.id,
    description: 'Ingreso por venta, descontada la comisión de plataforma',
  });
  await addLedgerEntry(client, {
    userId: admin.id,
    type: 'PLATFORM_FEE',
    availableDelta: split.platformFee,
    frozenDelta: 0,
    auctionId: auction.id,
    bidId: winningBid.id,
    matchId: match.id,
    description: 'Comisión de plataforma del 5%',
  });

  await client.query(
    `UPDATE bids SET status = 'WON', updated_at = $2 WHERE id = $1`,
    [winningBid.id, at],
  );
  await client.query(
    `UPDATE auction_matches
     SET status = 'ACCEPTED', responded_at = $2
     WHERE id = $1`,
    [match.id, at],
  );
  await client.query(
    `UPDATE auctions
     SET status = 'SOLD', sold_at = $2, updated_at = $2
     WHERE id = $1`,
    [auction.id, at],
  );
  await client.query(
    `INSERT INTO sales
      (auction_id, match_id, buyer_id, seller_id,
       gross_amount, platform_fee, seller_proceeds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      auction.id,
      match.id,
      winningBid.bidder_id,
      auction.seller_id,
      split.grossAmount,
      split.platformFee,
      split.sellerProceeds,
    ],
  );
  await client.query(
    `UPDATE users
     SET sales_count = sales_count + 1, updated_at = $2
     WHERE id = $1`,
    [auction.seller_id, at],
  );

  await releaseOtherBids(client, auction.id, losingBids, at);
}

// A one-hour turn has to be measured from the moment the candidate can actually see it.
// Deriving it from a timestamp already in the past (closes_at, or the previous turn's
// expiry after a long idle period) creates a turn that is born expired and penalises a
// bidder who never had the chance to respond.
const turnOpensAt = (scheduled, now) =>
  new Date(Math.max(new Date(scheduled).getTime(), now.getTime()));

export async function advanceAuctionLocked(client, auction, now = new Date()) {
  let current = auction;

  if (current.status === 'ACTIVE' && new Date(current.closes_at) <= now) {
    const updated = await client.query(
      `UPDATE auctions
       SET status = 'MATCHING', matching_started_at = closes_at, updated_at = $2
       WHERE id = $1
       RETURNING *`,
      [current.id, now],
    );
    current = updated.rows[0];
    await startNextMatch(client, current.id, turnOpensAt(current.closes_at, now));
  }

  // One lazy sync can catch up several one-hour turns after a long idle period.
  for (let iteration = 0; iteration < 10_000 && current.status === 'MATCHING'; iteration += 1) {
    const pendingResult = await client.query(
      `SELECT * FROM auction_matches
       WHERE auction_id = $1 AND status = 'PENDING'
       LIMIT 1
       FOR UPDATE`,
      [current.id],
    );

    if (pendingResult.rowCount === 0) {
      await startNextMatch(client, current.id, now);
      const refreshed = await client.query('SELECT * FROM auctions WHERE id = $1', [current.id]);
      current = refreshed.rows[0];
      continue;
    }

    const pending = pendingResult.rows[0];
    if (new Date(pending.expires_at) > now) break;

    await penalizeMatch(client, pending, 'EXPIRED', pending.expires_at);
    await startNextMatch(client, current.id, turnOpensAt(pending.expires_at, now));
    const refreshed = await client.query('SELECT * FROM auctions WHERE id = $1', [current.id]);
    current = refreshed.rows[0];
  }

  return current;
}

export async function synchronizeAuction(auctionId, now = new Date()) {
  return withTransaction(async (client) => {
    const result = await client.query(
      'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
      [auctionId],
    );
    if (result.rowCount === 0) throw notFound('Subasta no encontrada.');
    return advanceAuctionLocked(client, result.rows[0], now);
  });
}

export async function synchronizeDueAuctions(now = new Date()) {
  let processed = 0;

  for (let batch = 0; batch < 20; batch += 1) {
    const due = await pool.query(
      `SELECT a.id
       FROM auctions a
       WHERE
         (a.status = 'ACTIVE' AND a.closes_at <= $1)
         OR (
           a.status = 'MATCHING'
           AND EXISTS (
             SELECT 1 FROM auction_matches m
             WHERE m.auction_id = a.id
               AND m.status = 'PENDING'
               AND m.expires_at <= $1
           )
         )
       ORDER BY a.closes_at ASC
       LIMIT 50`,
      [now],
    );
    if (due.rowCount === 0) break;

    for (const row of due.rows) {
      await synchronizeAuction(row.id, now);
      processed += 1;
    }
  }

  return processed;
}

export async function respondToMatch(matchId, userId, decision, now = new Date()) {
  const outcome = await withTransaction(async (client) => {
    const lookup = await client.query(
      'SELECT auction_id, candidate_id FROM auction_matches WHERE id = $1',
      [matchId],
    );
    if (lookup.rowCount === 0) throw notFound('Turno de adjudicación no encontrado.');
    if (lookup.rows[0].candidate_id !== userId) {
      throw notFound('Turno de adjudicación no encontrado.');
    }

    const auctionResult = await client.query(
      'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
      [lookup.rows[0].auction_id],
    );
    let auction = await advanceAuctionLocked(client, auctionResult.rows[0], now);
    const matchResult = await client.query(
      'SELECT * FROM auction_matches WHERE id = $1 FOR UPDATE',
      [matchId],
    );
    const match = matchResult.rows[0];

    if (
      auction.status !== 'MATCHING' ||
      match.status !== 'PENDING' ||
      new Date(match.expires_at) <= now
    ) {
      // Return instead of throwing so any lazy expiry processed above is committed.
      return { unavailable: true };
    }

    if (decision === 'ACCEPT') {
      await settleAcceptedMatch(client, auction, match, now);
    } else {
      await penalizeMatch(client, match, 'REJECTED', now);
      await startNextMatch(client, auction.id, now);
    }

    const refreshed = await client.query('SELECT * FROM auctions WHERE id = $1', [auction.id]);
    return { auction: refreshed.rows[0] };
  });

  if (outcome.unavailable) {
    throw conflict('MATCH_NOT_AVAILABLE', 'El turno ya fue respondido o expiró.');
  }
  return outcome.auction;
}
