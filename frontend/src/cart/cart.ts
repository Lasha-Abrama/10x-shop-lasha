import type { ProductDetails } from '../api/products';
import { centsToUsd, usdToCents } from '../money.ts';

export type CartProduct = Pick<ProductDetails, 'id' | 'title' | 'price' | 'thumbnail' | 'stock'>;
export type CartItem = CartProduct & { quantity: number };
export type CartState = { items: CartItem[] };
export type CartAction =
  | { type: 'add'; product: CartProduct; quantity: number }
  | { type: 'increase' | 'decrease' | 'remove'; id: number }
  | { type: 'setQuantity'; id: number; quantity: number }
  | { type: 'clear' };

export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === 'clear') return { items: [] };
  if (action.type === 'remove') return { items: state.items.filter((item) => item.id !== action.id) };

  if (action.type === 'add') {
    if (!Number.isSafeInteger(action.product.stock) || action.product.stock <= 0
      || !Number.isSafeInteger(action.quantity) || action.quantity < 1) return state;
    const existing = state.items.find((item) => item.id === action.product.id);
    const item: CartItem = {
      id: action.product.id, title: action.product.title, price: action.product.price,
      thumbnail: action.product.thumbnail, stock: action.product.stock,
      quantity: Math.min(action.product.stock, (existing?.quantity ?? 0) + action.quantity),
    };
    return acceptCart(state, { items: existing ? state.items.map((entry) => entry.id === item.id ? item : entry) : [...state.items, item] });
  }

  if (action.type === 'setQuantity' && !Number.isSafeInteger(action.quantity)) return state;
  return acceptCart(state, {
    items: state.items.map((item) => {
      if (item.id !== action.id) return item;
      const quantity = action.type === 'setQuantity' ? action.quantity
        : item.quantity + (action.type === 'increase' ? 1 : -1);
      return { ...item, quantity: Math.max(1, Math.min(item.stock, quantity)) };
    }),
  });
}

function itemCents(item: CartItem): number {
  const price = usdToCents(item.price);
  if (price === null || !Number.isSafeInteger(item.stock) || item.stock < 1
    || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > item.stock) {
    throw new RangeError('Invalid cart price or quantity.');
  }
  const cents = price * item.quantity;
  if (centsToUsd(cents) === null) throw new RangeError('Cart line exceeds safe monetary bounds.');
  return cents;
}

export function getItemSubtotal(item: CartItem): number {
  return itemCents(item) / 100;
}

export function getCartTotals(state: CartState): { itemCount: number; subtotal: number } {
  let itemCount = 0;
  let cents = 0;
  for (const item of state.items) {
    cents += itemCents(item);
    itemCount += item.quantity;
    if (centsToUsd(cents) === null || !Number.isSafeInteger(itemCount)) {
      throw new RangeError('Cart exceeds safe total bounds.');
    }
  }
  return { itemCount, subtotal: cents / 100 };
}

// Validate the complete candidate before allowing any change into Context or storage.
function acceptCart(previous: CartState, candidate: CartState): CartState {
  try { getCartTotals(candidate); return candidate; }
  catch { return previous; }
}
