import { useState } from 'react';
import { Link } from 'react-router';
import { useCart } from '../cart/CartContext';
import { getCartTotals, getItemSubtotal } from '../cart/cart';
import type { CartItem } from '../cart/cart';
import { QuantitySelector } from '../components/QuantitySelector';
import { formatPrice } from '../format';

export function CartPage() {
  const { state, dispatch } = useCart();
  const { itemCount, subtotal } = getCartTotals(state);
  const [feedback, setFeedback] = useState('');

  return (
    <section aria-labelledby="cart-heading" className="page-width pb-20 pt-10 lg:pb-28 lg:pt-16">
      <nav aria-label="Breadcrumb" className="mb-9 flex gap-3 text-xs text-muted"><Link className="nav-link" to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Your bag</span></nav>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-8">
        <h1 id="cart-heading" className="section-title">Your bag.</h1>
        <p className="text-sm text-muted">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
      </div>
      <p role="status" aria-live="polite" className="mb-5 text-sm text-muted">{feedback}</p>
      {state.items.length === 0 ? (
        <div className="py-12 sm:py-20">
          <h2 className="font-display text-4xl sm:text-5xl">Room for something good.</h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted">Your bag is empty. Find a few everyday essentials to make it your own.</p>
          <Link className="primary-link mt-8" to="/products">Explore the collection</Link>
        </div>
      ) : (
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div>
            <h2 className="sr-only">Products in your bag</h2>
            <ul>
              {state.items.map((item) => <CartLine key={item.id} item={item} onRemove={() => { dispatch({ type: 'remove', id: item.id }); setFeedback(`${item.title} removed from your bag.`); }} />)}
            </ul>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-5 text-sm">
              <Link className="text-link inline-flex items-center" to="/products">Continue exploring</Link>
              <button type="button" className="text-link" onClick={() => { dispatch({ type: 'clear' }); setFeedback('Your bag has been cleared.'); }}>Clear bag</button>
            </div>
          </div>
          <aside aria-labelledby="summary-heading" className="rounded-editorial bg-surface p-7 sm:p-8">
            <h2 id="summary-heading" className="font-display text-3xl">A considered selection.</h2>
            <dl className="my-7 border-y border-line py-5"><div className="flex justify-between gap-4"><dt>Subtotal</dt><dd className="tabular-nums">{formatPrice(subtotal)}</dd></div></dl>
            <p className="text-xs leading-6 text-muted">Prices in USD. Shipping and taxes are not calculated. This bag uses sample product data.</p>
            <Link to="/checkout" className="primary-link mt-6 min-h-14 w-full" aria-describedby="checkout-status">Continue to checkout</Link>
            <p id="checkout-status" className="mt-3 text-xs leading-5 text-muted">Sign in to record a demonstration order. The server confirms final prices; payments are not available.</p>
          </aside>
        </div>
      )}
    </section>
  );
}

function CartLine({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const { dispatch } = useCart();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <li className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-5 gap-y-5 border-b border-line py-7 first:pt-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto]">
      <Link to={`/products/${item.id}`} aria-label={`View ${item.title}`} className="flex aspect-square items-center justify-center rounded-editorial bg-surface">
        {imageFailed ? <span className="px-2 text-center text-xs text-muted">Image unavailable</span> : <img src={item.thumbnail} alt={item.title} width="112" height="112" onError={() => setImageFailed(true)} className="h-full w-full object-contain p-3" />}
      </Link>
      <div className="min-w-0">
        <h3 className="font-display text-2xl leading-tight wrap-break-word"><Link to={`/products/${item.id}`} className="nav-link">{item.title}</Link></h3>
        <p className="mb-5 mt-2 text-sm text-muted">{formatPrice(item.price)} each</p>
        <QuantitySelector stock={item.stock} quantity={item.quantity} onChange={(quantity) => dispatch({ type: 'setQuantity', id: item.id, quantity })} productTitle={item.title} />
      </div>
      <div className="col-start-2 flex items-start justify-between gap-4 text-sm sm:col-start-auto sm:flex-col sm:items-end">
        <p className="tabular-nums" aria-label={`Subtotal for ${item.title}: ${formatPrice(getItemSubtotal(item))}`}>{formatPrice(getItemSubtotal(item))}</p>
        <button type="button" className="text-link" aria-label={`Remove ${item.title} from bag`} onClick={onRemove}>Remove</button>
      </div>
    </li>
  );
}
