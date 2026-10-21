const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/database/prisma.service');
const { configureApp } = require('../dist/configure-app');
const { MAX_CENTS, usdToCents, isValidCents } = require('../dist/orders/money');

// Real JWT guard/HTTP validation, but no .env, real database or external catalog requests.
const nativeFetch = globalThis.fetch;
const product = (id = 1, extra = {}) => ({
  id, title: `Catalog product ${id}`, price: 9.99, stock: 99, availabilityStatus: 'In Stock', ...extra,
});
const body = { items: [{ productId: 1, quantity: 2 }] };

function project(record, select) {
  return Object.fromEntries(Object.entries(select).map(([key, value]) => [key, value === true ? record[key]
    : record[key].map((entry) => project(entry, value.select))]));
}

async function fixture(context) {
  process.env.JWT_SECRET = 'a'.repeat(64);
  process.env.FRONTEND_ORIGINS = 'http://localhost:5173';
  const user = { id: randomUUID(), email: 'orders@example.com', role: 'USER', createdAt: new Date(), updatedAt: new Date() };
  const otherUser = { ...user, id: randomUUID(), email: 'other@example.com' };
  const users = new Map([[user.id, user], [otherUser.id, otherUser]]);
  const orders = new Map();
  const calls = { catalog: [], create: [], transactions: 0, list: [], find: [], rollbacks: 0 };
  const behavior = { catalog: (id) => new Response(JSON.stringify(product(id))), persistenceFailure: false, readFailure: false };
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://dummyjson.com/')) return nativeFetch(url, options);
    calls.catalog.push({ url, options });
    return behavior.catalog(Number(new URL(url).pathname.split('/').pop()));
  });
  const prisma = {
    user: { findUnique: async ({ where }) => users.get(where.id) ?? null },
    $transaction: async (callback) => {
      calls.transactions += 1;
      const pending = new Map();
      const tx = { order: { create: async (args) => {
        calls.create.push(args);
        const now = new Date();
        const order = { ...args.data, id: randomUUID(), createdAt: now, updatedAt: now,
          items: args.data.items.create.map((item) => ({ ...item, id: randomUUID(), createdAt: now })) };
        pending.set(order.id, order);
        if (behavior.persistenceFailure) throw new Error('Private persistence diagnostic');
        return project(order, args.select);
      } } };
      try {
        const result = await callback(tx);
        for (const [id, order] of pending) orders.set(id, order);
        return result;
      } catch (error) { calls.rollbacks += 1; throw error; }
    },
    order: {
      findMany: async (args) => {
        calls.list.push(args);
        if (behavior.readFailure) throw new Error('Private persistence diagnostic');
        return [...orders.values()].filter((order) => order.userId === args.where.userId)
          .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
          .slice(0, args.take).map((order) => project(order, args.select));
      },
      findFirst: async (args) => {
        calls.find.push(args);
        if (behavior.readFailure) throw new Error('Private persistence diagnostic');
        const order = orders.get(args.where.id);
        return order?.userId === args.where.userId ? project(order, args.select) : null;
      },
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue(prisma).compile();
  const app = module.createNestApplication({ logger: false });
  context.after(() => app.close());
  configureApp(app, ['http://localhost:5173']);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const jwt = module.get(JwtService);
  const token = await jwt.signAsync({ sub: user.id, role: 'USER' });
  const otherToken = await jwt.signAsync({ sub: otherUser.id, role: 'USER' });
  async function request(path = '/orders', { data, authorization = `Bearer ${token}` } = {}) {
    const response = await nativeFetch(`${base}${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { ...(authorization ? { Authorization: authorization } : {}),
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  return { user, users, otherUser, otherToken, jwt, token, orders, calls, behavior, request };
}

test('all order routes enforce the existing JWT guard and reject deleted users', async (context) => {
  const api = await fixture(context);
  const expired = await api.jwt.signAsync({ sub: api.user.id, role: 'USER' }, { expiresIn: -1 });
  for (const authorization of ['', 'Bearer malformed', `Bearer ${expired}`]) {
    for (const [path, data] of [['/orders', body], ['/orders', undefined], [`/orders/${randomUUID()}`, undefined]]) {
      assert.equal((await api.request(path, { data, authorization })).status, 401);
    }
  }
  api.users.delete(api.user.id);
  assert.equal((await api.request('/orders', { data: body })).status, 401);
  assert.equal(api.calls.catalog.length, 0);
  assert.equal(api.calls.transactions, 0);
});

test('order DTO rejects malformed input and all browser-controlled financial/identity fields', async (context) => {
  const cases = [undefined, null, [], {}, { items: [] }, { items: null }, { items: {} }, { items: [null] }, { items: [1] },
    { items: Array.from({ length: 21 }, (_, index) => ({ productId: index + 1, quantity: 1 })) },
    ...[0, -1, 1.5, '1', 2_147_483_648, 'https://untrusted.example'].map((productId) => ({ items: [{ productId, quantity: 1 }] })),
    ...[0, -1, 1.5, '1', 101, null].map((quantity) => ({ items: [{ productId: 1, quantity }] })),
    ...['userId', 'role', 'price', 'totalCents', 'status', 'currency'].map((field) => ({ ...body, [field]: 'untrusted' })),
    ...['title', 'price', 'unitPriceCents', 'stock'].map((field) => ({ items: [{ ...body.items[0], [field]: 1 }] })),
  ];
  for (const [index, data] of cases.entries()) {
    await context.test(`invalid payload ${index}`, async (subcontext) => {
      const api = await fixture(subcontext);
      // {} exercises a missing body field; undefined would mean GET in this HTTP helper.
      const response = await api.request('/orders', { data: data === undefined ? {} : data });
      assert.equal(response.status, 400);
      // Express rejects a top-level JSON null before Nest's DTO validation runs.
      if (data !== null) assert.equal(response.body.message, 'Invalid request body.');
      assert.equal(api.calls.catalog.length, 0);
      assert.equal(api.calls.transactions, 0);
    });
  }
});

test('duplicate products are rejected before catalog requests or a transaction', async (context) => {
  const api = await fixture(context);
  const response = await api.request('/orders', { data: { items: [body.items[0], body.items[0]] } });
  assert.equal(response.status, 400);
  assert.equal(api.calls.catalog.length, 0);
  assert.equal(api.calls.transactions, 0);
});

test('creates PENDING_PAYMENT order atomically from fresh catalog snapshots with safe fields', async (context) => {
  const api = await fixture(context);
  api.behavior.catalog = (id) => new Response(JSON.stringify(product(id, { price: id === 1 ? 12.34 : 0 })));
  const response = await api.request('/orders', { data: { items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] } });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(response.body).sort(), ['createdAt', 'currency', 'id', 'items', 'status', 'totalCents', 'updatedAt']);
  assert.equal(response.body.status, 'PENDING_PAYMENT');
  assert.equal(response.body.currency, 'USD');
  assert.equal(response.body.totalCents, 2468);
  assert.deepEqual(Object.keys(response.body.items[0]).sort(), ['id', 'lineTotalCents', 'productId', 'quantity', 'title', 'unitPriceCents']);
  assert.equal(response.body.items[0].title, 'Catalog product 1');
  assert.equal(response.body.items[0].unitPriceCents, 1234);
  assert.equal(response.body.items[0].lineTotalCents, 2468);
  assert.equal(api.calls.transactions, 1);
  assert.equal(api.calls.create.length, 1);
  assert.equal(api.calls.create[0].data.userId, api.user.id);
  assert.equal(api.orders.size, 1);
  assert.deepEqual(api.calls.catalog.map((call) => call.url), ['https://dummyjson.com/products/1', 'https://dummyjson.com/products/2']);
  for (const { options } of api.calls.catalog) {
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
  }
  // Reading a snapshot must not refetch or rewrite it after upstream price/title changes.
  api.behavior.catalog = () => { throw new Error('Catalog must not be called for order reads'); };
  const read = await api.request(`/orders/${response.body.id}`);
  assert.deepEqual(read.body, response.body);
  assert.equal(api.calls.catalog.length, 2);
});

test('availability, stock and quantity limits reject the complete order before persistence', async (context) => {
  for (const [index, extra] of [{ stock: 0 }, { availabilityStatus: 'Out of Stock' }, { stock: 1 }].entries()) {
    await context.test(`unavailable ${index}`, async (subcontext) => {
      const api = await fixture(subcontext);
      api.behavior.catalog = (id) => new Response(JSON.stringify(product(id, extra)));
      assert.equal((await api.request('/orders', { data: body })).status, 409);
      assert.equal(api.calls.transactions, 0);
      assert.equal(api.orders.size, 0);
    });
  }
  await context.test('quantity 100 accepted at exact stock, Low Stock is available', async (subcontext) => {
    const api = await fixture(subcontext);
    api.behavior.catalog = (id) => new Response(JSON.stringify(product(id, { stock: 100, availabilityStatus: 'Low Stock' })));
    const response = await api.request('/orders', { data: { items: [{ productId: 1, quantity: 100 }] } });
    assert.equal(response.status, 201);
    assert.equal(response.body.totalCents, 99900);
  });
});

test('money rejects non-finite, negative and unsafe conversions without capping', () => {
  for (const value of [1e308, Infinity, NaN, -1, Number.MAX_SAFE_INTEGER / 100, (MAX_CENTS + 1) / 100, '9.99', null]) {
    assert.equal(usdToCents(value), null);
  }
  assert.equal(usdToCents(0), 0);
  assert.equal(usdToCents(9.99), 999);
  assert.equal(usdToCents(1.234), 123);
  assert.equal(usdToCents(MAX_CENTS / 100), MAX_CENTS);
  for (const value of [Infinity, NaN, -1, 0.5, MAX_CENTS + 1, Number.MAX_SAFE_INTEGER + 1]) assert.equal(isValidCents(value), false);
});

test('rejects line and aggregate overflow with no partial order', async (context) => {
  for (const [name, price, items] of [
    ['line', MAX_CENTS / 100, [{ productId: 1, quantity: 2 }]],
    ['aggregate', 10_737_418.24, [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }]],
  ]) {
    await context.test(name, async (subcontext) => {
      const api = await fixture(subcontext);
      api.behavior.catalog = (id) => new Response(JSON.stringify(product(id, { price })));
      assert.equal((await api.request('/orders', { data: { items } })).status, 400);
      assert.equal(api.calls.transactions, 0);
      assert.equal(api.orders.size, 0);
    });
  }
});

test('invalid catalog products fail safely without persistence', async (context) => {
  const cases = [null, [], { ...product(), id: 2 }, { ...product(), title: '' }, { ...product(), title: 'x'.repeat(501) },
    ...[1e308, Infinity, NaN, -0.01, (MAX_CENTS + 1) / 100, '9.99'].map((price) => product(1, { price })),
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '99'].map((stock) => product(1, { stock })),
    ...[undefined, null, 'unknown', ['In Stock']].map((availabilityStatus) => product(1, { availabilityStatus })),
  ];
  for (const [index, value] of cases.entries()) {
    await context.test(`invalid upstream ${index}`, async (subcontext) => {
      const api = await fixture(subcontext);
      api.behavior.catalog = () => new Response(JSON.stringify(value));
      const response = await api.request('/orders', { data: body });
      assert.equal(response.status, 503);
      assert.match(response.body.message, /invalid data/);
      assert.equal(api.calls.transactions, 0);
    });
  }
});

test('catalog 404, HTTP errors, network/timeout and unreadable responses create no orders', async (context) => {
  for (const [name, handler, status] of [
    ['missing', () => new Response('{}', { status: 404 }), 409],
    ['upstream failure', () => new Response('{}', { status: 500 }), 503],
    ['rate limit', () => new Response('{}', { status: 429 }), 503],
    ['network', () => { throw new Error('Private upstream diagnostic'); }, 503],
    ['timeout', () => { throw new DOMException('Private timeout', 'TimeoutError'); }, 503],
    ['unreadable', () => new Response('not JSON'), 503],
  ]) {
    await context.test(name, async (subcontext) => {
      const api = await fixture(subcontext);
      api.behavior.catalog = (id) => id === 1 ? new Response(JSON.stringify(product(id))) : handler();
      const response = await api.request('/orders', { data: { items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }] } });
      assert.equal(response.status, status);
      assert.equal(JSON.stringify(response.body).includes('Private'), false);
      assert.equal(api.calls.transactions, 0);
      assert.equal(api.orders.size, 0);
    });
  }
});

test('persistence failure rolls back the nested order/items transaction and sanitizes diagnostics', async (context) => {
  const api = await fixture(context);
  api.behavior.persistenceFailure = true;
  const response = await api.request('/orders', { data: body });
  assert.equal(response.status, 503);
  assert.equal(response.body.message, 'The order could not be saved. Please try again later.');
  assert.equal(api.calls.transactions, 1);
  assert.equal(api.calls.rollbacks, 1);
  assert.equal(api.orders.size, 0);
  assert.equal(api.calls.create[0].data.items.create.length, 1);
});

test('listing and detail enforce ownership, limit lists, and never return user relations', async (context) => {
  const api = await fixture(context);
  assert.deepEqual((await api.request()).body, []);
  const created = await api.request('/orders', { data: body });
  assert.equal(created.status, 201);
  const id = created.body.id;
  const list = await api.request();
  assert.deepEqual(list.body, [created.body]);
  assert.equal(list.headers.get('cache-control'), 'no-store');
  assert.equal(api.calls.list.at(-1).take, 50);
  assert.deepEqual(api.calls.list.at(-1).where, { userId: api.user.id });
  assert.deepEqual(api.calls.list.at(-1).orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  const stranger = { authorization: `Bearer ${api.otherToken}` };
  assert.deepEqual((await api.request('/orders', stranger)).body, []);
  assert.equal((await api.request(`/orders/${id}`, stranger)).status, 404);
  assert.deepEqual(api.calls.find.at(-1).where, { id, userId: api.otherUser.id });
  assert.equal((await api.request(`/orders/${randomUUID()}`)).status, 404);
  assert.equal((await api.request('/orders/not-a-uuid')).status, 400);
  assert.equal(api.calls.catalog.length, 1);
  const template = api.orders.get(id);
  for (let index = 0; index < 55; index += 1) {
    const seeded = { ...template, id: randomUUID(), createdAt: new Date(Date.now() + index * 1000) };
    api.orders.set(seeded.id, seeded);
  }
  const bounded = await api.request();
  assert.equal(bounded.body.length, 50);
  for (let index = 1; index < bounded.body.length; index += 1) {
    assert.ok(Date.parse(bounded.body[index - 1].createdAt) >= Date.parse(bounded.body[index].createdAt));
  }
});

test('database read errors are sanitized and creation is rate limited', async (context) => {
  const api = await fixture(context);
  api.behavior.readFailure = true;
  for (const path of ['/orders', `/orders/${randomUUID()}`]) {
    const response = await api.request(path);
    assert.equal(response.status, 503);
    assert.equal(response.body.message, 'Orders are temporarily unavailable.');
  }
  for (let count = 0; count < 10; count += 1) assert.equal((await api.request('/orders', { data: {} })).status, 400);
  assert.equal((await api.request('/orders', { data: body })).status, 429);
  assert.equal(api.calls.catalog.length, 0);
  assert.equal(api.calls.transactions, 0);
});
