import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actualOrderStatusLabels, getDemoOrderStatus } from '../src/orders/status.ts';

const createdAt = '2026-11-09T10:00:00Z';
const start = Date.parse(createdAt);

test('academic statuses follow the exact inclusive time boundaries', () => {
  for (const [seconds, expected] of [[0, 'Processing'], [59, 'Processing'], [60, 'Shipped'], [179, 'Shipped'], [180, 'Shipped'], [181, 'Delivered']]) {
    assert.equal(getDemoOrderStatus(createdAt, start + seconds * 1000), expected, `${seconds} seconds`);
  }
  assert.equal(getDemoOrderStatus(createdAt, start + 59_999), 'Processing');
  assert.equal(getDemoOrderStatus(createdAt, start + 180_001), 'Delivered');
});

test('invalid, future and unusually old dates are handled conservatively', () => {
  for (const value of ['', 'not a date', '99999999999999999']) assert.equal(getDemoOrderStatus(value, start), null);
  for (const now of [NaN, Infinity, -Infinity]) assert.equal(getDemoOrderStatus(createdAt, now), null);
  assert.equal(getDemoOrderStatus(createdAt, start - 1), null);
  assert.equal(getDemoOrderStatus('1900-01-01T00:00:00Z', start), 'Delivered');
});

test('simulation is deterministic and does not replace the actual unpaid status', () => {
  const order = Object.freeze({ createdAt, status: 'PENDING_PAYMENT' });
  assert.equal(getDemoOrderStatus(order.createdAt, start + 181_000), 'Delivered');
  assert.equal(getDemoOrderStatus(order.createdAt, start + 181_000), 'Delivered');
  assert.equal(order.status, 'PENDING_PAYMENT');
  assert.equal(actualOrderStatusLabels[order.status], 'Pending payment · unpaid');
});
