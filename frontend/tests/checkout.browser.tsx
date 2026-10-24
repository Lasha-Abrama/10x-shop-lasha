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
import { ProductCard } from '../src/components/ProductCard';
import { Layout } from '../src/components/Layout';
import '../src/styles.css';

const memory = new Map<string, string>();
Object.defineProperty(window, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
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
let detailRequests = 0;
let payload: unknown;
// No request falls through to the real backend or catalog.
window.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname === '/auth/login') return Response.json({ user, accessToken: 'fixture.payload.signature', tokenType: 'Bearer', expiresIn: 900 });
  if (url.pathname === '/auth/me') return Response.json(user);
  if (url.pathname === '/products/1') {
    detailRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (detailFailure) throw new TypeError('Fixture offline');
    return Response.json({ ...product, stock });
  }
  if (url.pathname === '/orders' && options?.method === 'POST') {
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

const container = document.getElementById('root');
if (!container) throw new Error('Missing test root');
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
  memory.clear();
  flushSync(() => root.render(<MemoryRouter key={++fixture} initialEntries={[path]}><AuthProvider><CartProvider>
    <Setup signedIn={signedIn} filled={filled}><Probe /><Routes><Route element={<Layout />}>
      <Route path="checkout" element={<CheckoutPage />} /><Route path="cart" element={<CartPage />} />
      <Route path="login" element={<AuthPage mode="login" />} /><Route path="products" element={<section className="page-width py-12"><h1 className="section-title">The collection.</h1><div className="mt-8 max-w-80"><ProductCard product={product} /></div></section>} />
    </Route></Routes></Setup>
  </CartProvider></AuthProvider></MemoryRouter>));
}
function fill(name: string, value: string) {
  const input = container?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error('Missing input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
}
function fillDetails() { fill('fullName', 'Test Student'); fill('address', '12 Sample Street'); fill('city', 'Tbilisi'); }
function submit() { flushSync(() => container?.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
const itemCount = () => container?.querySelector('output')?.getAttribute('data-items');

async function run() {
  render(false);
  await waitFor(() => Boolean(container?.querySelector('input[name="password"]')));
  check(container?.querySelector('output')?.getAttribute('data-route') === '/login?returnTo=%2Fcheckout', 'Guest checkout redirects to login with a safe return path');
  check(itemCount() === '1', 'Guest redirect preserves the bag');
  fill('email', user.email); fill('password', 'not-a-real-password'); submit();
  await waitFor(() => Boolean(container?.querySelector('#fullName')));
  check(container?.querySelector('output')?.getAttribute('data-route') === '/checkout', 'Successful mocked sign-in returns to checkout');

  render(true, false);
  await waitFor(() => Boolean(container?.textContent?.includes('Room for something good.')));
  check(container?.textContent?.includes('before checking out'), 'Empty checkout redirects to the bag with feedback');

  render();
  await waitFor(() => Boolean(container?.querySelector('#fullName')));
  submit();
  check(orderRequests === 0 && document.activeElement?.id === 'fullName', 'Invalid form focuses the first error and sends no request');
  check(container?.querySelectorAll('[aria-invalid="true"]').length === 3, 'Required fields show associated validation errors');
  fillDetails();
  orderMode = 'failure'; submit();
  check(Boolean(container?.querySelector('button[type="submit"]')?.hasAttribute('disabled')), 'Pending order submission is disabled');
  submit();
  await waitFor(() => Boolean(container?.textContent?.includes('stock has changed')));
  check(orderRequests === 1 && itemCount() === '1', 'Repeated pending submit makes one request; failure preserves the bag');
  check(container?.querySelector<HTMLInputElement>('#address')?.value === '12 Sample Street', 'Failure preserves the controlled form values');
  orderMode = 'success'; submit();
  check(itemCount() === '1', 'Bag remains intact while awaiting confirmation');
  await waitFor(() => Boolean(container?.textContent?.includes('Order recorded.')));
  check(itemCount() === '0', 'Confirmed success clears the bag and stays on confirmation');
  check(JSON.stringify(payload) === '{"items":[{"productId":1,"quantity":1}]}', 'Order payload contains only product ID and quantity, never form details or prices');
  check(container?.textContent?.includes('$10.99') && container?.textContent?.includes('Pending payment'), 'Confirmation uses authoritative server total and pending status');
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
  container?.querySelectorAll<HTMLButtonElement>('header button').forEach((button) => { if (button.textContent === 'Logout') flushSync(() => button.click()); });
  await waitFor(() => !container?.textContent?.includes(user.email));
  check(itemCount() === '2' && container?.querySelector('output')?.getAttribute('data-route') === '/products', 'Logout returns to the catalog without clearing the bag');

  flushSync(() => root.render(<section className="page-width py-16"><h1 className="section-title">Checkout checks passed.</h1><p role="status" className="mt-6">{passed.length} browser assertions passed. All API responses and storage were isolated; no live writes.</p><ul className="mt-6 list-disc space-y-2 pl-5">{passed.map((message) => <li key={message}>{message}</li>)}</ul></section>));
}
const mode = new URLSearchParams(location.search).get('case');
if (mode === 'form') render();
else if (mode === 'card') render(true, false, '/products');
else void run().catch((error: unknown) => {
  flushSync(() => root.render(<p role="alert">Checkout fixture failed: {error instanceof Error ? error.message : 'unknown assertion'}</p>));
});
