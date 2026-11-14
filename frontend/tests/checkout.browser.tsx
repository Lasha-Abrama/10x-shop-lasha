// Development-only: every fetch and localStorage operation is isolated in this page.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { CartProvider, useCart } from '../src/cart/CartContext';
import { CheckoutPage } from '../src/pages/CheckoutPage';
import { CartPage } from '../src/pages/CartPage';
import { AuthPage } from '../src/pages/AuthPage';
import { AccountPage } from '../src/pages/AccountPage';
import { ProductCard } from '../src/components/ProductCard';
import { ProductDetailsPage } from '../src/pages/ProductDetailsPage';
import { Layout } from '../src/components/Layout';
import '../src/styles.css';

let storageWrites = 0;
const memory = new Map<string, string>();
Object.defineProperty(window, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { storageWrites += 1; memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
} });
const now = '2026-10-24T12:00:00.000Z';
const user = { id: '368fa243-bfd2-4cf6-89de-538a0e899204', email: 'student@example.com', role: 'USER', createdAt: now, updatedAt: now };
const product = { id: 1, title: 'Essence Mascara Lash Princess', category: 'beauty', price: 9.99, stock: 2,
  thumbnail: 'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
  description: 'Fixture product', images: [] };
let orderMode: 'success' | 'failure' | 'uncertain' = 'success';
let stock = 2;
let detailFailure = false;
let orderRequests = 0;
const registrations: unknown[] = [];
let detailRequests = 0;
let payload: unknown;
// No request falls through to the real backend or catalog.
let sessionActive = false;
window.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const pathname = url.pathname.replace(/^\/api\//, '/');
  if (pathname === '/auth/login') { sessionActive = true; return Response.json({ user }); }
  if (pathname === '/auth/session') return sessionActive ? Response.json({ user, expiresAt: Date.now() + 900_000 }) : new Response(null, { status: 401 });
  if (pathname === '/auth/logout') { sessionActive = false; return new Response(null, { status: 204 }); }
  if (pathname === '/auth/register') {
    registrations.push(JSON.parse(String(options?.body)));
    return Response.json({ message: 'Registration request processed. You can try signing in.' }, { status: 202 });
  }
  if (pathname === '/products/1') {
    detailRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (detailFailure) throw new TypeError('Fixture offline');
    return Response.json({ ...product, stock });
  }
  if (pathname === '/orders' && options?.method === 'POST') {
    orderRequests += 1;
    payload = JSON.parse(String(options.body));
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (orderMode === 'failure') return Response.json({}, { status: 409 });
    if (orderMode === 'uncertain') throw new TypeError('Fixture response lost');
    return Response.json({ id: '52f5b2f4-c4a7-4e14-9446-08363252b76d', status: 'PENDING_PAYMENT', currency: 'USD', totalCents: 1099,
      createdAt: now, updatedAt: now, items: [{ id: '01a936c3-3fd4-4397-b513-089bf01d6dba', productId: 1,
        title: product.title, quantity: 1, unitPriceCents: 1099, lineTotalCents: 1099 }] }, { status: 201 });
  }
  throw new Error('Unexpected fixture request');
};

const host = document.getElementById('root');
if (!host) throw new Error('Missing test root');
const container: HTMLElement = host;
const root = createRoot(container);
const passed: string[] = [];
function check(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  passed.push(message);
}
async function waitFor(condition: () => boolean) {
  const deadline = Date.now() + 4000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for React');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
function Probe() {
  const { state } = useCart();
  const location = useLocation();
  return <output className="sr-only" data-items={state.items.reduce((sum, item) => sum + item.quantity, 0)} data-route={`${location.pathname}${location.search}`} />;
}
function Setup({ signedIn, filled, children }: { signedIn: boolean; filled: boolean; children: ReactNode }) {
  const { login } = useAuth();
  const { dispatch } = useCart();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function prepare() {
      dispatch({ type: 'clear' });
      if (filled) dispatch({ type: 'add', product, quantity: 1 });
      if (signedIn) await login({ email: user.email, password: 'not-a-real-password' }, controller.signal);
      if (!controller.signal.aborted) setReady(true);
    }
    void prepare();
    return () => controller.abort();
    // Fixture setup runs once per keyed mount, using only mocked authentication.
  }, []);
  return ready ? children : <p>Preparing isolated fixture…</p>;
}
let fixture = 0;
function render(signedIn = true, filled = true, path = '/checkout') {
  sessionActive = false;
  memory.clear();
  flushSync(() => root.render(<MemoryRouter key={++fixture} initialEntries={[path]}><AuthProvider><CartProvider>
    <Setup signedIn={signedIn} filled={filled}><Probe /><Routes><Route element={<Layout />}>
      <Route path="checkout" element={<CheckoutPage />} /><Route path="cart" element={<CartPage />} />
      <Route path="account" element={<AccountPage />} /><Route path="profile" element={<AccountPage />} />
      <Route path="products/:id" element={<ProductDetailsPage />} />
      <Route path="login" element={<AuthPage key="login" mode="login" />} /><Route path="register" element={<AuthPage key="register" mode="register" />} /><Route path="products" element={<section className="page-width py-12"><h1 className="section-title">The collection.</h1><div className="mt-8 max-w-80"><ProductCard product={product} /></div></section>} />
    </Route></Routes></Setup>
  </CartProvider></AuthProvider></MemoryRouter>));
}
function fill(name: string, value: string) {
  const input = container?.querySelector<HTMLInputElement>(`input[name="${name}"], input[id="${name}"]`);
  if (!input) throw new Error('Missing input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
}
function fillDetails() { fill('fullName', 'Test Student'); fill('address', '12 Sample Street'); fill('city', 'Tbilisi'); }
function submit() { flushSync(() => container?.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
const itemCount = () => container?.querySelector('output')?.getAttribute('data-items');

async function run() {
  for (const [quantity, label] of [[6, 'In stock'], [5, 'Only 5 left!'], [1, 'Only 1 left!'], [0, 'Out of stock']] as const) {
    stock = quantity;
    render(false, false, '/products/1');
    await waitFor(() => Boolean(container?.querySelector('#product-title')));
    const section = container?.querySelector('#product-title')?.parentElement;
    const status = [...(section?.querySelectorAll('p') ?? [])].find((paragraph) => paragraph.textContent === label);
    check(Boolean(status) && (quantity === 0 ? status?.classList.contains('text-red-700') : quantity <= 5 ? status?.classList.contains('text-orange-700') : true), `Stock ${quantity} shows the Annex label and color: ${label}`);
    const addButton = section?.querySelector<HTMLButtonElement>('button[aria-describedby="bag-availability"]');
    check(addButton?.disabled === (quantity === 0) && Boolean(section?.textContent?.includes('does not reserve stock')) && (quantity === 0 ? !section?.querySelector('fieldset') : section?.textContent?.includes(`Maximum quantity: ${quantity}.`)), `Stock ${quantity} preserves quantity availability and the no-reservation disclosure`);
  }
  stock = 2;
  detailRequests = 0;

  render(false, true, '/register?returnTo=%2Fcheckout');
  await waitFor(() => Boolean(container.querySelector('#auth-confirmation')));
  fill('email', user.email);
  fill('password', 'abcdefghijk');
  fill('auth-confirmation', 'abcdefghijk');
  submit();
  check(registrations.length === 0 && document.activeElement?.id === 'auth-password' && container.querySelector('#password-error')?.textContent === 'Use at least 12 characters.', 'Signup blocks a short password and focuses its error');
  fill('password', 'abcdefghijkl');
  fill('auth-confirmation', '');
  submit();
  check(registrations.length === 0 && container.querySelector('#confirmation-error')?.textContent === 'Confirm your password.', 'Signup requires confirmation');
  fill('auth-confirmation', 'different-password');
  submit();
  check(registrations.length === 0 && document.activeElement?.id === 'auth-confirmation' && container.querySelector('#confirmation-error')?.textContent === 'Passwords must match.', 'Mismatched passwords show an associated error and prevent registration');
  fill('auth-confirmation', 'abcdefghijkl');
  const visibility = [...container.querySelectorAll<HTMLButtonElement>('main button')].find((button) => button.textContent === 'Show password');
  flushSync(() => visibility?.click());
  check(container.querySelector<HTMLInputElement>('#auth-password')?.type === 'text' && container.querySelector<HTMLInputElement>('#auth-confirmation')?.type === 'text', 'Password toggle reveals both signup fields');
  flushSync(() => visibility?.click());
  check(container.querySelector<HTMLInputElement>('#auth-password')?.type === 'password' && container.querySelector<HTMLInputElement>('#auth-confirmation')?.type === 'password', 'Password toggle masks both signup fields again');
  submit(); submit();
  await waitFor(() => container.textContent?.includes('Request received.') === true);
  check(JSON.stringify(registrations) === JSON.stringify([{ email: user.email, password: 'abcdefghijkl' }]), 'Matching passwords send exactly one request without the confirmation value');
  check(document.documentElement.scrollWidth <= innerWidth, 'Registration fits the viewport');
  const continueToLogin = container.querySelector<HTMLAnchorElement>('main a[href="/login?returnTo=%2Fcheckout"]');
  check(continueToLogin, 'Registration preserves the return to checkout');
  flushSync(() => continueToLogin?.click());
  await waitFor(() => Boolean(container.querySelector('#auth-password')));
  fill('email', user.email);
  fill('password', 'abcdefghijkl');
  submit();
  await waitFor(() => Boolean(container.querySelector('#fullName')));
  check(container.querySelector('output')?.getAttribute('data-route') === '/checkout' && itemCount() === '1', 'A 12-character signup password can sign in and return to checkout with the bag intact');

  for (const { path, destination, message } of [
    { path: '/login', destination: '/products', message: 'Independent mocked login returns to the catalog and preserves the bag' },
    { path: '/login?returnTo=https%3A%2F%2Fevil.example', destination: '/products', message: 'Unsafe external return falls back to the catalog and preserves the bag' },
    { path: '/login?returnTo=%2Faccount', destination: '/account', message: 'Explicit safe Account return is preserved after mocked login' },
  ]) {
    render(false, true, path);
    await waitFor(() => Boolean(container?.querySelector('input[name="password"]')));
    check(!container.querySelector('#auth-confirmation'), 'Sign-in only asks for email and password');
    fill('email', user.email); fill('password', 'not-a-real-password'); submit();
    await waitFor(() => container?.querySelector('output')?.getAttribute('data-route') === destination);
    check(itemCount() === '1', message);
  }

  render(false);
  await waitFor(() => Boolean(container?.querySelector('input[name="password"]')));
  check(container?.querySelector('output')?.getAttribute('data-route') === '/login?returnTo=%2Fcheckout', 'Guest checkout redirects to login with a safe return path');
  check(itemCount() === '1', 'Guest redirect preserves the bag');
  check(container?.querySelector('header a[href="/cart"]')?.getAttribute('aria-label') === 'Shopping bag, 1 item' && container?.querySelector('header a[href="/cart"] [aria-live]')?.textContent === '1', 'Positive cart badge and accessible count are preserved');
  fill('email', user.email); fill('password', 'not-a-real-password'); submit();
  await waitFor(() => Boolean(container?.querySelector('#fullName')));
  check(container?.querySelector('output')?.getAttribute('data-route') === '/checkout', 'Successful mocked sign-in returns to checkout');

  render(true, false);
  await waitFor(() => Boolean(container?.textContent?.includes('Room for something good.')));
  check(container?.textContent?.includes('before checking out'), 'Empty checkout redirects to the bag with feedback');
  check(container?.querySelector('header a[href="/cart"]')?.getAttribute('aria-label') === 'Shopping bag, 0 items' && !container?.querySelector('header a[href="/cart"] [aria-live]'), 'Empty cart hides the numeric badge while preserving its accessible name');

  render();
  await waitFor(() => Boolean(container?.querySelector('#fullName')));
  submit();
  check(orderRequests === 0 && document.activeElement?.id === 'fullName', 'Invalid form focuses the first error and sends no request');
  check(container?.querySelectorAll('[aria-invalid="true"]').length === 3, 'Required fields show associated validation errors');
  fillDetails();
  const demoCard = container.querySelector('section[aria-labelledby="sample-card-heading"]');
  check(document.documentElement.scrollWidth <= innerWidth, 'Checkout and sample payment details fit the viewport');
  check(demoCard?.querySelector('[aria-hidden="true"]')?.textContent === '•••• •••• •••• 4242'
    && demoCard?.querySelector('.sr-only')?.textContent === 'Card ending in 4242', 'Demo card exposes only its last four digits');
  check([...demoCard?.querySelectorAll('dd') ?? []].slice(1).map((field) => field.textContent).join(',') === '09/29,123'
    && !demoCard?.querySelector('input, select, button'), 'Expiry and CVV are displayed without interactive controls');
  orderMode = 'failure'; submit();
  check(Boolean(container?.querySelector('button[type="submit"]')?.hasAttribute('disabled')), 'Pending order submission is disabled');
  submit();
  await waitFor(() => Boolean(container?.textContent?.includes('stock has changed')));
  check(orderRequests === 1 && itemCount() === '1', 'Repeated pending submit makes one request; failure preserves the bag');
  check(container?.querySelector<HTMLInputElement>('#address')?.value === '12 Sample Street', 'Failure preserves the controlled form values');
  orderMode = 'success'; submit();
  check(itemCount() === '1', 'Bag remains intact while awaiting confirmation');
  await waitFor(() => Boolean(container?.textContent?.includes('Order recorded.')));
  const thumbnail = container.querySelector<HTMLImageElement>('main li img');
  if (!thumbnail) throw new Error('Missing confirmation thumbnail');
  check(thumbnail.getAttribute('src') === product.thumbnail, 'Confirmation matches a real cart thumbnail by confirmed product ID');
  flushSync(() => thumbnail.dispatchEvent(new Event('error')));
  check(container.textContent?.includes('Image unavailable') && !container.querySelector('main li img'), 'Failed thumbnail displays an accessible fallback');
  check(!container.querySelector('#sample-card-heading') && ![...memory.values()].some((value) => value.includes('4242') || value.includes('09/29')), 'Sample card unmounts and values are absent from cart storage');
  check(itemCount() === '0', 'Confirmed success clears the bag and stays on confirmation');
  check(JSON.stringify(payload) === '{"items":[{"productId":1,"quantity":1}]}', 'Order payload contains only product ID and quantity, never form details or prices');
  check(container?.textContent?.includes('$10.99') && container?.textContent?.includes('Pending payment · unpaid'), 'Confirmation uses authoritative server total and truthful unpaid status');
  check(container?.textContent?.includes('Thank you! Your order has been placed.') && container?.textContent?.includes('No payment was taken.') && container?.textContent?.includes('No shipping or stock reservation is arranged.'), 'Annex thank-you wording preserves all payment, shipping and reservation disclosures');
  check(container?.textContent?.includes('Test Student') && container?.textContent?.includes('not sent to the server'), 'Confirmation shows the transient form details with a clear disclosure');
  check(![...memory.values()].some((value) => value.includes('Test Student') || value.includes('12 Sample Street') || value.includes('fixture.payload')), 'Form details and auth tokens are not persisted');

  render(); orderMode = 'uncertain';
  await waitFor(() => Boolean(container?.querySelector('#fullName')));
  fillDetails(); submit();
  await waitFor(() => Boolean(container?.textContent?.includes('We can’t tell whether it was saved')));
  const requests = orderRequests; submit();
  check(orderRequests === requests && itemCount() === '1' && Boolean(container?.querySelector('button[type="submit"]')?.hasAttribute('disabled')), 'Uncertain outcome preserves the bag and prevents an immediate duplicate request');

  render(true, false, '/products');
  await waitFor(() => Boolean(container?.querySelector('article button')));
  const add = () => flushSync(() => container?.querySelector<HTMLButtonElement>('article button')?.click());
  add(); add();
  await waitFor(() => itemCount() === '1');
  check(detailRequests === 1, 'Card add checks fresh details once and prevents duplicate pending clicks');
  add(); await waitFor(() => itemCount() === '2');
  add(); await waitFor(() => Boolean(container?.textContent?.includes('Stock limit reached')));
  check(itemCount() === '2', 'Card add respects existing quantity and current stock');
  stock = 0; add(); await waitFor(() => Boolean(container?.textContent?.includes('currently unavailable')));
  check(itemCount() === '2', 'Unavailable product does not change the bag');
  detailFailure = true; add(); await waitFor(() => Boolean(container?.textContent?.includes('Couldn’t check this product')));
  check(itemCount() === '2', 'Catalog failure leaves the bag intact');
  check(Boolean(container?.querySelector('a[href="/products"][aria-current="page"]')), 'Catalog navigation exposes the active page');
  flushSync(() => container?.querySelector<HTMLAnchorElement>('header a[href="/profile"]')?.click());
  await waitFor(() => Boolean(container?.textContent?.includes('Profile details')));
  container?.querySelectorAll<HTMLButtonElement>('main button').forEach((button) => { if (button.textContent === 'Logout') flushSync(() => button.click()); });
  await waitFor(() => Boolean(container?.querySelector('header a[href="/login"]')) && container?.querySelector('output')?.getAttribute('data-route') === '/products');
  check(itemCount() === '2' && container?.querySelector('output')?.getAttribute('data-route') === '/products', 'Logout returns to the catalog without clearing the bag');

  render(true, true, '/cart');
  const clearButton = () => [...(container?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((button) => button.textContent === 'Clear bag');
  await waitFor(() => Boolean(clearButton()));
  const totals = [...(container?.querySelectorAll('aside[aria-labelledby="summary-heading"] dl > div') ?? [])].map((row) => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent]);
  check(JSON.stringify(totals) === '[["Subtotal","$9.99"],["Estimated total","$9.99"]]', 'Cart subtotal and estimated total use the same accurate item sum without invented charges');
  const originalConfirm = window.confirm;
  let confirmations = 0;
  const savedBag = JSON.stringify([...memory]);
  const writes = storageWrites;
  try {
    window.confirm = (message) => { confirmations += 1; check(message === 'Clear your bag? This cannot be undone.', 'Clear bag explains the irreversible action'); return false; };
    flushSync(() => clearButton()?.click());
    check(itemCount() === '1' && JSON.stringify([...memory]) === savedBag && storageWrites === writes, 'Cancel preserves all bag items and persisted storage');
    check(!container?.textContent?.includes('Your bag has been cleared.'), 'Cancellation does not announce successful clearing');
    window.confirm = () => { confirmations += 1; return true; };
    flushSync(() => clearButton()?.click());
    await waitFor(() => itemCount() === '0');
    check(storageWrites === writes + 1 && confirmations === 2 && !clearButton(), 'Acceptance clears and persists exactly once, removing the clear action');
    check(Boolean(container?.textContent?.includes('Your bag has been cleared.')) && Boolean(container?.textContent?.includes('Room for something good.')), 'Confirmed clearing announces success and shows the empty bag');
  } finally {
    window.confirm = originalConfirm;
  }

  flushSync(() => root.render(<section className="page-width py-16"><h1 className="section-title">Checkout checks passed.</h1><p role="status" className="mt-6">{passed.length} browser assertions passed. All API responses and storage were isolated; no live writes.</p><ul className="mt-6 list-disc space-y-2 pl-5">{passed.map((message) => <li key={message}>{message}</li>)}</ul></section>));
}
const mode = new URLSearchParams(location.search).get('case');
if (mode === 'form') render();
else if (mode === 'cart') render(true, true, '/cart');
else if (mode === 'card') render(true, false, '/products');
else void run().catch((error: unknown) => {
  flushSync(() => root.render(<p role="alert">Checkout fixture failed: {error instanceof Error ? error.message : 'unknown assertion'}</p>));
});
