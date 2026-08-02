export const AUCTION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  MATCHING: 'MATCHING',
  SOLD: 'SOLD',
  NO_MATCH: 'NO_MATCH',
});

export const BID_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REPLACED: 'REPLACED',
  WITHDRAWN: 'WITHDRAWN',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  WON: 'WON',
  RELEASED: 'RELEASED',
});

export const MATCH_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
});

// An auction may not be scheduled further out than this. Without a ceiling the API
// accepted a closing date ten years away, which freezes bidders' funds indefinitely.
export const MAX_AUCTION_DAYS = 30;

// Any bid landing inside this window pushes the closing time out by the same amount,
// so a last-second snipe cannot win uncontested. Repeats until the bidding truly stops.
export const ANTI_SNIPE_WINDOW_MS = 2 * 60_000;

// Minimum bid step by price band, in CLP. Without it the API accepted $1 raises, which
// turns a closing auction into a public war of attrition.
const BID_INCREMENT_TIERS = [
  { upTo: 10_000, increment: 500 },
  { upTo: 50_000, increment: 1_000 },
  { upTo: 200_000, increment: 2_000 },
  { upTo: 1_000_000, increment: 5_000 },
];
const TOP_TIER_INCREMENT = 10_000;

export function minimumIncrement(currentPrice) {
  const price = Number(currentPrice);
  const tier = BID_INCREMENT_TIERS.find((candidate) => price < candidate.upTo);
  return tier ? tier.increment : TOP_TIER_INCREMENT;
}

export function minimumNextBid(currentPrice, hasBids) {
  const price = Number(currentPrice);
  // The opening bid may match the starting price; every later bid must clear the step.
  return hasBids ? price + minimumIncrement(price) : price;
}

export function canPlaceBid({ auctionStatus, isOwner, closesAt, now = new Date() }) {
  return (
    auctionStatus === AUCTION_STATUS.ACTIVE &&
    !isOwner &&
    new Date(closesAt).getTime() > now.getTime()
  );
}
