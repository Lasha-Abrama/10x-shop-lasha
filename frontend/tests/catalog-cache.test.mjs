import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { getCatalogPage } from '../src/api/catalog.ts';

const query = { q: 'eye', category: '', sort: 'default', page: 1 };
const product = (id, title = `Eye ${id}`) => ({ id, title, category: 'beauty', price: id, rating: 4, thumbnail: 'https://example.com/product.webp' });
const response = (products) => Response.json({ products, total: products.length, skip: 0, limit: products.length });
const load = (change = {}, signal = new AbortController().signal) => getCatalogPage({ ...query, ...change }, signal);
let now = 0;
beforeEach((context) => {
  now += 60_001;
  context.mock.method(Date, 'now', () => now);
});

test('completed searches reuse normalized keys across pages, retain global order and isolate returned products', async (context) => {
  const all = Array.from({ length: 30 }, (_, i) => product(30 - i));
  all.splice(4, 0, product(156, 'Green and Black Glasses'));
  const fetch = context.mock.method(globalThis, 'fetch', async () => response(all));
  const first = await load({ sort: 'price-desc' });
  first.products[0].title = 'Caller mutation';
  first.products.reverse();
  for (const page of [1, 2, 3, 2]) {
    const result = await load({ q: ' \tEYE ', sort: 'price-desc', page });
    assert.equal(result.total, 30);
    assert.equal(result.limit, 12);
    assert.deepEqual(result.products.map((p) => p.id), Array.from({ length: 30 }, (_, i) => 30 - i).slice((page - 1) * 12, page * 12));
    assert.ok(result.products.every((p) => p.title.startsWith('Eye')));
  }
  assert.equal(fetch.mock.callCount(), 1);
  await load({ q: 'shadow' });
  for (const sort of ['default', 'price-asc', 'rating-desc', 'title-asc']) await load({ sort });
  assert.equal(fetch.mock.callCount(), 6);
});

test('TTL expires exactly 60 seconds after completion and cache hits do not extend it', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => response([product(1)]));
  await load();
  now += 59_999;
  await load();
  assert.equal(fetch.mock.callCount(), 1);
  now += 1;
  await load();
  assert.equal(fetch.mock.callCount(), 2);
});

test('TTL begins when the validated response completes, not when its request starts', async (context) => {
  let finish;
  const fetch = context.mock.method(globalThis, 'fetch', () => new Promise((resolve) => { finish = resolve; }));
  const pending = load();
  now += 30_000;
  finish(response([product(1)]));
  await pending;
  now += 59_999;
  await load();
  assert.equal(fetch.mock.callCount(), 1);
  now += 1;
  fetch.mock.mockImplementation(async () => response([product(1)]));
  await load();
  assert.equal(fetch.mock.callCount(), 2);
});

test('five-entry limit evicts the least recently used entry, including empty results', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => response([]));
  for (const q of ['one', 'two', 'three', 'four', 'five']) await load({ q });
  await load({ q: 'one' });
  await load({ q: 'six' });
  await load({ q: 'one' });
  assert.equal(fetch.mock.callCount(), 6);
  await load({ q: 'two' });
  assert.equal(fetch.mock.callCount(), 7);
});

test('500-record bound evicts old results and oversized results are never retained', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async (input) => {
    const q = new URL(input).searchParams.get('q');
    const count = q === 'oversize' ? 501 : 250;
    return response(Array.from({ length: count }, (_, i) => product(i + 1, `${q} ${i}`)));
  });
  await load({ q: 'one' });
  await load({ q: 'two' });
  await load({ q: 'one' });
  assert.equal(fetch.mock.callCount(), 2); // Exactly 500 retained records.
  await load({ q: 'three' });
  await load({ q: 'one' });
  assert.equal(fetch.mock.callCount(), 3);
  await load({ q: 'two' });
  assert.equal(fetch.mock.callCount(), 4);
  await load({ q: 'oversize' });
  await load({ q: 'oversize' });
  assert.equal(fetch.mock.callCount(), 6);
});

test('HTTP/network, unreadable, malformed and incomplete failures are not cached; retry succeeds', async (context) => {
  for (const failure of [
    () => new Response('', { status: 503 }),
    () => { throw new TypeError('Offline'); },
    () => new Response('{'),
    () => Response.json({ products: null }),
    () => Response.json({ products: [product(1)], total: 20, skip: 0, limit: 12 }),
  ]) {
    now += 60_001;
    const fetch = context.mock.method(globalThis, 'fetch', async () => failure());
    await assert.rejects(load());
    await assert.rejects(load());
    assert.equal(fetch.mock.callCount(), 2);
    fetch.mock.mockImplementation(async () => response([product(1)]));
    await load();
    await load();
    assert.equal(fetch.mock.callCount(), 3);
  }
});

test('aborted cold responses and cache hits cannot commit stale UI state', async (context) => {
  let finish;
  const fetch = context.mock.method(globalThis, 'fetch', () => new Promise((resolve) => { finish = resolve; }));
  const old = new AbortController();
  let visible = 'new route';
  const pending = load({}, old.signal).then(() => { if (!old.signal.aborted) visible = 'stale'; });
  old.abort();
  finish(response([product(1)]));
  await assert.rejects(pending, { name: 'AbortError' });
  fetch.mock.mockImplementation(async () => response([product(2)]));
  await load();
  assert.equal(fetch.mock.callCount(), 2);
  const hitController = new AbortController();
  const hit = load({}, hitController.signal).then(() => { if (!hitController.signal.aborted) visible = 'stale'; });
  hitController.abort();
  await assert.rejects(hit, { name: 'AbortError' });
  await assert.rejects(load({}, hitController.signal), { name: 'AbortError' });
  assert.equal(visible, 'new route');
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal((await load()).products[0].id, 2);
});

test('pending requests remain independent and default/category requests remain uncached', async (context) => {
  const finish = [];
  const fetch = context.mock.method(globalThis, 'fetch', () => new Promise((resolve) => { finish.push(resolve); }));
  const pending = [load(), load()];
  assert.equal(fetch.mock.callCount(), 2);
  for (const resolve of finish) resolve(response([product(1)]));
  await Promise.all(pending);
  fetch.mock.mockImplementation(async () => response([]));
  for (const category of ['', 'beauty']) {
    await load({ q: '', category });
    await load({ q: '', category });
  }
  assert.equal(fetch.mock.callCount(), 6);
});
