import { parseProductsResponse, readProductResponse } from './products.ts';
import type { Product, ProductsResponse } from './products.ts';
import { PAGE_SIZE } from '../catalog/query.ts';
import type { CatalogQuery } from '../catalog/query.ts';

export type Category = { slug: string; name: string };

const SEARCH_CACHE_TTL = 60_000;
const SEARCH_CACHE_ENTRIES = 5;
const SEARCH_CACHE_RECORDS = 500;
const searchCache = new Map<string, { expires: number; products: Product[] }>();

function cacheSearch(key: string, products: Product[]) {
  if (products.length > SEARCH_CACHE_RECORDS) return;
  searchCache.delete(key);
  searchCache.set(key, { expires: Date.now() + SEARCH_CACHE_TTL, products });
  while (searchCache.size > SEARCH_CACHE_ENTRIES
    || [...searchCache.values()].reduce((total, entry) => total + entry.products.length, 0) > SEARCH_CACHE_RECORDS) {
    searchCache.delete(searchCache.keys().next().value!);
  }
}

export function parseCategories(value: unknown): Category[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Categories are unavailable. Please try again.');
  const categories = value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('slug' in item) || !('name' in item)
      || typeof item.slug !== 'string' || !/^[a-z]+(?:-[a-z]+)*$/.test(item.slug) || item.slug.length > 60
      || typeof item.name !== 'string' || !item.name.trim()) {
      throw new Error('The catalog returned unexpected categories. Please try again.');
    }
    return { slug: item.slug, name: item.name };
  });
  if (new Set(categories.map((item) => item.slug)).size !== categories.length) {
    throw new Error('The catalog returned duplicate categories. Please try again.');
  }
  return categories;
}

export async function getCategories(signal: AbortSignal): Promise<Category[]> {
  const response = await fetch('https://dummyjson.com/products/categories', { signal });
  const data = await readProductResponse(response, signal);
  signal.throwIfAborted();
  return parseCategories(data);
}

export function catalogUrl(query: CatalogQuery): string {
  const search = query.q.trim().toLowerCase();
  const path = search ? '/search' : query.category ? `/category/${encodeURIComponent(query.category)}` : '';
  const params = new URLSearchParams({ limit: String(search ? 0 : PAGE_SIZE), skip: String(search ? 0 : (query.page - 1) * PAGE_SIZE) });
  if (search) params.set('q', search);
  if (query.sort !== 'default') {
    const [field, order] = query.sort.split('-');
    params.set('sortBy', field);
    params.set('order', order);
  }
  params.set('select', 'id,title,category,price,rating,thumbnail');
  return `https://dummyjson.com/products${path}?${params}`;
}

export async function getCatalogPage(query: CatalogQuery, signal: AbortSignal): Promise<ProductsResponse> {
  signal.throwIfAborted();
  const search = query.q.trim().toLowerCase();
  const key = JSON.stringify([search, query.sort]);
  const skip = (query.page - 1) * PAGE_SIZE;
  const searchPage = (products: Product[]): ProductsResponse => ({
    products: products.slice(skip, skip + PAGE_SIZE).map((product) => ({ ...product })),
    total: products.length, skip, limit: PAGE_SIZE,
  });
  if (search) {
    for (const [cachedKey, entry] of searchCache) {
      if (entry.expires <= Date.now()) searchCache.delete(cachedKey);
    }
    const cached = searchCache.get(key);
    if (cached) {
      searchCache.delete(key);
      searchCache.set(key, cached);
      // Give navigation cleanup a chance to cancel even a completed-cache hit.
      await Promise.resolve();
      signal.throwIfAborted();
      return searchPage(cached.products);
    }
  }
  const response = await fetch(catalogUrl(query), { signal });
  const data = parseProductsResponse(await readProductResponse(response, signal));
  signal.throwIfAborted();
  if (search) {
    // DummyJSON also searches descriptions. Filter ALL sorted candidates before slicing.
    if (data.skip !== 0 || data.products.length !== data.total) {
      throw new Error('The catalog returned incomplete search results. Please try again.');
    }
    const matches = data.products.filter((product) => product.title.toLowerCase().includes(search));
    cacheSearch(key, matches);
    return searchPage(matches);
  }
  if (data.skip !== skip || data.products.length > PAGE_SIZE
    || data.products.length !== Math.min(PAGE_SIZE, Math.max(0, data.total - skip))) {
    throw new Error('The catalog returned an incomplete page. Please try again.');
  }
  return data;
}
