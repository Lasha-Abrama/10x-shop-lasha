import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOrder, getOrder, getOrders, isOrderId, OrderApiError, parseOrder } from '../src/api/orders.ts';
import { checkoutError, placeCartOrder } from '../src/orders/checkout.ts';
import { authPath, safeReturnTo } from '../src/auth/returnTo.ts';
import { cartReducer } from '../src/cart/cart.ts';

const base = 'http://localhost:3000';
const token = 'test.payload.signature';
const signal = () => new AbortController().signal;
const id = '368fa243-bfd2-4cf6-89de-538a0e899204';
const itemId = '01a936c3-3fd4-4397-b513-089bf01d6dba';
const order = { id, status: 'PENDING_PAYMENT', currency: 'USD', totalCents: 2468,
  createdAt: '2026-10-21T13:00:00.000Z', updatedAt: '2026-10-21T13:00:00.000Z',
  items: [{ id: itemId, productId: 1, title: 'Server title', quantity: 2, unitPriceCents: 1234, lineTotalCents: 2468 }] };
const cart = { items: [{ id: 1, title: 'Browser snapshot', price: 9.99, stock: 99, quantity: 2, thumbnail: 'https://example.com/1.png' }] };
const items = [{ productId: 1, quantity: 2 }];

test('safe guest return destinations survive login/registration but never redirect outside known routes', () => {
  for (const destination of ['/checkout', '/orders', '/account', `/orders/${id}`]) {
    assert.equal(safeReturnTo(destination), destination);
    for (const mode of ['login', 'register']) {
      const link = new URL(authPath(mode, destination), 'http://localhost:5173');
      assert.equal(link.origin, 'http://localhost:5173');
      assert.equal(link.pathname, `/${mode}`);
      assert.equal(safeReturnTo(link.searchParams.get('returnTo')), destination);
    }
  }
  for (const destination of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/checkout?token=secret',
    '/checkout#hash', '/orders/../login', '/admin', '/orders/not-a-uuid', '/%2F%2Fevil.example']) {
    assert.equal(safeReturnTo(destination), '/account');
    assert.equal(authPath('login', destination), '/login');
  }
});

test('checkout rejects empty, oversized, duplicate and invalid-quantity bags', () => {
  assert.equal(checkoutError(cart), null);
  assert.match(checkoutError({ items: [] }), /empty/);
  for (const quantity of [0, -1, 1.5, 100, 101, NaN, Infinity]) {
    assert.ok(checkoutError({ items: [{ ...cart.items[0], quantity }] })); // 100 is above this snapshot's stock.
  }
  assert.ok(checkoutError({ items: [cart.items[0], cart.items[0]] }));
  assert.ok(checkoutError({ items: Array.from({ length: 21 }, (_, index) => ({ ...cart.items[0], id: index + 1 })) }));
  for (const price of [Infinity, NaN, -1, 1e308]) assert.ok(checkoutError({ items: [{ ...cart.items[0], price }] }));
});

test('guest and invalid selections make no order request and cannot clear the bag', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not fetch'); });
  let cleared = false;
  const clear = () => { cleared = true; };
  await assert.rejects(placeCartOrder(cart, null, signal(), clear, base), (error) => error.status === 401);
  for (const invalid of [{ items: [] }, { items: [{ ...cart.items[0], quantity: 101 }] }]) {
    await assert.rejects(placeCartOrder(invalid, token, signal(), clear, base), (error) => error.status === 400);
  }
  await assert.rejects(getOrders(null, signal(), base), (error) => error.status === 401);
  await assert.rejects(getOrder(id, null, signal(), base), (error) => error.status === 401);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(cleared, false);
});

test('create sends IDs/quantities only with the memory token in a bearer header', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, base + '/orders');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { items });
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(order, { status: 201 });
  });
  assert.deepEqual(await createOrder([{ ...items[0], price: 0.01, title: 'Untrusted', stock: 100, userId: 'forged' }], token, signal(), base), order);
});

test('pending submission does not clear anything; confirmed server totals clear the cart exactly once', async (context) => {
  let finish;
  context.mock.method(globalThis, 'fetch', () => new Promise((resolve) => { finish = resolve; }));
  let state = structuredClone(cart);
  let calls = 0;
  let confirmation;
  const submission = placeCartOrder(state, token, signal(), (saved) => {
    calls += 1;
    confirmation = saved;
    state = cartReducer(state, { type: 'clear' });
  }, base);
  assert.deepEqual(state, cart);
  assert.equal(calls, 0);
  finish(Response.json(order, { status: 201 }));
  await submission;
  assert.equal(calls, 1);
  assert.deepEqual(state, { items: [] });
  assert.deepEqual(confirmation, order);
  assert.equal(confirmation.items[0].title, 'Server title');
  assert.notEqual(confirmation.totalCents, Math.round(cart.items[0].price * cart.items[0].quantity * 100));
});

test('HTTP errors keep the bag intact and never expose backend diagnostics', async (context) => {
  let status;
  context.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Private database or upstream detail' }, { status }));
  let confirmed = 0;
  for (status of [400, 401, 404, 409, 429, 500, 503]) {
    await assert.rejects(placeCartOrder(cart, token, signal(), () => { confirmed += 1; }, base), (error) =>
      error instanceof OrderApiError && error.status === status && !error.message.includes('Private') && error.uncertain === (status >= 500));
  }
  assert.equal(confirmed, 0);
  assert.equal(cart.items.length, 1);
});

test('uncertain POST results are identified without automatic retries or cart clearing', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Private network detail'); });
  let confirmed = 0;
  for (const implementation of [
    async () => { throw new TypeError('Private network detail'); },
    async () => new Response('<html>broken response</html>', { status: 201 }),
    async () => Response.json({ message: 'not an order' }, { status: 201 }),
    async () => Response.json(order, { status: 200 }),
    async () => Response.json({ ...order, items: [{ ...order.items[0], productId: 2 }] }, { status: 201 }),
  ]) {
    fetch.mock.mockImplementation(implementation);
    const before = fetch.mock.callCount();
    await assert.rejects(placeCartOrder(cart, token, signal(), () => { confirmed += 1; }, base), (error) =>
      error instanceof OrderApiError && error.uncertain && !error.message.includes('Private'));
    assert.equal(fetch.mock.callCount() - before, 1);
  }
  assert.equal(confirmed, 0);
});

test('malformed snapshots, unsafe totals and unsupported status/currency never become confirmation data', () => {
  assert.deepEqual(parseOrder({ ...order, userId: 'omitted', user: { passwordHash: 'omitted' } }), order);
  const cases = [null, [], {}, { ...order, id: 'bad' }, { ...order, status: 'PAID' }, { ...order, currency: 'EUR' },
    { ...order, createdAt: 'not-a-date' }, { ...order, items: [] },
    ...[Infinity, NaN, -1, 0.5, 2_147_483_648, 1e308, 999].map((totalCents) => ({ ...order, totalCents })),
    ...[0, 101, '2', 0.5].map((quantity) => ({ ...order, items: [{ ...order.items[0], quantity }] })),
    { ...order, items: [{ ...order.items[0], lineTotalCents: 999 }] },
    { ...order, items: [{ ...order.items[0], unitPriceCents: -1 }] },
    { ...order, items: [{ ...order.items[0], title: '' }] },
    { ...order, items: [{ ...order.items[0], id: 'bad' }] },
    { ...order, items: [order.items[0], order.items[0]], totalCents: 4936 },
  ];
  for (const value of cases) assert.throws(() => parseOrder(value), OrderApiError);
});

test('cancellation before or immediately after response never clears a bag after unmount/logout', async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, 'fetch', async () => {
    const response = Response.json(order, { status: 201 });
    context.mock.method(response, 'json', async () => { controller.abort(); return order; });
    return response;
  });
  let confirmed = 0;
  await assert.rejects(placeCartOrder(cart, token, controller.signal, () => { confirmed += 1; }, base), { name: 'AbortError' });
  assert.equal(confirmed, 0);
});

test('listing uses only the bearer identity and supports real, empty and bounded arrays', async (context) => {
  let response = [order];
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, base + '/orders');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    return Response.json(response);
  });
  assert.deepEqual(await getOrders(token, signal(), base), [order]);
  response = [];
  assert.deepEqual(await getOrders(token, signal(), base), []);
  for (response of [{ orders: [order] }, [order, order], Array(51).fill(order), [null]]) {
    await assert.rejects(getOrders(token, signal(), base), OrderApiError);
  }
});

test('detail validates UUIDs, matches the returned ID and treats missing/other-user orders alike', async (context) => {
  let response = order;
  let status = 200;
  const fetch = context.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url === base + `/orders/${id}` || url === base + '/orders');
    return Response.json(response, { status });
  });
  for (const invalid of ['1', '../users', 'https://evil.example', '', `${id}?token=secret`]) {
    assert.equal(isOrderId(invalid), false);
    await assert.rejects(getOrder(invalid, token, signal(), base), (error) => error.status === 404);
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.deepEqual(await getOrder(id, token, signal(), base), order);
  response = { ...order, id: '8d9acd67-1c60-42b8-83cd-d06449e06db5' };
  await assert.rejects(getOrder(id, token, signal(), base), /unexpected response/);
  status = 404;
  response = { message: 'Not found' };
  await assert.rejects(getOrder(id, token, signal(), base), (error) => error.status === 404 && /not available for your account/.test(error.message));
  status = 401;
  await assert.rejects(getOrders(token, signal(), base), (error) => error.status === 401 && /session has ended/.test(error.message));
});
