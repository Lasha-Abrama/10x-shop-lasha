import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateReorder, cartStoreReducer } from '../src/cart/reorder.ts';
import { getCartTotals } from '../src/cart/cart.ts';
import { parseStoredCart, saveCart } from '../src/cart/storage.ts';

const product = (id = 1, overrides = {}) => ({ id, title: `Product ${id}`, price: 10,
  thumbnail: `https://example.com/${id}.png`, stock: 200, ...overrides });
const line = (id = 1, quantity = 1, overrides = {}) => ({ product: product(id, overrides), quantity });
const item = (id = 1, quantity = 1, overrides = {}) => ({ ...product(id, overrides), quantity });
const run = (cart, lines) => calculateReorder(cart, lines, 'request-1');
const reasons = (store) => store.reorderResult.lines.map((result) => result.status === 'skipped' ? result.reason : 'accepted');

test('empty cart receives exact quantities in input order with accurate committed results', () => {
  const cart = Object.freeze({ items: Object.freeze([]) });
  const lines = [line(3, 2), line(1, 4)];
  const next = run(cart, lines);
  assert.deepEqual(next.cart.items, [item(3, 2), item(1, 4)]);
  assert.deepEqual(next.reorderResult, { requestId: 'request-1', error: null, acceptedCount: 2, skippedCount: 0,
    lines: [{ index: 0, productId: 3, quantity: 2, status: 'accepted', cartQuantity: 2 },
      { index: 1, productId: 1, quantity: 4, status: 'accepted', cartQuantity: 4 }] });
  assert.deepEqual(cart.items, []);
  assert.deepEqual(lines, [line(3, 2), line(1, 4)]);
});

test('exact merges refresh current metadata and preserve unrelated lines and their order', () => {
  const unrelated = Object.freeze(item(2));
  const previous = Object.freeze(item(1, 2, { stock: 10 }));
  const cart = Object.freeze({ items: Object.freeze([unrelated, previous]) });
  const fresh = line(1, 1, { stock: 3, price: 12.99, title: 'Current title', thumbnail: 'https://example.com/new.png' });
  const next = run(cart, [fresh]);
  assert.deepEqual(next.cart.items, [unrelated, { ...fresh.product, quantity: 3 }]);
  assert.equal(next.cart.items[0], unrelated);
  assert.deepEqual(cart.items, [unrelated, item(1, 2, { stock: 10 })]);
  assert.equal(next.reorderResult.lines[0].cartQuantity, 3);
  assert.deepEqual(getCartTotals(next.cart), { itemCount: 4, subtotal: 48.97 });
});

test('stock rejection never clips, reduces, reprices or replaces an existing snapshot', () => {
  for (const [quantity, stock, requested] of [[8, 3, 2], [2, 3, 2], [2, 2, 1]]) {
    const cart = Object.freeze({ items: Object.freeze([Object.freeze(item(1, quantity, { stock: 10 }))]) });
    const next = run(cart, [line(1, requested, { stock, price: 15, title: 'New metadata' })]);
    assert.equal(next.cart, cart);
    assert.equal(next.cart.items[0], cart.items[0]);
    assert.deepEqual(reasons(next), ['stock']);
    assert.equal(next.reorderResult.acceptedCount, 0);
    assert.equal(next.reorderResult.skippedCount, 1);
  }
  for (const stock of [0, 2]) {
    const cart = { items: [] };
    assert.equal(run(cart, [line(1, 3, { stock })]).cart, cart);
  }
  assert.equal(run({ items: [] }, [line(1, 3, { stock: 3 })]).cart.items[0].quantity, 3);
});

test('partial success records every line in order and changes only accepted products', () => {
  const existing = item(1, 2, { stock: 10 });
  const cart = { items: [existing] };
  const next = run(cart, [line(2, 2, { price: 15 }), line(1, 2, { stock: 3, price: 99 }), line(3, 1, { stock: 0 }), line(4, 3)]);
  assert.deepEqual(reasons(next), ['accepted', 'stock', 'stock', 'accepted']);
  assert.deepEqual(next.cart.items.map(({ id, quantity }) => [id, quantity]), [[1, 2], [2, 2], [4, 3]]);
  assert.equal(next.cart.items[0], existing);
  assert.equal(next.reorderResult.acceptedCount, 2);
  assert.equal(next.reorderResult.skippedCount, 2);
  assert.deepEqual(next.reorderResult.lines.map(({ index }) => index), [0, 1, 2, 3]);
});

test('twenty distinct products fit, the twenty-first is skipped, and existing types can still merge', () => {
  const next = run({ items: [] }, Array.from({ length: 21 }, (_, i) => line(i + 1)));
  assert.equal(next.cart.items.length, 20);
  assert.equal(next.reorderResult.acceptedCount, 20);
  assert.deepEqual(reasons(next).slice(-1), ['product-limit']);
  const merged = run(next.cart, [line(1, 1), line(22, 1)]);
  assert.equal(merged.cart.items[0].quantity, 2);
  assert.deepEqual(reasons(merged), ['accepted', 'product-limit']);
});

test('100 units per product is allowed, 101 is rejected, and total units may exceed 100', () => {
  assert.equal(run({ items: [] }, [line(1, 100)]).cart.items[0].quantity, 100);
  assert.deepEqual(reasons(run({ items: [] }, [line(1, 101)])), ['quantity-limit']);
  const cart = { items: [item(1, 99)] };
  assert.equal(run(cart, [line(1, 1)]).cart.items[0].quantity, 100);
  assert.equal(run(cart, [line(1, 2)]).cart, cart);
  const next = run({ items: [] }, [line(1, 60), line(2, 60)]);
  assert.equal(getCartTotals(next.cart).itemCount, 120);
  assert.equal(next.reorderResult.acceptedCount, 2);
});

test('malformed identities, quantities and current snapshots are skipped safely', () => {
  const invalid = [null, {}, { quantity: 1 },
    ...[0, -1, 1.5, NaN, Infinity, '1', 2_147_483_648].map((id) => line(id)),
    ...[0, -1, 1.5, NaN, Infinity, '2'].map((quantity) => line(1, quantity)),
    ...[-1, NaN, Infinity, 1.5, '3'].map((stock) => line(1, 1, { stock })),
    line(1, 1, { title: '' }), line(1, 1, { title: ' ' }), line(1, 1, { thumbnail: 'javascript:alert(1)' }),
    line(1, 1, { thumbnail: 'https://' }), ...[-1, NaN, Infinity, 1e308, '10'].map((price) => line(1, 1, { price }))];
  for (const value of invalid) {
    const cart = { items: [] };
    const next = run(cart, [value]);
    assert.equal(next.cart, cart);
    assert.deepEqual(reasons(next), ['invalid-line']);
    assert.equal(next.reorderResult.skippedCount, 1);
  }
});

test('all occurrences of duplicate input product IDs are skipped, independently of other lines', () => {
  const next = run({ items: [] }, [line(1), line(2, 2), line(1, 3, { price: 99 })]);
  assert.deepEqual(reasons(next), ['duplicate-product', 'accepted', 'duplicate-product']);
  assert.deepEqual(next.cart.items, [item(2, 2)]);
  assert.equal(next.reorderResult.acceptedCount, 1);
  assert.equal(next.reorderResult.skippedCount, 2);
});

test('unsafe line and aggregate totals reject only the unsafe candidate', () => {
  const huge = 50_000_000_000_000;
  const empty = { items: [] };
  const overflow = run(empty, [line(1, 2, { price: huge })]);
  assert.equal(overflow.cart, empty);
  assert.deepEqual(reasons(overflow), ['unsafe-total']);
  const cart = { items: [item(1, 1, { price: huge })] };
  const next = run(cart, [line(2, 1, { price: huge }), line(3, 1, { price: 1 })]);
  assert.deepEqual(reasons(next), ['unsafe-total', 'accepted']);
  assert.equal(next.cart.items[0], cart.items[0]);
  assert.equal(next.cart.items.length, 2);
});

test('invalid existing carts are preserved without repairs, reductions or partial additions', () => {
  const cases = [{ items: [item(1, 101)] }, { items: [item(1, 8, { stock: 3 })] },
    { items: [item(1, 0)] }, { items: [item(1, 1, { stock: 0 })] },
    { items: [item(1), item(1)] }, { items: Array.from({ length: 21 }, (_, i) => item(i + 1)) },
    { items: [item(1, 1, { price: Infinity })] }, { items: [item(1, 1, { title: '' })] },
    { items: [item(1, 1, { thumbnail: 'invalid' })] },
    { items: [item(1, 2, { price: 50_000_000_000_000 })] }];
  for (const cart of cases) {
    const before = structuredClone(cart);
    const next = run(cart, [line(2), line(3)]);
    assert.equal(next.cart, cart);
    assert.deepEqual(cart, before);
    assert.equal(next.reorderResult.error, 'invalid-cart');
    assert.deepEqual(reasons(next), ['invalid-cart', 'invalid-cart']);
  }
});

test('empty, malformed and all-failed batches preserve cart identity', () => {
  const cart = { items: [item(1)] };
  assert.equal(run(cart, []).cart, cart);
  assert.deepEqual(run(cart, []).reorderResult.lines, []);
  for (const lines of [null, undefined, {}]) {
    const next = run(cart, lines);
    assert.equal(next.cart, cart);
    assert.equal(next.reorderResult.error, 'invalid-batch');
  }
  const failed = run(cart, [line(2, 1, { stock: 0 }), line(3, 101)]);
  assert.equal(failed.cart, cart);
  assert.equal(failed.reorderResult.acceptedCount, 0);
  assert.equal(failed.reorderResult.skippedCount, 2);
});

test('reducer commits against latest state, including edits made while lookups would be pending', () => {
  const original = { cart: { items: [item(1, 1)] }, reorderResult: null };
  const action = { type: 'reorder', requestId: 'later-lookup', lines: [line(1, 2), line(3)] };
  assert.equal(run(original.cart, action.lines).reorderResult.lines[0].cartQuantity, 3);
  let latest = cartStoreReducer(original, { type: 'increase', id: 1 });
  latest = cartStoreReducer(latest, { type: 'add', product: product(2), quantity: 4 });
  const next = cartStoreReducer(latest, action);
  assert.deepEqual(next.cart.items, [item(1, 4), item(2, 4), item(3)]);
  assert.equal(next.reorderResult.requestId, 'later-lookup');
  assert.equal(next.reorderResult.lines[0].cartQuantity, 4);
  assert.equal(next.reorderResult.acceptedCount, 2);
  assert.equal(original.cart.items[0].quantity, 1);
  // An intervening edit fills stock: the receipt must reflect actual rejection, not an earlier preview.
  const filled = cartStoreReducer(latest, { type: 'setQuantity', id: 1, quantity: 100 });
  const rejected = cartStoreReducer(filled, { ...action, lines: [line(1, 1)] });
  assert.equal(rejected.cart, filled.cart);
  assert.equal(rejected.reorderResult.acceptedCount, 0);
  assert.deepEqual(reasons(rejected), ['quantity-limit']);
  const removed = cartStoreReducer(latest, { type: 'remove', id: 1 });
  assert.equal(cartStoreReducer(removed, action).cart.items.find(({ id }) => id === 1).quantity, 2);
  const cleared = cartStoreReducer(latest, { type: 'clear' });
  assert.deepEqual(cartStoreReducer(cleared, action).cart.items, [item(1, 2), item(3)]);
});

test('ordinary actions retain their existing behavior and rejected actions retain store identity', () => {
  const start = { cart: { items: [] }, reorderResult: null };
  const added = cartStoreReducer(start, { type: 'add', product: product(1, { stock: 3 }), quantity: 2 });
  assert.equal(cartStoreReducer(added, { type: 'add', product: product(1, { stock: 1 }), quantity: 1 }), added);
  assert.equal(cartStoreReducer(added, { type: 'add', product: product(2), quantity: 0 }), added);
  const increased = cartStoreReducer(added, { type: 'increase', id: 1 });
  assert.equal(increased.cart.items[0].quantity, 3);
  assert.equal(cartStoreReducer(increased, { type: 'decrease', id: 1 }).cart.items[0].quantity, 2);
  assert.equal(cartStoreReducer(increased, { type: 'setQuantity', id: 1, quantity: 50 }).cart.items[0].quantity, 3);
  assert.deepEqual(cartStoreReducer(increased, { type: 'remove', id: 1 }).cart.items, []);
  assert.deepEqual(cartStoreReducer(increased, { type: 'clear' }).cart.items, []);
});

test('only normal cart contents persist; transient committed receipts do not survive restoration', () => {
  const next = run({ items: [] }, [line(1, 2), line(2, 3)]);
  let serialized;
  assert.equal(saveCart({ setItem: (_key, value) => { serialized = value; } }, next.cart), true);
  assert.deepEqual(JSON.parse(serialized), { version: 1, items: next.cart.items });
  assert.doesNotMatch(serialized, /requestId|reorderResult|acceptedCount|skippedCount/);
  assert.deepEqual(parseStoredCart(serialized), next.cart);
});

test('batch calculation makes no API requests and is deterministic for frozen input', (context) => {
  context.mock.method(globalThis, 'fetch', () => { throw new Error('No network permitted'); });
  const cart = Object.freeze({ items: Object.freeze([]) });
  const lines = Object.freeze([Object.freeze({ product: Object.freeze(product()), quantity: 2 })]);
  assert.deepEqual(run(cart, lines), run(cart, lines));
  assert.equal(fetch.mock.callCount(), 0);
});
