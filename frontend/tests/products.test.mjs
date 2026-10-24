import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProducts, parseProductsResponse } from '../src/api/products.ts';

const product = {
  id: 1,
  title: 'Essence Mascara Lash Princess',
  category: 'beauty',
  price: 9.99,
  rating: 2.56,
  thumbnail: 'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
};
const response = { products: [product], total: 194, skip: 0, limit: 12 };

test('accepts a catalog response, an absent rating, and an empty result', () => {
  assert.deepEqual(parseProductsResponse(response), response);
  const { rating, ...unrated } = product;
  assert.equal(parseProductsResponse({ ...response, products: [unrated] }).products[0].rating, undefined);
  assert.deepEqual(parseProductsResponse({ products: [], total: 0, skip: 0, limit: 12 }).products, []);
});

test('rejects malformed products and inconsistent pagination instead of displaying them', () => {
  for (const invalid of [null, {}, { ...response, total: '194' },
    { ...response, products: [{ ...product, price: '9.99' }] },
    { ...response, products: [{ ...product, price: -1 }] },
    { ...response, products: [{ ...product, rating: 6 }] },
    { ...response, products: [{ ...product, thumbnail: 'javascript:alert(1)' }] },
    { ...response, products: [product, product] },
    { ...response, total: 0 }, { ...response, limit: 0 }]) {
    assert.throws(() => parseProductsResponse(invalid), /unexpected response/);
  }
});

test('rejects HTTP image strings that have a scheme but no valid URL', () => {
  for (const thumbnail of ['https://', 'http://[broken']) {
    assert.equal(URL.canParse(thumbnail), false);
    assert.throws(() => parseProductsResponse({ ...response, products: [{ ...product, thumbnail }] }), /unexpected response/);
  }
});

test('fetches the required URL with the supplied AbortSignal', async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://dummyjson.com/products?limit=12&skip=0');
    assert.equal(options.signal, controller.signal);
    return Response.json(response);
  });
  assert.deepEqual(await getProducts(controller.signal), response);
});

test('rejects non-finite, negative and unsafe API prices', () => {
  for (const price of [1e308, Infinity, NaN, -1, (Number.MAX_SAFE_INTEGER + 1) / 100]) {
    assert.throws(() => parseProductsResponse({ ...response, products: [{ ...product, price }] }), /unexpected response/);
  }
  for (const price of [0, 0.1, 19.99, 2499.99]) {
    assert.equal(parseProductsResponse({ ...response, products: [{ ...product, price }] }).products[0].price, price);
  }
});

test('rejects HTTP failure, invalid JSON, and malformed successful responses', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  const signal = new AbortController().signal;
  await assert.rejects(getProducts(signal), /HTTP 503/);
  fetchMock.mock.mockImplementation(async () => new Response('<html>Unavailable</html>'));
  await assert.rejects(getProducts(signal), /unreadable response/);
  fetchMock.mock.mockImplementation(async () => Response.json({ products: null }));
  await assert.rejects(getProducts(signal), /unexpected response/);
});

test('preserves network and cancellation failures for the loading lifecycle', async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    signal.throwIfAborted();
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(getProducts(controller.signal), TypeError);
  controller.abort();
  await assert.rejects(getProducts(controller.signal), { name: 'AbortError' });
});
