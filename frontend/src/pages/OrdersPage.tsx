import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { getOrder, getOrders, OrderApiError } from '../api/orders';
import type { Order } from '../api/orders';
import { OrderSummary } from '../components/OrderSummary';
import { SignInPrompt } from '../components/SignInPrompt';
import { formatPrice } from '../format';

type OrdersState = { kind: 'loading' } | { kind: 'error'; message: string; notFound: boolean }
  | { kind: 'list'; orders: Order[] } | { kind: 'detail'; order: Order };

export function OrdersPage() {
  const { id } = useParams();
  const { user, accessToken } = useAuth();
  if (!user || !accessToken) return <SignInPrompt returnTo={id ? `/orders/${id}` : '/orders'} />;
  return <UserOrders key={`${user.id}:${id ?? 'list'}`} id={id} token={accessToken} />;
}

function UserOrders({ id, token }: { id: string | undefined; token: string }) {
  const { invalidateSession } = useAuth();
  const [state, setState] = useState<OrdersState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    async function load() {
      try {
        const next: OrdersState = id ? { kind: 'detail', order: await getOrder(id, token, controller.signal) }
          : { kind: 'list', orders: await getOrders(token, controller.signal) };
        if (!controller.signal.aborted) setState(next);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        if (error instanceof OrderApiError && error.status === 401) { invalidateSession(); return; }
        setState({ kind: 'error', message: error instanceof OrderApiError ? error.message : 'We couldn’t load your orders. Please try again.',
          notFound: error instanceof OrderApiError && error.status === 404 });
      }
    }
    void load();
    return () => controller.abort();
  }, [id, token, attempt, invalidateSession]);

  return <section className="page-width pb-20 pt-10 lg:pb-28 lg:pt-16">
    <nav aria-label="Breadcrumb" className="mb-9 flex flex-wrap gap-3 text-xs text-muted"><Link className="nav-link" to="/account">Account</Link><span aria-hidden="true">/</span>{id ? <><Link className="nav-link" to="/orders">Your orders</Link><span aria-hidden="true">/</span><span aria-current="page">Order details</span></> : <span aria-current="page">Your orders</span>}</nav>
    <div className="mb-10 border-b border-line pb-8"><h1 className="section-title">{id ? 'Your order.' : 'Your orders.'}</h1><p className="mt-5 max-w-xl text-base leading-7 text-muted">{id ? 'The selection and prices recorded for this order.' : 'A record of your selections, with the latest 50 orders shown first.'}</p></div>
    {state.kind === 'loading' && <p role="status" className="py-12 text-muted">Loading your {id ? 'order' : 'orders'}…</p>}
    {state.kind === 'error' && <div className="py-6"><h2 className="font-display text-3xl">{state.notFound ? 'Order not found.' : 'A moment out of reach.'}</h2><p role="alert" className="mt-5 max-w-lg text-sm leading-7 text-muted">{state.message}</p><div className="mt-6 flex flex-wrap items-center gap-6">{!state.notFound && <button type="button" className="primary-link" onClick={() => setAttempt((value) => value + 1)}>Try again</button>}<Link className="text-link inline-flex items-center text-sm" to={id ? '/orders' : '/products'}>{id ? 'Back to your orders' : 'Explore the collection'}</Link></div></div>}
    {state.kind === 'detail' && <><OrderSummary order={state.order} /><Link className="text-link mt-10 inline-flex items-center text-sm" to="/orders">Back to your orders</Link></>}
    {state.kind === 'list' && (state.orders.length === 0 ? <div className="py-6 sm:py-12"><h2 className="font-display text-4xl">Your story starts here.</h2><p className="mt-5 max-w-md text-base leading-7 text-muted">No orders have been recorded for your account yet. Your next selection is waiting in the collection.</p><div className="mt-8 flex flex-wrap items-center gap-6"><Link className="primary-link" to="/products">Explore the collection</Link><Link className="text-link inline-flex items-center text-sm" to="/cart">View your bag</Link></div></div> : <ul className="divide-y divide-line border-b border-line">
      {state.orders.map((order) => <li key={order.id} className="grid gap-5 py-7 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0"><h2 className="font-display text-2xl"><Link className="nav-link wrap-anywhere" to={`/orders/${order.id}`}>Order {order.id}</Link></h2><p className="mt-3 text-sm leading-6 text-muted"><time dateTime={order.createdAt}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(order.createdAt))}</time> · {order.items.reduce((sum, item) => sum + item.quantity, 0)} units · Pending payment</p><p className="mt-2 text-sm leading-6 text-muted wrap-anywhere">{order.items.map((item) => item.title).join(', ')}</p></div>
        <div className="flex items-center justify-between gap-5 text-sm sm:flex-col sm:items-end"><p className="tabular-nums">{formatPrice(order.totalCents / 100)}</p><Link className="text-link inline-flex items-center" to={`/orders/${order.id}`} aria-label={`View order ${order.id}`}>View order</Link></div>
      </li>)}
    </ul>)}
    {state.kind === 'list' && state.orders.length > 0 && <p className="mt-7 max-w-xl text-xs leading-6 text-muted">These are demonstration orders. Payments, shipping, and inventory reservation are not available.</p>}
  </section>;
}
