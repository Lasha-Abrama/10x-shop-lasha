export const PAGE_SIZE = 12;
export const SORT_OPTIONS = {
  default: 'Default',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'rating-desc': 'Rating: high to low',
  'title-asc': 'Name A–Z',
} as const;
export type CatalogSort = keyof typeof SORT_OPTIONS;
export type CatalogQuery = { q: string; category: string; sort: CatalogSort; page: number };

export function catalogPageNumbers(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const visible = [1];
  for (let next = Math.max(2, page - 1); next <= Math.min(totalPages - 1, page + 1); next += 1) visible.push(next);
  visible.push(totalPages);
  const result: (number | null)[] = [];
  for (const next of visible) {
    const previous = result.at(-1);
    if (typeof previous === 'number' && next - previous > 1) result.push(next - previous === 2 ? previous + 1 : null);
    result.push(next);
  }
  return result;
}

export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const q = (params.get('q') ?? '').trim().slice(0, 100);
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? '';
  const page = params.get('page') ?? '1';
  return {
    q,
    // Nonempty search wins for legacy URLs containing both modes.
    category: !q && /^[a-z]+(?:-[a-z]+)*$/.test(category) && category.length <= 60 ? category : '',
    sort: Object.hasOwn(SORT_OPTIONS, sort) ? sort as CatalogSort : 'default',
    page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  };
}

export function catalogParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  const q = query.q.trim();
  if (q) params.set('q', q);
  else if (query.category) params.set('category', query.category);
  if (query.sort !== 'default') params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  return params;
}

// Each new input or navigation cancels the previous scheduled URL update.
export function scheduleCatalogSearch(update: () => void): () => void {
  const timer = setTimeout(update, 400);
  return () => clearTimeout(timer);
}
