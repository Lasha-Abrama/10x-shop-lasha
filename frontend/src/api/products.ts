// The fields this storefront uses from the DummyJSON product response.
export type Product = {
  id: number;
  title: string;
  category: string;
  price: number;
  rating?: number;
  thumbnail: string;
};

export type ProductsResponse = {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value)) return false;

  return isNonnegativeInteger(value.id) && value.id > 0
    && isNonemptyString(value.title)
    && isNonemptyString(value.category)
    && typeof value.price === 'number' && Number.isFinite(value.price) && value.price >= 0
    && (value.rating === undefined || (typeof value.rating === 'number'
      && Number.isFinite(value.rating) && value.rating >= 0 && value.rating <= 5))
    && isNonemptyString(value.thumbnail) && /^https?:\/\//.test(value.thumbnail);
}

export function parseProductsResponse(value: unknown): ProductsResponse {
  if (!isRecord(value)
    || !Array.isArray(value.products) || !value.products.every(isProduct)
    || !isNonnegativeInteger(value.total)
    || !isNonnegativeInteger(value.skip)
    || !isNonnegativeInteger(value.limit)
    || value.products.length > value.limit
    || value.skip + value.products.length > value.total
    || new Set(value.products.map((product) => product.id)).size !== value.products.length) {
    throw new Error('The catalog service returned an unexpected response. Please try again.');
  }

  return { products: value.products, total: value.total, skip: value.skip, limit: value.limit };
}

export async function getProducts(signal: AbortSignal): Promise<ProductsResponse> {
  const response = await fetch('https://dummyjson.com/products?limit=12&skip=0', { signal });
  if (!response.ok) {
    throw new Error(`The catalog service is unavailable (HTTP ${response.status}). Please try again.`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    throw new Error('The catalog service returned an unreadable response. Please try again.');
  }
  return parseProductsResponse(data);
}
