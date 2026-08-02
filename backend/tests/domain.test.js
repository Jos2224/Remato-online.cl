import test from 'node:test';
import assert from 'node:assert/strict';
import { canPlaceBid } from '../src/domain/auction.js';
import {
  holdForBid,
  percentageFloor,
  rejectionSplit,
  remainderAfterHold,
  saleSplit,
} from '../src/domain/money.js';

test('saleSplit sends 95% to the seller and floors CLP fractions', () => {
  assert.deepEqual(saleSplit(10_001), {
    grossAmount: 10_001,
    platformFee: 500,
    sellerProceeds: 9_501,
  });
});

test('rejectionSplit forfeits the whole deposit and pays 70% to the seller', () => {
  // The deposit is what was frozen. A bidder who walks away loses all of it: 70% goes
  // to the seller who lost the sale, the remainder covers platform costs.
  assert.deepEqual(rejectionSplit(25_555), {
    frozenAmount: 25_555,
    forfeited: 25_555,
    sellerShare: 17_888,
    platformShare: 7_667,
    returnedAmount: 0,
  });
});

test('the forfeited deposit always reconciles exactly', () => {
  // The platform share is a remainder, not a second percentage, so rounding can never
  // create or destroy a peso.
  for (const amount of [1, 3, 7, 99, 12_345, 25_555, 1_000_003]) {
    const split = rejectionSplit(amount);
    assert.equal(split.sellerShare + split.platformShare, amount);
  }
});

test('money splits safely normalize bigint strings returned by pg', () => {
  assert.deepEqual(saleSplit('10001'), {
    grossAmount: 10_001,
    platformFee: 500,
    sellerProceeds: 9_501,
  });
  assert.deepEqual(rejectionSplit('25555'), {
    frozenAmount: 25_555,
    forfeited: 25_555,
    sellerShare: 17_888,
    platformShare: 7_667,
    returnedAmount: 0,
  });
});

test('the deposit is a tenth of the bid, never zero', () => {
  assert.equal(holdForBid(90_000), 9_000);
  assert.equal(holdForBid(10_001), 1_000);
  // A token bid still carries a real commitment rather than a free option.
  assert.equal(holdForBid(5), 1);
  assert.equal(remainderAfterHold(90_000, 9_000), 81_000);
  // Bids placed before partial holds existed were backfilled with the full amount.
  assert.equal(remainderAfterHold(50_000, 50_000), 0);
});

test('percentage calculations remain exact near MAX_SAFE_INTEGER', () => {
  assert.equal(
    percentageFloor(Number.MAX_SAFE_INTEGER, 5),
    Number((BigInt(Number.MAX_SAFE_INTEGER) * 5n) / 100n),
  );
});

test('bidding is allowed only on a live auction belonging to someone else', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');
  assert.equal(
    canPlaceBid({
      auctionStatus: 'ACTIVE',
      isOwner: false,
      closesAt: '2026-08-01T12:00:01.000Z',
      now,
    }),
    true,
  );
  assert.equal(
    canPlaceBid({
      auctionStatus: 'ACTIVE',
      isOwner: true,
      closesAt: '2026-08-01T12:00:01.000Z',
      now,
    }),
    false,
  );
  assert.equal(
    canPlaceBid({
      auctionStatus: 'ACTIVE',
      isOwner: false,
      closesAt: '2026-08-01T12:00:00.000Z',
      now,
    }),
    false,
  );
});
