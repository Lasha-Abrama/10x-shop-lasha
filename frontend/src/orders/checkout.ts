import { createOrder, OrderApiError, validateOrderItems } from '../api/orders.ts';
import type { Order } from '../api/orders.ts';
import { getCartTotals } from '../cart/cart.ts';
import type { CartState } from '../cart/cart.ts';

export function checkoutError(cart: CartState): string | null {
  if (cart.items.length === 0) return 'Your bag is empty. Add something from the collection first.';
  try {
    validateOrderItems(cart.items.map((item) => ({ productId: item.id, quantity: item.quantity })));
    getCartTotals(cart);
    return null;
  } catch { return 'Review your bag: choose up to 20 different products, with 1–100 units each and within the displayed stock.'; }
}

// Clear only after a validated server confirmation; aborted or uncertain requests leave the bag intact.
export async function placeCartOrder(cart: CartState, token: string | null, signal: AbortSignal,
  onConfirmed: (order: Order) => void, baseUrl?: string): Promise<void> {
  const error = checkoutError(cart);
  if (error) throw new OrderApiError(error, 400);
  const order = await createOrder(cart.items.map((item) => ({ productId: item.id, quantity: item.quantity })), token, signal, baseUrl);
  signal.throwIfAborted();
  onConfirmed(order);
}
