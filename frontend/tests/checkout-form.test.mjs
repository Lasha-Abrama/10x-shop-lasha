import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCheckoutDetails } from '../src/orders/checkout-form.ts';

const details = { fullName: 'Test Student', email: 'student@example.com', address: '12 Sample Street', city: 'Tbilisi' };

test('checkout accepts valid controlled-form values, including surrounding whitespace', () => {
  assert.deepEqual(validateCheckoutDetails(details), {});
  assert.deepEqual(validateCheckoutDetails(Object.fromEntries(Object.entries(details).map(([key, value]) => [key, `  ${value}  `]))), {});
  assert.deepEqual(validateCheckoutDetails({ ...details, fullName: 'ანა', city: 'თბილისი' }), {});
});

test('checkout requires all four fields with the exact Annex P5.2 messages', () => {
  const errors = validateCheckoutDetails({ fullName: ' ', email: '', address: '', city: ' ' });
  assert.deepEqual(errors, {
    fullName: 'Full name must be at least 3 characters',
    email: 'Please enter a valid email address',
    address: 'Address must be at least 5 characters',
    city: 'City is required',
  });
});

test('checkout validates name/address lengths, email shape and bounded input', () => {
  for (const fullName of ['Ab', ' '.repeat(5), 'a'.repeat(101)]) assert.ok(validateCheckoutDetails({ ...details, fullName }).fullName);
  for (const address of ['1234', ' '.repeat(10), 'a'.repeat(201)]) assert.ok(validateCheckoutDetails({ ...details, address }).address);
  for (const email of ['student', 'a@b', '@example.com', 'a b@example.com', 'a@example com', `${'a'.repeat(255)}@example.com`]) assert.ok(validateCheckoutDetails({ ...details, email }).email);
  assert.ok(validateCheckoutDetails({ ...details, city: 'a'.repeat(101) }).city);
  assert.deepEqual(validateCheckoutDetails({ ...details, fullName: 'Abc', address: '12345', city: 'X' }), {});
});
