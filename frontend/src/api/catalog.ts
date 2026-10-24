import { parseProductsResponse, readProductResponse } from './products.ts';
import type { ProductsResponse } from './products.ts';
import { PAGE_SIZE } from '../catalog/query.ts';
import type { CatalogQuery } from '../catalog/query.ts';

export type Category = { slug: string; name: string };

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
  const combined = Boolean(query.q && query.category);
  const path = query.q ? '/search' : query.category ? `/category/${encodeURIComponent(query.category)}` : '';
  const params = new URLSearchParams({ limit: String(combined ? 0 : PAGE_SIZE), skip: String(combined ? 0 : (query.page - 1) * PAGE_SIZE) });
  if (query.q) params.set('q', query.q);
  if (query.sort !== 'default') {
    const [field, order] = query.sort.split('-');
    params.set('sortBy', field);
    params.set('order', order);
  }
  params.set('select', 'id,title,category,price,rating,thumbnail');
  return `https://dummyjson.com/products${path}?${params}`;
}

export async function getCatalogPage(query: CatalogQuery, signal: AbortSignal): Promise<ProductsResponse> {
  const response = await fetch(catalogUrl(query), { signal });
  const data = parseProductsResponse(await readProductResponse(response, signal));
  signal.throwIfAborted();
  const combined = Boolean(query.q && query.category);
  const skip = (query.page - 1) * PAGE_SIZE;
  if (combined) {
    // DummyJSON ignores category on search. Filter ALL sorted matches before slicing.
    if (data.skip !== 0 || data.products.length !== data.total) {
      throw new Error('The catalog returned incomplete search results. Please try again.');
    }
    const matches = data.products.filter((product) => product.category === query.category);
    return { products: matches.slice(skip, skip + PAGE_SIZE), total: matches.length, skip, limit: PAGE_SIZE };
  }
  if (data.skip !== skip || data.products.length > PAGE_SIZE
    || data.products.length !== Math.min(PAGE_SIZE, Math.max(0, data.total - skip))) {
    throw new Error('The catalog returned an incomplete page. Please try again.');
  }
  return data;
}
