export const serializeUser = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
  salesCount: row.sales_count,
});

export const serializePublicUser = (row) => ({
  id: row.id,
  email: row.email,
  createdAt: row.created_at,
  salesCount: row.sales_count,
});

export const serializeWallet = (row) => ({
  availableBalance: Number(row.available_balance),
  frozenBalance: Number(row.frozen_balance),
  totalBalance: Number(BigInt(row.available_balance) + BigInt(row.frozen_balance)),
  currency: 'CLP',
  updatedAt: row.updated_at,
});

export const serializeLedgerEntry = (row) => ({
  id: row.id,
  type: row.entry_type,
  availableDelta: Number(row.available_delta),
  frozenDelta: Number(row.frozen_delta),
  auctionId: row.auction_id,
  bidId: row.bid_id,
  matchId: row.match_id,
  description: row.description,
  createdAt: row.created_at,
});
