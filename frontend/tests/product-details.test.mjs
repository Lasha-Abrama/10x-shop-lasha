import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProductDetails, parseProductDetails, parseProductId } from '../src/api/products.ts';
import { formatPrice } from '../src/format.ts';

const product = {
  id: 1, title: 'Essence Mascara Lash Princess', category: 'beauty', price: 9.99,
  rating: 2.56, thumbnail: 'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
  description: 'A volumizing and lengthening mascara.', stock: 99,
  images: ['https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp'],
  brand: 'Essence', availabilityStatus: 'In Stock', shippingInformation: 'Ships in 3-5 business days',
  warrantyInformation: '1 week warranty', returnPolicy: 'No return policy', minimumOrderQuantity: 48,
};

test('only accepts positive, canonical, safe integer product IDs', () => {
  assert.equal(parseProductId('1'), 1);
  assert.equal(parseProductId('194'), 194);
  for (const id of [undefined, '', '0', '-1', '1.5', '01', '1e2', ' 1 ', 'abc', 'Infinity', '9007199254740992', '1/2']) {
    assert.equal(parseProductId(id), null);
  }
});

test('invalid IDs return not-found without a network request', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not fetch'); });
  assert.equal(await getProductDetails('invalid', new AbortController().signal), null);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('accepts actual detail fields and optional omissions, zero stock, and empty image arrays', () => {
  assert.deepEqual(parseProductDetails(product), product);
  const { brand, rating, ...optional } = product;
  assert.equal(parseProductDetails(optional).brand, undefined);
  assert.deepEqual(parseProductDetails({ ...product, stock: 0, images: [] }).images, []);
});

test('rejects malformed details, unsafe images, invalid stock, and invalid optional attributes', () => {
  for (const invalid of [null, {}, { ...product, description: '' }, { ...product, stock: -1 },
    { ...product, stock: 1.5 }, { ...product, images: null }, { ...product, images: ['javascript:alert(1)'] },
    { ...product, images: ['https://'] }, { ...product, brand: 123 }, { ...product, minimumOrderQuantity: 0 }]) {
    assert.throws(() => parseProductDetails(invalid), /unexpected product details/);
  }
});

test('requests the single-product URL and forwards its AbortSignal', async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    assert.equal(url, 'https://dummyjson.com/products/1');
    assert.equal(signal, controller.signal);
    return Response.json(product);
  });
  assert.deepEqual(await getProductDetails('1', controller.signal), product);
});

test('404 is not-found; HTTP errors, invalid JSON, malformed data, and wrong IDs are retryable failures', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
  const signal = new AbortController().signal;
  assert.equal(await getProductDetails('99999', signal), null);
  fetchMock.mock.mockImplementation(async () => new Response('', { status: 503 }));
  await assert.rejects(getProductDetails('1', signal), /HTTP 503/);
  fetchMock.mock.mockImplementation(async () => new Response('not JSON'));
  await assert.rejects(getProductDetails('1', signal), /unreadable response/);
  fetchMock.mock.mockImplementation(async () => Response.json({ ...product, stock: '99' }));
  await assert.rejects(getProductDetails('1', signal), /unexpected product details/);
  fetchMock.mock.mockImplementation(async () => Response.json({ ...product, id: 2 }));
  await assert.rejects(getProductDetails('1', signal), /wrong product/);
});

test('network failures and aborts are preserved', async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    signal.throwIfAborted();
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(getProductDetails('1', controller.signal), TypeError);
  controller.abort();
  await assert.rejects(getProductDetails('1', controller.signal), { name: 'AbortError' });
});

test('USD formatting preserves cents, zero prices, and thousands separators', () => {
  assert.equal(formatPrice(9.99), '$9.99');
  assert.equal(formatPrice(0), '$0.00');
  assert.equal(formatPrice(1899.99), '$1,899.99');
});
