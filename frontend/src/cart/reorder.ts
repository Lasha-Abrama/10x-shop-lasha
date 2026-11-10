import { validateOrderItems } from '../api/orders.ts';
import { usdToCents } from '../money.ts';
import { cartReducer, getCartTotals } from './cart.ts';
import type { CartAction, CartProduct, CartState } from './cart.ts';

export type ReorderLine = { product: CartProduct; quantity: number };
type SkipReason = 'invalid-line' | 'duplicate-product' | 'stock' | 'quantity-limit' | 'product-limit' | 'unsafe-total' | 'invalid-cart';
type LineIdentity = { index: number; productId: number | null; quantity: number | null };
export type ReorderLineResult = LineIdentity & (
  | { status: 'accepted'; cartQuantity: number }
  | { status: 'skipped'; reason: SkipReason }
);
export type ReorderResult = {
  requestId: string;
  lines: ReorderLineResult[];
  acceptedCount: number;
  skippedCount: number;
  error: 'invalid-cart' | 'invalid-batch' | null;
};
export type CartStoreState = { cart: CartState; reorderResult: ReorderResult | null };
export type CartStoreAction = CartAction | { type: 'reorder'; requestId: string; lines: readonly ReorderLine[] };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validProduct(value: unknown): value is CartProduct {
  if (!record(value) || typeof value.id !== 'number'
    || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.thumbnail !== 'string' || !URL.canParse(value.thumbnail) || !/^https?:\/\//.test(value.thumbnail)
    || typeof value.stock !== 'number' || !Number.isSafeInteger(value.stock) || value.stock < 0 || usdToCents(value.price) === null) return false;
  // Reuse the existing checkout identity constraints without making a request.
  try { validateOrderItems([{ productId: value.id, quantity: 1 }]); return true; }
  catch { return false; }
}

function validLine(value: unknown): value is ReorderLine {
  return record(value) && validProduct(value.product) && typeof value.quantity === 'number'
    && Number.isSafeInteger(value.quantity) && value.quantity > 0;
}

function validCart(cart: CartState): boolean {
  try {
    if (!record(cart) || !Array.isArray(cart.items) || !cart.items.every(validProduct)) return false;
    if (cart.items.length) validateOrderItems(cart.items.map((item) => ({ productId: item.id, quantity: item.quantity })));
    getCartTotals(cart);
    return true;
  } catch { return false; }
}

function identity(line: unknown, index: number): LineIdentity {
  return { index,
    productId: record(line) && record(line.product) && typeof line.product.id === 'number' && Number.isSafeInteger(line.product.id) ? line.product.id : null,
    quantity: record(line) && typeof line.quantity === 'number' && Number.isSafeInteger(line.quantity) ? line.quantity : null };
}

export function calculateReorder(cart: CartState, lines: readonly ReorderLine[], requestId: string): CartStoreState {
  const result: ReorderResult = { requestId, lines: [], acceptedCount: 0, skippedCount: 0, error: null };
  if (!Array.isArray(lines)) return { cart, reorderResult: { ...result, error: 'invalid-batch' } };
  const cartIsValid = validCart(cart);
  if (!cartIsValid) result.error = 'invalid-cart';
  const counts = new Map<number, number>();
  lines.forEach((line, index) => {
    const id = identity(line, index).productId;
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  let next = cart;
  for (const [index, line] of lines.entries()) {
    const details = identity(line, index);
    let reason: SkipReason;
    if (!cartIsValid) reason = 'invalid-cart';
    else if (!validLine(line)) reason = 'invalid-line';
    else if ((counts.get(line.product.id) ?? 0) > 1) reason = 'duplicate-product';
    else {
      const existing = next.items.find((item) => item.id === line.product.id);
      const quantity = (existing?.quantity ?? 0) + line.quantity;
      if (quantity > 100) reason = 'quantity-limit';
      else if (quantity > line.product.stock) reason = 'stock';
      else if (!existing && next.items.length >= 20) reason = 'product-limit';
      else {
        const candidate = cartReducer(next, { type: 'add', product: line.product, quantity: line.quantity });
        if (candidate === next) reason = 'unsafe-total';
        else {
          next = candidate;
          result.lines.push({ ...details, status: 'accepted', cartQuantity: quantity });
          result.acceptedCount += 1;
          continue;
        }
      }
    }
    result.lines.push({ ...details, status: 'skipped', reason });
    result.skippedCount += 1;
  }
  return { cart: next, reorderResult: result };
}

// Context commits the cart and its receipt together; callers dispatch snapshots, never a precomputed cart.
export function cartStoreReducer(state: CartStoreState, action: CartStoreAction): CartStoreState {
  if (action.type === 'reorder') return calculateReorder(state.cart, action.lines, action.requestId);
  const cart = cartReducer(state.cart, action);
  return cart === state.cart ? state : { ...state, cart };
}
