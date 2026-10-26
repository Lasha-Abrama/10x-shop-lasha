import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { getCartTotals, getItemSubtotal } from '../cart/cart';
import type { CartItem } from '../cart/cart';
import { OrderApiError } from '../api/orders';
import type { Order } from '../api/orders';
import { checkoutError, placeCartOrder } from '../orders/checkout';
import { authPath } from '../auth/returnTo';
import { validateCheckoutDetails } from '../orders/checkout-form';
import type { CheckoutDetails, CheckoutErrors } from '../orders/checkout-form';
import { OrderSummary } from '../components/OrderSummary';
import { formatPrice } from '../format';

type Submission = { kind: 'ready' } | { kind: 'pending' }
  | { kind: 'error'; message: string; uncertain: boolean } | { kind: 'confirmed'; order: Order; details: CheckoutDetails };

export function CheckoutPage() {
  const { user, accessToken, status } = useAuth();
  if (status === 'authenticating') return <p role="status" className="page-width py-16">Confirming your account…</p>;
  if (!user || !accessToken) return <Navigate to={authPath('login', '/checkout')} replace />;
  return <CheckoutSession key={user.id} token={accessToken} />;
}

function CheckoutSession({ token }: { token: string }) {
  const { state: cart, dispatch } = useCart();
  const { invalidateSession, user } = useAuth();
  const [details, setDetails] = useState<CheckoutDetails>({ fullName: '', email: user?.email ?? '', address: '', city: '' });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submission, setSubmission] = useState<Submission>({ kind: 'ready' });
  const request = useRef<AbortController | null>(null);
  const messageBox = useRef<HTMLParagraphElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = submission.kind === 'pending';
  const validation = checkoutError(cart);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (submission.kind === 'error') messageBox.current?.focus();
    if (submission.kind === 'confirmed') heading.current?.focus();
  }, [submission]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || validation || submission.kind === 'confirmed'
      || (submission.kind === 'error' && submission.uncertain)) return;
    const fieldErrors = validateCheckoutDetails(details);
    setErrors(fieldErrors);
    const firstError = (Object.keys(fieldErrors) as (keyof CheckoutDetails)[])[0];
    if (firstError) {
      const field = event.currentTarget.elements.namedItem(firstError);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setSubmission({ kind: 'pending' });
    try {
      await placeCartOrder(cart, token, controller.signal, (order) => {
        dispatch({ type: 'clear' });
        setSubmission({ kind: 'confirmed', order, details: {
          fullName: details.fullName.trim(), email: details.email.trim(), address: details.address.trim(), city: details.city.trim(),
        } });
      });
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      if (error instanceof OrderApiError && error.status === 401) { invalidateSession(); return; }
      setSubmission({ kind: 'error', message: error instanceof OrderApiError ? error.message : 'We couldn’t confirm your order. Please check your order history.',
        uncertain: !(error instanceof OrderApiError) || error.uncertain });
    } finally { if (request.current === controller) request.current = null; }
  }

  if (submission.kind === 'confirmed') return <section className="page-width pb-20 pt-12 sm:pt-16 lg:pb-28">
    <h1 ref={heading} tabIndex={-1} className="section-title">Order recorded.</h1>
    <p role="status" className="mb-10 mt-5 max-w-xl text-base leading-7 text-muted">Your demonstration order is saved. The final total below comes from the server; no payment has been taken.</p>
    <OrderSummary order={submission.order} />
    <section aria-labelledby="demo-details" className="mt-10 border-t border-line pt-8">
      <h2 id="demo-details" className="font-display text-3xl">Your demonstration details.</h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-muted">Shown only in this confirmation. These details were not sent to the server or saved. No shipping is arranged.</p>
      <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Full name</dt><dd className="mt-1 wrap-anywhere">{submission.details.fullName}</dd></div>
        <div><dt className="text-muted">Email</dt><dd className="mt-1 wrap-anywhere">{submission.details.email}</dd></div>
        <div><dt className="text-muted">Address</dt><dd className="mt-1 wrap-anywhere">{submission.details.address}</dd></div>
        <div><dt className="text-muted">City</dt><dd className="mt-1 wrap-anywhere">{submission.details.city}</dd></div>
      </dl>
    </section>
    <div className="mt-10 flex flex-wrap items-center gap-6"><Link className="primary-link" to={`/orders/${submission.order.id}`}>View this order</Link><Link className="text-link inline-flex items-center text-sm" to="/orders">All your orders</Link><Link className="text-link inline-flex items-center text-sm" to="/products">Continue exploring</Link></div>
  </section>;

  if (cart.items.length === 0) return <Navigate to="/cart" replace state={{ emptyCheckout: true }} />;

  return <section className="page-width pb-20 pt-10 lg:pb-28 lg:pt-16">
    <nav aria-label="Breadcrumb" className="mb-9 flex flex-wrap items-center gap-3 text-xs text-muted"><Link className="nav-link touch-target" to="/cart">Your bag</Link><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav>
    <div className="mb-10 border-b border-line pb-8"><h1 className="section-title">One last look.</h1><p className="mt-5 max-w-xl text-base leading-7 text-muted">Review your selection, then record your order. This is a demonstration checkout with no payment or shipping.</p></div>
    <form onSubmit={submit} noValidate aria-busy={pending} className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
      <div className="min-w-0">
        <fieldset disabled={pending || (submission.kind === 'error' && submission.uncertain)} aria-describedby="details-note" className="mb-12">
          <legend className="font-display text-3xl">Your details.</legend>
          <p id="details-note" className="mb-6 mt-4 max-w-xl text-sm leading-7 text-muted">All fields are required for this graduation-project form. Use sample details: they stay on this page, are not saved, and will not be used for shipping.</p>
          <div className="grid gap-6 sm:grid-cols-2">
            {([
              { name: 'fullName', label: 'Full name', autoComplete: 'name', maxLength: 100 },
              { name: 'email', label: 'Email', autoComplete: 'email', maxLength: 254 },
              { name: 'address', label: 'Address', autoComplete: 'street-address', maxLength: 200 },
              { name: 'city', label: 'City', autoComplete: 'address-level2', maxLength: 100 },
            ] as const).map((field) => <div key={field.name}>
              <label htmlFor={field.name} className="text-sm font-medium">{field.label}</label>
              <input id={field.name} name={field.name} type={field.name === 'email' ? 'email' : 'text'} required autoComplete={field.autoComplete} maxLength={field.maxLength}
                value={details[field.name]} onChange={(event) => {
                  setDetails({ ...details, [field.name]: event.target.value });
                  setErrors({ ...errors, [field.name]: undefined });
                }} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                className="mt-2 min-h-13 w-full rounded-editorial border border-muted bg-paper px-4 py-3 text-base caret-accent hover:border-ink disabled:opacity-60" />
              {errors[field.name] && <p id={`${field.name}-error`} role="alert" className="mt-2 text-sm leading-6 text-accent">{errors[field.name]}</p>}
            </div>)}
          </div>
        </fieldset>
        <h2 className="font-display text-3xl">In your bag.</h2><ul className="mt-7">{cart.items.map((item) => <CheckoutLine key={item.id} item={item} />)}</ul>
        <Link className="text-link mt-6 inline-flex items-center text-sm" to="/cart">Edit your bag</Link>
      </div>
      <aside className="rounded-editorial bg-surface p-7 sm:p-8" aria-labelledby="checkout-summary">
        <h2 id="checkout-summary" className="font-display text-3xl">Your order estimate.</h2>
        <dl className="my-7 border-y border-line py-5"><div className="flex flex-wrap justify-between gap-3"><dt>Estimated subtotal</dt><dd className="tabular-nums wrap-anywhere">{formatPrice(getCartTotals(cart).subtotal)}</dd></div></dl>
        <p id="estimate-note" className="text-sm leading-7 text-muted">Bag prices are an estimate. The server checks current product prices and stock and determines the final total, which may differ.</p>
        <div className="mt-6">
          <button type="submit" disabled={pending || Boolean(validation) || (submission.kind === 'error' && submission.uncertain)} aria-describedby="estimate-note order-note" className="primary-link min-h-14 w-full disabled:cursor-wait disabled:opacity-60">{pending ? 'Recording your order…' : 'Place demonstration order'}</button>
          <p id="order-note" className="mt-4 text-xs leading-6 text-muted">No payment is collected. Keep this page open until confirmation. If interrupted, check order history before trying again.</p>
          {validation && <p role="alert" className="mt-5 text-sm leading-6">{validation}</p>}
          {pending && <p role="status" className="mt-5 text-sm leading-6">Checking the catalog and recording your selection…</p>}
          {submission.kind === 'error' && <>
            <p ref={messageBox} tabIndex={-1} role="alert" className="mt-5 text-sm leading-6">{submission.message}{submission.uncertain ? ' We can’t tell whether it was saved. Your bag is unchanged. Check order history before starting another attempt.' : ' Your bag is unchanged.'}</p>
            <Link className="text-link mt-4 inline-flex items-center text-sm" to="/orders">Check order history</Link>
          </>}
        </div>
      </aside>
    </form>
  </section>;
}

function CheckoutLine({ item }: { item: CartItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 border-b border-line py-6 first:pt-0 sm:grid-cols-[6rem_minmax(0,1fr)_auto]">
    <div className="flex aspect-square items-center justify-center rounded-editorial bg-surface">{imageFailed ? <span className="px-2 text-center text-xs text-muted">Image unavailable</span> : <img src={item.thumbnail} alt={item.title} width="96" height="96" className="h-full w-full object-contain p-2" onError={() => setImageFailed(true)} />}</div>
    <div className="min-w-0"><h3 className="font-display text-2xl leading-tight wrap-anywhere">{item.title}</h3><p className="mt-2 text-sm text-muted">Quantity {item.quantity} · {formatPrice(item.price)} each</p></div>
    <p className="col-start-2 text-sm tabular-nums sm:col-start-auto">{formatPrice(getItemSubtotal(item))}</p>
  </li>;
}
