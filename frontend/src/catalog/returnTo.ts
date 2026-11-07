import { catalogParams, parseCatalogQuery } from './query.ts';

export function safeCatalogReturnTo(value: unknown): string {
  if (typeof value !== 'string' || (value !== '/products' && !value.startsWith('/products?'))
    || /[\\#\p{Control}]/u.test(value)) return '/products';
  const params = catalogParams(parseCatalogQuery(new URLSearchParams(value.slice('/products'.length)))).toString();
  return `/products${params ? `?${params}` : ''}`;
}
