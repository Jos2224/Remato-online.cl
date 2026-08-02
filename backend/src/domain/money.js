export const MAX_MONEY = Number.MAX_SAFE_INTEGER;

export function toMoneyNumber(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError('Money value must be a non-negative safe integer');
  }
  return result;
}

export function percentageFloor(amount, percentage) {
  return Number((BigInt(amount) * BigInt(percentage)) / 100n);
}

export function saleSplit(amount) {
  const grossAmount = toMoneyNumber(amount);
  const platformFee = percentageFloor(grossAmount, 5);
  return {
    grossAmount,
    platformFee,
    sellerProceeds: grossAmount - platformFee,
  };
}

// Share of a bid that is actually frozen when the bid is placed.
//
// Freezing the whole offer destroyed liquidity: with $100.000 you could not bid $90.000
// on two auctions, because the first one locked everything. A deposit keeps the
// commitment real — it is forfeited on default — without immobilising the full amount.
export const HOLD_PERCENTAGE = 10;

// How the forfeited deposit is divided. The seller lost the sale, so most of it goes to
// them; the platform keeps a share for the cost of running the failed adjudication.
export const PENALTY_SELLER_PERCENTAGE = 70;

export function holdForBid(amount) {
  const bidAmount = toMoneyNumber(amount);
  // Always at least one peso, so a token bid still carries a real commitment.
  return Math.max(1, percentageFloor(bidAmount, HOLD_PERCENTAGE));
}

// The amount still owed at settlement: the winner already has the deposit frozen.
export function remainderAfterHold(amount, heldAmount) {
  const bidAmount = toMoneyNumber(amount);
  const held = toMoneyNumber(heldAmount);
  return Math.max(0, bidAmount - held);
}

// A matched bidder who rejects or lets the turn expire forfeits the whole deposit.
export function rejectionSplit(heldAmount) {
  const forfeited = toMoneyNumber(heldAmount);
  const sellerShare = percentageFloor(forfeited, PENALTY_SELLER_PERCENTAGE);
  return {
    frozenAmount: forfeited,
    forfeited,
    sellerShare,
    // Remainder rather than a second percentage, so the three figures always reconcile
    // exactly no matter how the division rounds.
    platformShare: forfeited - sellerShare,
    returnedAmount: 0,
  };
}
