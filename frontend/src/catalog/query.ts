export const PAGE_SIZE = 12;
export const SORT_OPTIONS = {
  default: 'Catalog order',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'rating-desc': 'Top rated',
} as const;
export type CatalogSort = keyof typeof SORT_OPTIONS;
export type CatalogQuery = { q: string; category: string; sort: CatalogSort; page: number };

export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? '';
  const page = params.get('page') ?? '1';
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    category: /^[a-z]+(?:-[a-z]+)*$/.test(category) && category.length <= 60 ? category : '',
    sort: Object.hasOwn(SORT_OPTIONS, sort) ? sort as CatalogSort : 'default',
    page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  };
}

export function catalogParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.sort !== 'default') params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  return params;
}

// Each new input or navigation cancels the previous scheduled URL update.
export function scheduleCatalogSearch(update: () => void): () => void {
  const timer = setTimeout(update, 300);
  return () => clearTimeout(timer);
}
