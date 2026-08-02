import test from 'node:test';
import assert from 'node:assert/strict';
import { canPlaceBid } from '../src/domain/auction.js';
import {
  percentageFloor,
  rejectionSplit,
  saleSplit,
} from '../src/domain/money.js';

test('saleSplit sends 95% to the seller and floors CLP fractions', () => {
  assert.deepEqual(saleSplit(10_001), {
    grossAmount: 10_001,
    platformFee: 500,
    sellerProceeds: 9_501,
  });
});

test('rejectionSplit returns 90% and retains 10%', () => {
  assert.deepEqual(rejectionSplit(25_555), {
    frozenAmount: 25_555,
    penalty: 2_555,
    returnedAmount: 23_000,
  });
});

test('money splits safely normalize bigint strings returned by pg', () => {
  assert.deepEqual(saleSplit('10001'), {
    grossAmount: 10_001,
    platformFee: 500,
    sellerProceeds: 9_501,
  });
  assert.deepEqual(rejectionSplit('25555'), {
    frozenAmount: 25_555,
    penalty: 2_555,
    returnedAmount: 23_000,
  });
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
