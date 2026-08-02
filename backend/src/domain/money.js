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

export function rejectionSplit(amount) {
  const frozenAmount = toMoneyNumber(amount);
  const penalty = percentageFloor(frozenAmount, 10);
  return {
    frozenAmount,
    penalty,
    returnedAmount: frozenAmount - penalty,
  };
}
