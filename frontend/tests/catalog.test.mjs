import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogParams, parseCatalogQuery, scheduleCatalogSearch } from '../src/catalog/query.ts';
import { catalogUrl, getCatalogPage, getCategories, parseCategories } from '../src/api/catalog.ts';

const defaults = { q: '', category: '', sort: 'default', page: 1 };
const product = (id, category = 'beauty', price = id) => ({ id, title: `Product ${id}`, category, price, rating: 5 - id / 100, thumbnail: 'https://example.com/product.webp' });

test('URL state round trips search, category, sorting and pagination', () => {
  const query = { q: 'red lipstick', category: 'beauty', sort: 'price-desc', page: 3 };
  assert.deepEqual(parseCatalogQuery(catalogParams(query)), query);
  assert.equal(catalogParams(defaults).toString(), '');
  for (const page of ['0', '-1', '1.2', 'Infinity', '999999999', '01']) {
    assert.equal(parseCatalogQuery(new URLSearchParams({ page })).page, 1);
  }
  assert.deepEqual(parseCatalogQuery(new URLSearchParams('sort=__proto__&category=../../x&page=NaN')), defaults);
  assert.equal(parseCatalogQuery(new URLSearchParams({ q: 'x'.repeat(120) })).q.length, 100);
});

test('query construction uses globally sorted and server-paginated endpoints', () => {
  for (const [query, path] of [
    [{ ...defaults, page: 3 }, '/products'],
    [{ ...defaults, q: 'phone & case', sort: 'price-asc' }, '/products/search'],
    [{ ...defaults, category: 'beauty', sort: 'rating-desc' }, '/products/category/beauty'],
  ]) {
    const url = new URL(catalogUrl(query));
    assert.equal(url.pathname, path);
    assert.equal(url.searchParams.get('limit'), '12');
    assert.equal(url.searchParams.get('skip'), String((query.page - 1) * 12));
    if (query.q) assert.equal(url.searchParams.get('q'), query.q);
    if (query.sort !== 'default') {
      assert.equal(url.searchParams.get('sortBy'), query.sort.split('-')[0]);
      assert.equal(url.searchParams.get('order'), query.sort.split('-')[1]);
    }
  }
});

test('loads the complete dynamic category list and rejects malformed or duplicate categories', async (context) => {
  const source = [{ slug: 'beauty', name: 'Beauty', url: 'ignored' }, { slug: 'home-decoration', name: 'Home Decoration' }];
  context.mock.method(globalThis, 'fetch', async () => Response.json(source));
  assert.deepEqual(await getCategories(new AbortController().signal), source.map(({ slug, name }) => ({ slug, name })));
  for (const invalid of [null, [], [{}], [{ slug: '../x', name: 'X' }], [source[0], source[0]]]) assert.throws(() => parseCategories(invalid));
});

test('combined search/category filters the entire sorted result set before paginating', async (context) => {
  const all = Array.from({ length: 40 }, (_, index) => product(40 - index, index % 2 ? 'beauty' : 'fragrances'));
  context.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    assert.equal(url.pathname, '/products/search');
    assert.equal(url.searchParams.get('limit'), '0');
    assert.equal(url.searchParams.get('skip'), '0');
    assert.equal(url.searchParams.get('sortBy'), 'price');
    assert.equal(url.searchParams.get('order'), 'desc');
    return Response.json({ products: all, total: 40, skip: 0, limit: 40 });
  });
  const page = await getCatalogPage({ q: 'product', category: 'beauty', sort: 'price-desc', page: 2 }, new AbortController().signal);
  assert.equal(page.total, 20);
  assert.deepEqual(page.products.map((item) => item.id), all.filter((item) => item.category === 'beauty').slice(12).map((item) => item.id));
  assert.ok(page.products.every((item) => item.category === 'beauty'));
  assert.ok(page.products.every((item, index) => !index || page.products[index - 1].price >= item.price));
});

test('incomplete combined results are rejected rather than filtering a partial page', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ products: [product(1)], total: 20, skip: 0, limit: 12 }));
  await assert.rejects(getCatalogPage({ ...defaults, q: 'product', category: 'beauty' }, new AbortController().signal), /incomplete search/);
});

test('accepts empty matches and out-of-range pages so UI can normalize the page', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ products: [], total: 0, skip: 0, limit: 0 }));
  assert.equal((await getCatalogPage(defaults, new AbortController().signal)).products.length, 0);
  context.mock.method(globalThis, 'fetch', async () => Response.json({ products: [], total: 194, skip: 240, limit: 0 }));
  assert.equal((await getCatalogPage({ ...defaults, page: 21 }, new AbortController().signal)).total, 194);
});

test('rejects incomplete pages, HTTP errors, network errors and malformed results for retry', async (context) => {
  for (const response of [Response.json({ products: [product(1)], total: 194, skip: 0, limit: 12 }), new Response('', { status: 503 }), Response.json({ products: null })]) {
    context.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(getCatalogPage(defaults, new AbortController().signal));
  }
  context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable'); });
  await assert.rejects(getCatalogPage(defaults, new AbortController().signal), TypeError);
});

test('a delayed response is ignored after abort, even if fetch ignores the signal', async (context) => {
  let finish;
  context.mock.method(globalThis, 'fetch', () => new Promise((resolve) => { finish = resolve; }));
  const controller = new AbortController();
  const request = getCatalogPage(defaults, controller.signal);
  controller.abort();
  finish(Response.json({ products: [product(1)], total: 1, skip: 0, limit: 12 }));
  await assert.rejects(request, { name: 'AbortError' });
});

test('search waits 300ms and cancels outdated input or navigation', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const values = [];
  const cancel = scheduleCatalogSearch(() => values.push('old'));
  context.mock.timers.tick(200);
  cancel();
  scheduleCatalogSearch(() => values.push('new'));
  context.mock.timers.tick(299);
  assert.deepEqual(values, []);
  context.mock.timers.tick(1);
  assert.deepEqual(values, ['new']);
  const navigate = scheduleCatalogSearch(() => values.push('stale'));
  navigate();
  context.mock.timers.tick(300);
  assert.deepEqual(values, ['new']);
});
