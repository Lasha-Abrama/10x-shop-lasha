import { cartReducer, getCartTotals } from './cart.ts';
import type { CartItem, CartState } from './cart.ts';
import { usdToCents } from '../money.ts';

export const CART_STORAGE_KEY = '10x-shop.cart.v1';

function isStoredItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'number' && Number.isSafeInteger(item.id) && item.id > 0
    && typeof item.title === 'string' && item.title.trim().length > 0
    && usdToCents(item.price) !== null
    && typeof item.thumbnail === 'string' && URL.canParse(item.thumbnail) && /^https?:\/\//.test(item.thumbnail)
    && typeof item.stock === 'number' && Number.isSafeInteger(item.stock) && item.stock > 0
    && typeof item.quantity === 'number' && Number.isSafeInteger(item.quantity) && item.quantity > 0;
}

export function parseStoredCart(serialized: string | null): CartState {
  if (!serialized) return { items: [] };
  try {
    const value: unknown = JSON.parse(serialized);
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1
      || !('items' in value) || !Array.isArray(value.items) || !value.items.every(isStoredItem)) return { items: [] };
    return value.items.reduce<CartState>((state, item) => {
      const next = cartReducer(state, { type: 'add', product: item, quantity: item.quantity });
      if (next === state) throw new RangeError('Invalid stored cart totals.');
      return next;
    }, { items: [] });
  } catch {
    return { items: [] };
  }
}

export function loadCart(storage: Pick<Storage, 'getItem'>): CartState {
  try { return parseStoredCart(storage.getItem(CART_STORAGE_KEY)); }
  catch { return { items: [] }; }
}

export function saveCart(storage: Pick<Storage, 'setItem'>, state: CartState): boolean {
  try {
    getCartTotals(state);
    storage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, items: state.items }));
    return true;
  } catch { return false; }
}
