import { useEffect, useRef, useState } from 'react';
import { getProductDetails } from '../api/products';
import { useCart } from '../cart/CartContext';
import { cartReducer } from '../cart/cart';

export function CardBagButton({ productId, title }: { productId: number; title: string }) {
  const { state, dispatch } = useCart();
  const currentCart = useRef(state);
  currentCart.current = state;
  const request = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => () => request.current?.abort(), []);

  async function add() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFeedback('');
    try {
      // List responses omit stock. Fetch fresh details only when the visitor adds a product.
      const product = await getProductDetails(String(productId), controller.signal);
      if (controller.signal.aborted) return;
      if (!product || product.stock === 0) { setFeedback('This product is currently unavailable.'); return; }
      const inBag = currentCart.current.items.find((item) => item.id === product.id)?.quantity ?? 0;
      if (inBag >= product.stock) { setFeedback('Stock limit reached for this product.'); return; }
      const action = { type: 'add', product, quantity: 1 } as const;
      if (cartReducer(currentCart.current, action) === currentCart.current) {
        setFeedback('This selection exceeds safe bag limits. Please review your bag.');
        return;
      }
      dispatch(action);
      setFeedback('1 item added to your bag. Current price and stock checked.');
    } catch {
      if (!controller.signal.aborted) setFeedback('Couldn’t check this product. Your bag is unchanged. Please try again.');
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return <div className="mt-4">
    <button type="button" onClick={() => { void add(); }} disabled={pending} aria-label={`Add ${title} to bag`} aria-busy={pending}
      className="min-h-11 w-full rounded-editorial border border-line px-4 py-2.5 text-sm transition-colors hover:border-ink hover:bg-surface disabled:cursor-wait disabled:opacity-60">{pending ? 'Checking availability…' : 'Add to Bag'}</button>
    <p role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-muted">{feedback}</p>
  </div>;
}
