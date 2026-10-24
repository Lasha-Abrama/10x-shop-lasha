import { usdToCents } from '../money.ts';

// The fields this storefront uses from the DummyJSON product response.
export type Product = {
  id: number;
  title: string;
  category: string;
  price: number;
  rating?: number;
  thumbnail: string;
};

export type ProductDetails = Product & {
  description: string;
  images: string[];
  stock: number;
  brand?: string;
  availabilityStatus?: string;
  sku?: string;
  shippingInformation?: string;
  warrantyInformation?: string;
  returnPolicy?: string;
  minimumOrderQuantity?: number;
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

function isImageUrl(value: unknown): value is string {
  return isNonemptyString(value) && URL.canParse(value) && /^https?:\/\//.test(value);
}

function isProduct(value: unknown): value is Product & Record<string, unknown> {
  if (!isRecord(value)) return false;

  return isNonnegativeInteger(value.id) && value.id > 0
    && isNonemptyString(value.title)
    && isNonemptyString(value.category)
    && usdToCents(value.price) !== null
    && (value.rating === undefined || (typeof value.rating === 'number'
      && Number.isFinite(value.rating) && value.rating >= 0 && value.rating <= 5))
    && isImageUrl(value.thumbnail);
}

export function parseProductsResponse(value: unknown): ProductsResponse {
  if (!isRecord(value)
    || !Array.isArray(value.products) || !value.products.every(isProduct)
    || !isNonnegativeInteger(value.total)
    || !isNonnegativeInteger(value.skip)
    || !isNonnegativeInteger(value.limit)
    || value.products.length > value.limit
    || (value.products.length > 0 && value.skip + value.products.length > value.total)
    || new Set(value.products.map((product) => product.id)).size !== value.products.length) {
    throw new Error('The catalog service returned an unexpected response. Please try again.');
  }

  return { products: value.products, total: value.total, skip: value.skip, limit: value.limit };
}

export async function readProductResponse(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`The catalog service is unavailable (HTTP ${response.status}). Please try again.`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    throw new Error('The catalog service returned an unreadable response. Please try again.', { cause: error });
  }
  return data;
}

export async function getProducts(signal: AbortSignal): Promise<ProductsResponse> {
  const response = await fetch('https://dummyjson.com/products?limit=12&skip=0', { signal });
  return parseProductsResponse(await readProductResponse(response, signal));
}

export function parseProductId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function isProductDetails(value: unknown): value is ProductDetails {
  return isProduct(value)
    && isNonemptyString(value.description)
    && Array.isArray(value.images) && value.images.every(isImageUrl)
    && isNonnegativeInteger(value.stock)
    && ['brand', 'availabilityStatus', 'sku', 'shippingInformation', 'warrantyInformation', 'returnPolicy']
      .every((key) => value[key] === undefined || isNonemptyString(value[key]))
    && (value.minimumOrderQuantity === undefined
      || (isNonnegativeInteger(value.minimumOrderQuantity) && value.minimumOrderQuantity > 0));
}

export function parseProductDetails(value: unknown): ProductDetails {
  if (!isProductDetails(value)) {
    throw new Error('The catalog service returned unexpected product details. Please try again.');
  }

  return value;
}

export async function getProductDetails(value: string | undefined, signal: AbortSignal): Promise<ProductDetails | null> {
  const id = parseProductId(value);
  if (id === null) return null;
  const response = await fetch(`https://dummyjson.com/products/${id}`, { signal });
  if (response.status === 404) return null;
  const product = parseProductDetails(await readProductResponse(response, signal));
  if (product.id !== id) throw new Error('The catalog service returned the wrong product. Please try again.');
  return product;
}
