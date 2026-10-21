import { getApiBaseUrl } from './auth.ts';

export type OrderRequestItem = { productId: number; quantity: number };
export type OrderItem = OrderRequestItem & { id: string; title: string; unitPriceCents: number; lineTotalCents: number };
export type Order = {
  id: string;
  status: 'PENDING_PAYMENT';
  currency: 'USD';
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export class OrderApiError extends Error {
  readonly status: number | undefined;
  readonly uncertain: boolean;
  constructor(message: string, status?: number, uncertain = false) {
    super(message); this.status = status; this.uncertain = uncertain;
  }
}

const MAX_CENTS = 2_147_483_647;
export function isOrderId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function invalidResponse(): OrderApiError {
  return new OrderApiError('The order service returned an unexpected response. Please try again.');
}

export function parseOrder(value: unknown): Order {
  if (!record(value) || !isOrderId(value.id) || value.status !== 'PENDING_PAYMENT' || value.currency !== 'USD'
    || !integer(value.totalCents, 0, MAX_CENTS)
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
    || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 20) throw invalidResponse();
  const items: OrderItem[] = value.items.map((item: unknown) => {
    if (!record(item) || !isOrderId(item.id) || !integer(item.productId, 1, MAX_CENTS)
      || !integer(item.quantity, 1, 100) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500
      || !integer(item.unitPriceCents, 0, MAX_CENTS) || !integer(item.lineTotalCents, 0, MAX_CENTS)
      || item.unitPriceCents * item.quantity !== item.lineTotalCents) throw invalidResponse();
    return { id: item.id, productId: item.productId, title: item.title, quantity: item.quantity,
      unitPriceCents: item.unitPriceCents, lineTotalCents: item.lineTotalCents };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length
    || new Set(items.map((item) => item.productId)).size !== items.length
    || items.reduce((sum, item) => sum + item.lineTotalCents, 0) !== value.totalCents) throw invalidResponse();
  return { id: value.id, status: value.status, currency: value.currency, totalCents: value.totalCents,
    createdAt: value.createdAt, updatedAt: value.updatedAt, items };
}

export function validateOrderItems(items: readonly OrderRequestItem[]): void {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20
    || !items.every((item) => record(item) && integer(item.productId, 1, MAX_CENTS) && integer(item.quantity, 1, 100))
    || new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new OrderApiError('Review your bag: use 1–20 different products and 1–100 units of each.', 400);
  }
}

async function request(path: string, token: string | null, signal: AbortSignal, body?: string, baseUrl?: string): Promise<unknown> {
  if (!token) throw new OrderApiError('Please sign in to continue.', 401);
  const url = `${getApiBaseUrl(baseUrl)}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), credentials: 'omit', cache: 'no-store', redirect: 'error',
    });
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    throw new OrderApiError('We couldn’t reach the order service. Please check your connection.', undefined, body !== undefined);
  }
  if (!response.ok) {
    const message = response.status === 401 ? 'Your session has ended. Please sign in again.'
      : response.status === 404 ? 'This order is not available for your account.'
      : response.status === 409 ? 'A product is unavailable or its stock has changed. Review your bag before trying again.'
      : response.status === 400 ? 'Your selection could not be accepted. Review the quantities in your bag.'
      : response.status === 429 ? 'Too many attempts. Please wait a minute before trying again.'
      : 'The order service or product catalog is unavailable. Please try again later.';
    throw new OrderApiError(message, response.status, body !== undefined && response.status >= 500);
  }
  if (response.status !== (body === undefined ? 200 : 201)) throw new OrderApiError(invalidResponse().message, undefined, body !== undefined);
  try { return await response.json(); }
  catch (error: unknown) {
    if (signal.aborted) throw error;
    throw new OrderApiError(invalidResponse().message, undefined, body !== undefined);
  }
}

export async function createOrder(items: readonly OrderRequestItem[], token: string | null, signal: AbortSignal, baseUrl?: string): Promise<Order> {
  validateOrderItems(items);
  const body = JSON.stringify({ items: items.map(({ productId, quantity }) => ({ productId, quantity })) });
  const data = await request('/orders', token, signal, body, baseUrl);
  try {
    const order = parseOrder(data);
    if (order.items.length !== items.length || !items.every((item) => order.items.some((saved) =>
      saved.productId === item.productId && saved.quantity === item.quantity))) throw invalidResponse();
    return order;
  } catch { throw new OrderApiError(invalidResponse().message, undefined, true); }
}

export async function getOrders(token: string | null, signal: AbortSignal, baseUrl?: string): Promise<Order[]> {
  const data = await request('/orders', token, signal, undefined, baseUrl);
  if (!Array.isArray(data) || data.length > 50) throw invalidResponse();
  const orders = data.map(parseOrder);
  if (new Set(orders.map((order) => order.id)).size !== orders.length) throw invalidResponse();
  return orders;
}

export async function getOrder(id: string, token: string | null, signal: AbortSignal, baseUrl?: string): Promise<Order> {
  if (!isOrderId(id)) throw new OrderApiError('This order could not be found.', 404);
  const order = parseOrder(await request(`/orders/${id}`, token, signal, undefined, baseUrl));
  if (order.id.toLowerCase() !== id.toLowerCase()) throw invalidResponse();
  return order;
}
