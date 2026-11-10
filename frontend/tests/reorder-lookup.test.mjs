import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEventListeners } from 'node:events';
import { prepareReorder } from '../src/orders/reorder.ts';
import { calculateReorder } from '../src/cart/reorder.ts';

const historical = (productId = 1, quantity = 2) => ({ productId, quantity, title: `Recorded ${productId}` });
const product = (id = 1, overrides = {}) => ({ id, title: `Current ${id}`, category: 'beauty', price: 12.99,
  thumbnail: 'https://example.com/product.png', stock: 10, description: 'Current catalog data', images: [], ...overrides });
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function controlledClock(context) {
  let now = 0, id = 0;
  const timers = new Map();
  context.mock.method(globalThis, 'setTimeout', (callback, ms) => {
    assert.equal(ms, 20_000, 'One finite deadline covers the whole preparation');
    const key = ++id;
    timers.set(key, { callback, at: now + ms });
    return key;
  });
  context.mock.method(globalThis, 'clearTimeout', (key) => timers.delete(key));
  return { timers, tick(ms) {
    now += ms;
    for (const [key, timer] of timers) if (timer.at <= now) { timers.delete(key); timer.callback(); }
  } };
}

test('prepares exact historical quantities with current data, without mutating history or using recorded prices', async (context) => {
  const clock = controlledClock(context);
  const controller = new AbortController();
  const original = Object.freeze({ ...historical(1, 3), unitPriceCents: 1, lineTotalCents: 3 });
  const history = Object.freeze([original]);
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    assert.equal(url, 'https://dummyjson.com/products/1');
    assert.deepEqual(Object.keys(options), ['signal']);
    assert.equal(options.signal.aborted, false);
    return Response.json(product());
  });
  const result = await prepareReorder(history, controller.signal);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.inputs, [{ product: product(), quantity: 3 }]);
  assert.deepEqual(result.outcomes, [{ historical: historical(1, 3), status: 'prepared' }]);
  assert.equal(original.unitPriceCents, 1);
  assert.equal(original.lineTotalCents, 3);
  assert.equal(original.title, 'Recorded 1');
  const batch = calculateReorder({ items: [] }, result.inputs, 'prepared-1');
  assert.equal(batch.cart.items[0].price, 12.99);
  assert.equal(batch.cart.items[0].quantity, 3);
  assert.equal(batch.reorderResult.acceptedCount, 1);
  assert.equal(calls.length, 1);
  assert.equal(clock.timers.size, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(getEventListeners(calls[0].options.signal, 'abort').length, 0);
});

test('at most three lookups include response-body processing; out-of-order completions preserve history order', async (context) => {
  const clock = controlledClock(context);
  const gates = new Map();
  const paths = [];
  let active = 0, peak = 0;
  context.mock.method(globalThis, 'fetch', async (url) => {
    paths.push(url);
    const id = Number(url.split('/').at(-1));
    active += 1; peak = Math.max(peak, active);
    const gate = deferred(); gates.set(id, gate);
    const response = Response.json(product(id));
    context.mock.method(response, 'json', async () => {
      await gate.promise;
      active -= 1;
      return product(id);
    });
    return response;
  });
  const pending = prepareReorder([1, 2, 3, 4, 5].map((id) => historical(id, id)), new AbortController().signal);
  await flush();
  assert.equal(active, 3);
  assert.equal(paths.length, 3);
  gates.get(3).resolve(); await flush();
  assert.equal(paths.length, 4);
  gates.get(1).resolve(); await flush();
  assert.equal(paths.length, 5);
  for (const id of [5, 4, 2]) { gates.get(id).resolve(); await flush(); }
  const result = await pending;
  assert.equal(peak, 3);
  assert.equal(active, 0);
  assert.deepEqual(paths, [1, 2, 3, 4, 5].map((id) => `https://dummyjson.com/products/${id}`));
  assert.deepEqual(result.inputs.map(({ product, quantity }) => [product.id, quantity]), [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
  assert.deepEqual(result.outcomes.map(({ historical }) => historical.productId), [1, 2, 3, 4, 5]);
  assert.equal(clock.timers.size, 0);
});

test('classifies unavailable, malformed, wrong-identity and transient failures while preserving independent successes', async (context) => {
  const clock = controlledClock(context);
  context.mock.method(globalThis, 'fetch', async (url) => {
    const id = Number(url.split('/').at(-1));
    if (id === 2) return new Response('', { status: 404 });
    if (id === 3) return Response.json(product(id, { stock: 0 }));
    if (id === 4) return Response.json(product(id, { stock: 1 }));
    if (id === 5) return Response.json(product(id, { price: -1 }));
    if (id === 6) return Response.json(product(99));
    if (id === 7) throw new TypeError('Network unavailable');
    if (id === 8) return new Response('', { status: 503 });
    if (id === 9) return new Response('Not JSON');
    return Response.json(product(id));
  });
  const result = await prepareReorder(Array.from({ length: 9 }, (_, i) => historical(i + 1)), new AbortController().signal);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.inputs.map(({ product }) => product.id), [1]);
  assert.deepEqual(result.outcomes.map((outcome) => outcome.status === 'excluded' ? outcome.reason : 'prepared'),
    ['prepared', 'missing', 'out-of-stock', 'insufficient-stock', 'invalid-response', 'invalid-response', 'request-failed', 'request-failed', 'invalid-response']);
  assert.deepEqual(result.outcomes.map(({ historical }) => historical.title), Array.from({ length: 9 }, (_, i) => `Recorded ${i + 1}`));
  assert.equal(clock.timers.size, 0);
});

test('all ordinary lookup failures return no usable inputs and release timer/listeners', async (context) => {
  const clock = controlledClock(context);
  const controller = new AbortController();
  const signals = [];
  context.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    signals.push(signal); throw new TypeError('Offline');
  });
  const result = await prepareReorder([historical(1), historical(2)], controller.signal);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.inputs, []);
  assert.equal(result.outcomes.length, 2);
  assert.ok(result.outcomes.every((outcome) => outcome.reason === 'request-failed'));
  assert.equal(clock.timers.size, 0);
  for (const signal of [controller.signal, ...signals]) assert.equal(getEventListeners(signal, 'abort').length, 0);
});

test('rejects empty, malformed, duplicate and oversized history before timers or requests', async (context) => {
  const clock = controlledClock(context);
  const fetch = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  const controller = new AbortController();
  const invalid = [null, undefined, {}, [], [null], new Array(1), [historical(1), historical(1)],
    Array.from({ length: 21 }, (_, i) => historical(i + 1)),
    ...[0, -1, 1.5, NaN, Infinity, '1', 2_147_483_648].map((id) => [historical(id)]),
    ...[0, -1, 1.5, NaN, Infinity, '2', 101].map((quantity) => [historical(1, quantity)]),
    ...['', ' ', 'x'.repeat(501), null].map((title) => [{ ...historical(), title }])];
  for (const history of invalid) assert.deepEqual(await prepareReorder(history, controller.signal), { status: 'invalid-input', inputs: [], outcomes: [] });
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(clock.timers.size, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('20-second operation deadline aborts active requests, prevents queued starts and exposes no partial inputs', async (context) => {
  const clock = controlledClock(context);
  const controller = new AbortController();
  const signals = [], pendingResponses = [];
  context.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    signals.push(signal);
    const id = Number(url.split('/').at(-1));
    if (id === 1) return Response.json(product(id));
    const response = deferred(); pendingResponses.push({ id, response });
    return response.promise; // Deliberately ignore abort to verify bounded completion.
  });
  let settled = false;
  const pending = prepareReorder([1, 2, 3, 4, 5, 6].map((id) => historical(id)), controller.signal);
  void pending.then(() => { settled = true; });
  await flush();
  assert.equal(signals.length, 4);
  clock.tick(19_999); await flush();
  assert.equal(settled, false);
  clock.tick(1);
  const result = await pending;
  assert.equal(result.status, 'timeout');
  assert.deepEqual(result.inputs, []);
  assert.equal(result.outcomes[0].status, 'prepared');
  assert.ok(result.outcomes.slice(1).every((outcome) => outcome.reason === 'timeout'));
  assert.ok(signals.every((signal) => signal.aborted));
  const snapshot = structuredClone(result);
  for (const { id, response } of pendingResponses) response.resolve(Response.json(product(id)));
  await flush();
  assert.equal(signals.length, 4, 'No queued lookups start after expiry, even on late responses');
  assert.deepEqual(result, snapshot);
  assert.equal(clock.timers.size, 0);
  for (const signal of [controller.signal, ...signals]) assert.equal(getEventListeners(signal, 'abort').length, 0);
});

test('caller abort before start rejects with its reason and makes zero requests', async (context) => {
  const clock = controlledClock(context);
  const fetch = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(prepareReorder([historical()], controller.signal), (error) => error === controller.signal.reason);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(clock.timers.size, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('caller abort cancels three active fetches, prevents queued starts and cleans up', async (context) => {
  const clock = controlledClock(context);
  const controller = new AbortController();
  const signals = []; let canceled = 0;
  context.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    signals.push(signal);
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => { canceled += 1; reject(signal.reason); }, { once: true }));
  });
  const pending = prepareReorder([1, 2, 3, 4, 5].map((id) => historical(id)), controller.signal);
  assert.equal(signals.length, 3);
  controller.abort();
  await assert.rejects(pending, (error) => error === controller.signal.reason);
  await flush();
  assert.equal(canceled, 3);
  assert.equal(signals.length, 3);
  assert.equal(clock.timers.size, 0);
  for (const signal of [controller.signal, ...signals]) assert.equal(getEventListeners(signal, 'abort').length, 0);
});

test('caller abort remains bounded even when fetch ignores cancellation and later returns data', async (context) => {
  const clock = controlledClock(context);
  const controller = new AbortController(); const gates = [];
  context.mock.method(globalThis, 'fetch', async () => { const gate = deferred(); gates.push(gate); return gate.promise; });
  let usable;
  const pending = prepareReorder([1, 2, 3, 4].map((id) => historical(id)), controller.signal).then((result) => { usable = result; return result; });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  for (let i = 0; i < gates.length; i++) gates[i].resolve(Response.json(product(i + 1)));
  await flush();
  assert.equal(usable, undefined);
  assert.equal(gates.length, 3);
  assert.equal(clock.timers.size, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('abort after response arrival but before preparation completion cannot return usable data', async (context) => {
  const clock = controlledClock(context);
  const controller = new AbortController(); let arrived = false, usable;
  context.mock.method(globalThis, 'fetch', async () => {
    const response = Response.json(product());
    context.mock.method(response, 'json', async () => { arrived = true; controller.abort(); return product(); });
    return response;
  });
  await assert.rejects(prepareReorder([historical()], controller.signal).then((result) => { usable = result; }), { name: 'AbortError' });
  assert.equal(arrived, true);
  assert.equal(usable, undefined);
  assert.equal(clock.timers.size, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('final existing-cart stock and capacity decisions remain the batch reducer responsibility', async (context) => {
  controlledClock(context);
  context.mock.method(globalThis, 'fetch', async () => Response.json(product(1, { stock: 3 })));
  const cart = Object.freeze({ items: Object.freeze([Object.freeze({ ...product(), quantity: 2 })]) });
  const result = await prepareReorder(Object.freeze([Object.freeze(historical(1, 2))]), new AbortController().signal);
  assert.equal(result.inputs[0].quantity, 2);
  const committed = calculateReorder(cart, result.inputs, 'latest-state');
  assert.equal(committed.cart, cart);
  assert.equal(committed.reorderResult.lines[0].reason, 'stock');
  assert.equal(cart.items[0].quantity, 2);
});
