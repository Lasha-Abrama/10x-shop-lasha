import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cartReducer, getCartTotals, getItemSubtotal } from '../src/cart/cart.ts';
import { CART_STORAGE_KEY, loadCart, parseStoredCart, saveCart } from '../src/cart/storage.ts';
import { centsToUsd, usdToCents } from '../src/money.ts';
import { formatPrice } from '../src/format.ts';

const product = { id: 1, title: 'Essence Mascara Lash Princess', price: 9.99,
  thumbnail: 'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp', stock: 5 };
const empty = { items: [] };
const add = (state, quantity, item = product) => cartReducer(state, { type: 'add', product: item, quantity });

test('adds the selected quantity and keeps only the cart product snapshot', () => {
  const state = add(empty, 2, { ...product, description: 'Not stored' });
  assert.deepEqual(state, { items: [{ ...product, quantity: 2 }] });
  assert.deepEqual(empty, { items: [] });
});

test('merges duplicate IDs, caps at stock, and refreshes the latest price and stock', () => {
  const first = add(empty, 2);
  assert.deepEqual(add(first, 2).items, [{ ...product, quantity: 4 }]);
  assert.equal(add(first, 99).items[0].quantity, 5);
  const updated = add(first, 2, { ...product, price: 12.99, stock: 3 });
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].price, 12.99);
  assert.equal(updated.items[0].quantity, 3);
  assert.equal(first.items[0].quantity, 2);
});

test('out-of-stock items and invalid add quantities leave the cart unchanged', () => {
  assert.equal(add(empty, 1, { ...product, stock: 0 }), empty);
  for (const quantity of [0, -1, 1.5, NaN, Infinity]) assert.equal(add(empty, quantity), empty);
});

test('increase, decrease and setQuantity preserve minimum and maximum bounds', () => {
  let state = add(empty, 1);
  state = cartReducer(state, { type: 'decrease', id: 1 });
  assert.equal(state.items[0].quantity, 1);
  state = cartReducer(state, { type: 'increase', id: 1 });
  assert.equal(state.items[0].quantity, 2);
  state = cartReducer(state, { type: 'setQuantity', id: 1, quantity: 100 });
  assert.equal(state.items[0].quantity, 5);
  assert.equal(cartReducer(state, { type: 'increase', id: 1 }).items[0].quantity, 5);
  assert.equal(cartReducer(state, { type: 'setQuantity', id: 1, quantity: -100 }).items[0].quantity, 1);
  assert.equal(cartReducer(state, { type: 'setQuantity', id: 1, quantity: NaN }), state);
  assert.deepEqual(cartReducer(state, { type: 'increase', id: 999 }), state);
});

test('remove affects only the requested line and clear empties the bag', () => {
  const state = add(add(empty, 2), 1, { ...product, id: 2, title: 'Another product' });
  const next = cartReducer(state, { type: 'remove', id: 1 });
  assert.deepEqual(next.items.map((item) => item.id), [2]);
  assert.equal(state.items.length, 2);
  assert.deepEqual(cartReducer(next, { type: 'clear' }), empty);
});

test('line subtotals and cart totals use cents and count total units', () => {
  const state = add(add(empty, 3), 2, { ...product, id: 2, price: 0.1 });
  assert.equal(getItemSubtotal(state.items[0]), 29.97);
  assert.deepEqual(getCartTotals(state), { itemCount: 5, subtotal: 30.17 });
  assert.deepEqual(getCartTotals(empty), { itemCount: 0, subtotal: 0 });
});

test('storage round-trips the documented version and key', () => {
  const state = add(empty, 2);
  let serialized;
  assert.equal(saveCart({ setItem: (key, value) => { assert.equal(key, CART_STORAGE_KEY); serialized = value; } }, state), true);
  assert.equal(JSON.parse(serialized).version, 1);
  assert.deepEqual(loadCart({ getItem: (key) => { assert.equal(key, CART_STORAGE_KEY); return serialized; } }), state);
});

test('missing, malformed, unsupported versions and invalid entries recover to an empty cart', () => {
  for (const value of [null, '', '{', 'null', '[]', '{}', JSON.stringify({ version: 2, items: [] }),
    JSON.stringify({ version: 1, items: [{ ...product, quantity: -1 }] }),
    JSON.stringify({ version: 1, items: [{ ...product, stock: 0, quantity: 1 }] }),
    JSON.stringify({ version: 1, items: [{ ...product, price: 1e308, quantity: 1 }] }),
    JSON.stringify({ version: 1, items: [{ ...product, thumbnail: 'javascript:alert(1)', quantity: 1 }] })]) {
    assert.deepEqual(parseStoredCart(value), empty);
  }
});

test('restoration merges duplicates, caps quantities and discards extra stored fields', () => {
  const restored = parseStoredCart(JSON.stringify({ version: 1, items: [
    { ...product, quantity: 4, token: 'not retained' }, { ...product, quantity: 4 },
  ] }));
  assert.deepEqual(restored, { items: [{ ...product, quantity: 5 }] });
});

test('blocked storage and quota failures do not throw', () => {
  assert.deepEqual(loadCart({ getItem: () => { throw new Error('Blocked'); } }), empty);
  assert.equal(saveCart({ setItem: () => { throw new Error('Quota exceeded'); } }, add(empty, 1)), false);
});

test('USD policy rejects unsafe cents and consistently rounds legitimate prices', () => {
  for (const price of [1e308, Infinity, NaN, -1, (Number.MAX_SAFE_INTEGER + 1) / 100, '9.99', null]) {
    assert.equal(usdToCents(price), null);
  }
  for (const [price, cents] of [[0, 0], [0.1, 10], [19.99, 1999], [2499.99, 249999], [1.234, 123]]) {
    assert.equal(usdToCents(price), cents);
  }
  assert.equal(formatPrice(1.005), formatPrice(usdToCents(1.005) / 100));
  assert.equal(centsToUsd(Number.MAX_SAFE_INTEGER), null);
  assert.equal(centsToUsd(999), 9.99);
});

test('reducer independently rejects invalid prices and unsafe stock', () => {
  for (const price of [1e308, Infinity, NaN, -1, (Number.MAX_SAFE_INTEGER + 1) / 100]) {
    assert.equal(add(empty, 1, { ...product, price }), empty);
  }
  for (const stock of [NaN, Infinity, 1.5]) assert.equal(add(empty, 1, { ...product, stock }), empty);
});

test('rejects line multiplication overflow for add, merge, increase and setQuantity', () => {
  const expensive = { ...product, price: 50_000_000_000_000, stock: 3 };
  const state = add(empty, 1, expensive);
  assert.equal(state.items.length, 1);
  assert.equal(add(empty, 2, expensive), empty);
  assert.equal(add(state, 1, expensive), state);
  assert.equal(cartReducer(state, { type: 'increase', id: 1 }), state);
  assert.equal(cartReducer(state, { type: 'setQuantity', id: 1, quantity: 2 }), state);
  assert.equal(add(empty, Number.MAX_SAFE_INTEGER, { ...product, stock: Number.MAX_SAFE_INTEGER }), empty);
  assert.throws(() => getItemSubtotal({ ...expensive, quantity: 2 }), RangeError);
  // Both operands are valid, but the resulting dollars would display one cent too low.
  const oneCent = { ...product, price: 0.01, stock: Number.MAX_SAFE_INTEGER };
  assert.equal(add(empty, Number.MAX_SAFE_INTEGER, oneCent), empty);
});

test('rejects aggregate overflow and unsafe total counts without changing valid state', () => {
  const expensive = { ...product, price: 40_000_000_000_000, stock: 3 };
  const first = add(empty, 1, expensive);
  const state = add(first, 1, { ...expensive, id: 2 });
  assert.equal(add(state, 1, { ...expensive, id: 3 }), state);
  assert.equal(cartReducer(state, { type: 'increase', id: 1 }), state);
  assert.equal(cartReducer(state, { type: 'setQuantity', id: 1, quantity: 2 }), state);
  const free = add(empty, Number.MAX_SAFE_INTEGER, { ...product, price: 0, stock: Number.MAX_SAFE_INTEGER });
  assert.equal(add(free, 1, { ...product, id: 2, price: 0 }), free);
  assert.equal(getCartTotals(state).subtotal, 80_000_000_000_000);
  assert.throws(() => getCartTotals({ items: [...state.items, { ...expensive, id: 3, quantity: 1 }] }), RangeError);
});

test('malformed or overflowing stored carts reset entirely instead of dropping expensive lines', () => {
  const expensive = { ...product, price: 50_000_000_000_000, stock: 3, quantity: 1 };
  const invalidLines = [
    ...[1e308, Infinity, NaN, -1, (Number.MAX_SAFE_INTEGER + 1) / 100].map((price) => [{ ...product, price, quantity: 1 }]),
    [{ ...expensive, quantity: 2 }],
    [expensive, { ...expensive, id: 2 }],
    [expensive, expensive],
  ];
  for (const items of invalidLines) {
    assert.deepEqual(parseStoredCart(JSON.stringify({ version: 1, items })), empty);
  }
  assert.deepEqual(parseStoredCart('{"version":1,"items":[{"price":1e999}]}'), empty);
  let written = false;
  assert.equal(saveCart({ setItem: () => { written = true; } }, { items: [{ ...expensive, quantity: 2 }] }), false);
  assert.equal(written, false);
});
