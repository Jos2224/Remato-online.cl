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

export function canPlaceBid({ auctionStatus, isOwner, closesAt, now = new Date() }) {
  return (
    auctionStatus === AUCTION_STATUS.ACTIVE &&
    !isOwner &&
    new Date(closesAt).getTime() > now.getTime()
  );
}
