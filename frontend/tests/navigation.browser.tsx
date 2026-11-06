// Development-only: real BrowserRouter/native history with isolated fetch and storage mocks.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BrowserRouter, Link } from 'react-router';
import { App } from '../src/App';
import { AuthProvider } from '../src/auth/AuthContext';
import { CartProvider } from '../src/cart/CartContext';
import { focusScrollTarget } from '../src/navigation/scroll';
import '../src/styles.css';

const keyboardOnly = new URLSearchParams(location.search).get('case') === 'keyboard';
const container = document.getElementById('root');
if (!container) throw new Error('Missing test root');
const root = createRoot(container);
const passed: string[] = [];
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
  passed.push(message);
}
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function waitFor(condition: () => boolean) {
  const deadline = performance.now() + 6000;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out after: ${passed.at(-1) ?? 'setup'}; ${location.pathname}, scroll ${scrollY}, heading ${document.querySelector('h1')?.textContent}`);
    await pause(20);
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  element.click();
}
function fill(id: string, value: string) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing ${id}`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
}
const ready = () => Boolean(document.querySelector('main')) && !document.querySelector('main [data-scroll-pending]');
function choose(index: number, value: string) {
  const select = document.querySelectorAll<HTMLSelectElement>('select')[index];
  select.value = value;
  flushSync(() => select.dispatchEvent(new Event('change', { bubbles: true })));
}
const atSavedPosition = () => Math.abs(scrollY - 900) < 5;
const orderListReady = () => ready() && document.querySelector('h1')?.textContent === 'Your orders.';
const orderDetailReady = () => ready() && document.querySelector('h1')?.textContent === 'Your order.';
async function savePosition() {
  window.scrollTo({ top: 900, behavior: 'instant' });
  await waitFor(atSavedPosition);
  await pause(50); // Deliver the native scroll event before leaving the history entry.
}

const user = { id: '3381026f-bc0d-466f-bab3-ef735b663c35', email: 'mock@example.com', role: 'USER', createdAt: '2026-10-21T10:00:00Z', updatedAt: '2026-10-21T10:00:00Z' };
const product = { id: 1, title: 'History fixture product', category: 'beauty', price: 12.5, rating: 4,
  thumbnail: `${location.origin}/images/ceramics.jpg`, images: [], stock: 5,
  description: 'A catalog object for everyday use. '.repeat(180) };
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const items = Array.from({ length: 20 }, (_, i) => ({ id: uuid(i + 100), productId: i + 1, title: `Recorded selection ${i + 1}`,
  quantity: 1, unitPriceCents: 1250, lineTotalCents: 1250 }));
const order = { id: uuid(1), status: 'PENDING_PAYMENT', currency: 'USD', totalCents: 25000,
  createdAt: user.createdAt, updatedAt: user.updatedAt, items };
let productFailure = false;
let orderFailure = false;
let aborted = 0;
let holdProduct = false;
let releaseProduct = () => {};
const catalogRequests: string[] = [];
async function delay(signal: AbortSignal | null | undefined) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, 300);
    function cancel() { clearTimeout(timer); aborted += 1; reject(new DOMException('Fixture cancelled', 'AbortError')); }
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
  });
}
Object.defineProperty(window, 'localStorage', { value: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
window.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname === '/auth/login') return Response.json({ user, accessToken: 'mock.payload.signature', tokenType: 'Bearer', expiresIn: 900 });
  if (options?.method === 'POST') throw new Error('Unexpected write blocked by fixture');
  if (url.pathname === '/auth/me') return Response.json(user);
  if (url.pathname === '/products/categories') return Response.json([{ slug: 'beauty', name: 'Beauty' }]);
  if (url.pathname === '/products/1') {
    if (holdProduct) await new Promise<void>((resolve) => { releaseProduct = resolve; });
    else await delay(options?.signal);
    return productFailure ? Response.json({}, { status: 503 }) : Response.json(product);
  }
  if (url.pathname.startsWith('/orders')) {
    await delay(options?.signal);
    if (orderFailure) return Response.json({}, { status: 503 });
    return Response.json(url.pathname === '/orders' ? Array.from({ length: 12 }, (_, i) => ({ ...order, id: uuid(i + 1) })) : order);
  }
  if (url.pathname.startsWith('/products')) {
    catalogRequests.push(url.pathname);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const limit = url.searchParams.get('limit') === '0' ? 24 : 12;
    return Response.json({ products: Array.from({ length: limit }, (_, i) => ({ ...product, id: skip + i + 1 })), total: 24, skip, limit });
  }
  throw new Error('Unexpected request blocked by fixture');
};

function focusChecks() {
  const host = document.createElement('div');
  host.className = 'sr-only';
  document.body.append(host);
  const other = document.createElement('button');
  host.append(other);
  for (const tag of ['input', 'button', 'select', 'textarea', 'a']) {
    const element = document.createElement(tag);
    if (element instanceof HTMLAnchorElement) element.href = '#';
    host.append(element);
    const release = focusScrollTarget(element);
    check(!element.hasAttribute('tabindex'), `${tag} retains native tab order`);
    release();
  }
  const section = document.createElement('section');
  host.append(section);
  const release = focusScrollTarget(section);
  check(section.getAttribute('tabindex') === '-1' && document.activeElement === section, 'Section gets temporary programmatic focus');
  other.focus({ preventScroll: true });
  check(!section.hasAttribute('tabindex'), 'Temporary section tabindex is removed on blur');
  section.setAttribute('tabindex', '-1');
  release();
  check(section.getAttribute('tabindex') === '-1', 'Repeated cleanup does not remove a later owner’s tabindex');
  for (const value of ['0', '-1', '2']) {
    section.setAttribute('tabindex', value);
    focusScrollTarget(section)();
    check(section.getAttribute('tabindex') === value, `Explicit tabindex ${value} is preserved`);
  }
  section.removeAttribute('tabindex');
  const changed = focusScrollTarget(section);
  section.setAttribute('tabindex', '0');
  changed();
  check(section.getAttribute('tabindex') === '0', 'Cleanup preserves a tabindex changed by another owner');
  host.remove();
}

async function run() {
  history.replaceState(null, '', '/products');
  root.render(<BrowserRouter><AuthProvider><CartProvider><Link className="sr-only" id="legacy-catalog" to="/products?q=history&category=beauty&sort=title-asc&page=2">Legacy catalog</Link><App /></CartProvider></AuthProvider></BrowserRouter>);
  await waitFor(() => ready() && Boolean(document.querySelector('article')) && document.fonts.status === 'loaded');
  check(scrollY === 0, 'Initial navigation starts at the top');
  if (keyboardOnly) return;
  focusChecks();

  const searchInput = () => document.querySelector<HTMLInputElement>('#catalog-search')?.value;
  const categoryValue = () => document.querySelector<HTMLSelectElement>('select')?.value;
  const categoryUrl = '?category=beauty&sort=title-asc';
  choose(1, 'title-asc');
  await waitFor(() => ready() && location.search === '?sort=title-asc');
  choose(0, 'beauty');
  await waitFor(() => ready() && location.search === categoryUrl);
  click('nav[aria-label="Product pages"] a:last-child');
  await waitFor(() => ready() && location.search.endsWith('page=2'));
  fill('catalog-search', 'history');
  check(searchInput() === 'history' && categoryValue() === 'beauty', 'Draft search updates immediately while the category remains active during debounce');
  await waitFor(() => ready() && location.search === '?q=history&sort=title-asc');
  check(categoryValue() === '' && catalogRequests.at(-1) === '/products/search', 'Debounced search clears category, resets page and preserves sorting');
  click('nav[aria-label="Product pages"] a:last-child');
  await waitFor(() => ready() && location.search === '?q=history&sort=title-asc&page=2');
  fill('catalog-search', 'stale');
  choose(0, 'beauty');
  await waitFor(() => ready() && location.search === categoryUrl);
  const requests = catalogRequests.length;
  await pause(450);
  check(searchInput() === '' && location.search === categoryUrl && catalogRequests.length === requests && catalogRequests.at(-1) === '/products/category/beauty', 'Category clears search, resets page and cancels pending debounce without another request');
  history.back();
  await waitFor(() => ready() && location.search === '?q=history&sort=title-asc&page=2');
  check(searchInput() === 'history' && categoryValue() === '', 'Native Back restores search input, mode, sorting and page');
  history.forward();
  await waitFor(() => ready() && location.search === categoryUrl);
  check(searchInput() === '' && categoryValue() === 'beauty', 'Native Forward restores category mode and clears visible search');
  fill('catalog-search', 'cancel even on the same category URL');
  choose(0, 'beauty');
  await pause(450);
  check(location.search === categoryUrl && searchInput() === '', 'Reselecting the active category also cancels a pending search');
  for (let cycle = 0; cycle < 2; cycle += 1) {
    fill('catalog-search', 'history');
    await waitFor(() => ready() && location.search === '?q=history&sort=title-asc');
    choose(0, 'beauty');
    await waitFor(() => ready() && location.search === categoryUrl);
    check(searchInput() === '' && categoryValue() === 'beauty', `Repeated mode switch ${cycle + 1} remains exclusive`);
  }
  const historyLength = history.length;
  click('#legacy-catalog');
  await waitFor(() => ready() && location.search === '?q=history&sort=title-asc&page=2');
  await pause(450);
  check(searchInput() === 'history' && categoryValue() === '' && history.length === historyLength + 1, 'Legacy combined URL prefers search, preserves sort/page and replaces without history loops');
  history.back();
  await waitFor(() => ready() && location.search === categoryUrl);
  history.forward();
  await waitFor(() => ready() && location.search === '?q=history&sort=title-asc&page=2');
  check(searchInput() === 'history' && categoryValue() === '', 'Native history retains the canonical legacy destination');
  click('form[role="search"] button[type="button"]');
  await waitFor(() => ready() && location.search === '');

  click('article a');
  await waitFor(() => ready() && Boolean(document.querySelector('#product-title')));
  await savePosition();
  history.back();
  await waitFor(() => location.pathname === '/products' && ready());
  history.forward();
  await waitFor(() => Boolean(document.querySelector('main [data-scroll-pending]')));
  await waitFor(() => ready() && atSavedPosition());
  check(true, 'Native Forward restores product scroll near 900 after delayed data');
  history.back();
  await waitFor(() => location.pathname === '/products' && ready());
  productFailure = true;
  history.forward();
  await waitFor(() => ready() && Boolean(document.querySelector('[role="alert"]')));
  check(scrollY <= document.documentElement.scrollHeight - innerHeight + 1, 'Failed product load settles at an available scroll position');
  productFailure = false;
  click('header a[href="/products"]');
  await waitFor(() => location.pathname === '/products' && ready());
  const beforeAbort = aborted;
  click('article a');
  await waitFor(() => Boolean(document.querySelector('main [data-scroll-pending]')));
  click('header a[href="/login"]');
  await waitFor(() => Boolean(document.querySelector('#auth-email')));
  await pause(350);
  check(aborted > beforeAbort && location.pathname === '/login', 'Navigation cancels pending product loading without a stale update');
  fill('auth-email', user.email); fill('auth-password', 'mock only password phrase');
  document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => location.pathname === '/products' && ready() && Boolean(document.querySelector('article')));
  check(true, 'Independent mocked login returns to the catalog');
  click('header a[href="/account"]');
  await waitFor(() => location.pathname === '/account' && ready() && Boolean(document.querySelector('main a[href="/orders"]')));
  click('main a[href="/orders"]');
  await waitFor(orderListReady);
  await savePosition();
  history.back();
  await waitFor(() => location.pathname === '/account' && ready() && Boolean(document.querySelector('main a[href="/orders"]')));
  history.forward();
  await waitFor(() => Boolean(document.querySelector('main [data-scroll-pending]')));
  await waitFor(() => orderListReady() && atSavedPosition());
  check(true, 'Native Forward restores order-list scroll near 900 after delayed data');
  click(`main a[href="/orders/${order.id}"]`);
  await waitFor(orderDetailReady);
  await savePosition();
  history.back();
  await waitFor(orderListReady);
  history.forward();
  await waitFor(() => Boolean(document.querySelector('main [data-scroll-pending]')));
  await waitFor(() => orderDetailReady() && atSavedPosition());
  check(true, 'Native Forward restores order-detail scroll near 900 after delayed data');
  history.back();
  await waitFor(orderListReady);
  orderFailure = true;
  history.forward();
  await waitFor(() => ready() && Boolean(document.querySelector('[role="alert"]')));
  check(true, 'Failed order load clears readiness marker and displays its existing error');
  orderFailure = false;

  // Exercise the real deadline callback with an accelerated test clock, not a 20s wait.
  const originalTimeout = window.setTimeout;
  const originalScroll = window.scrollTo.bind(window);
  let fallbacks = 0;
  window.setTimeout = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    if (ms === 20_000 && typeof handler === 'function') return originalTimeout(() => { fallbacks += 1; handler(...args); }, 80);
    return originalTimeout(handler, ms, ...args);
  }) as typeof window.setTimeout;
  try {
    holdProduct = true;
    click('header a[href="/products"]');
    await waitFor(() => location.pathname === '/products' && ready());
    click('article a');
    await waitFor(() => fallbacks === 1);
    window.scrollTo({ top: 200, behavior: 'instant' });
    await pause(50);
    let lateScrollCalls = 0;
    window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
      lateScrollCalls += 1;
      originalScroll(...args);
    }) as typeof window.scrollTo;
    releaseProduct();
    await waitFor(() => Boolean(document.querySelector('#product-title')));
    check(lateScrollCalls === 0, 'Deadline disconnects restoration: late content triggers no application scroll');
  } finally { window.setTimeout = originalTimeout; window.scrollTo = originalScroll; }

  flushSync(() => root.render(<section className="page-width py-12"><h1>Native navigation checks passed.</h1><p>{passed.length} browser assertions passed. Auth/catalog/orders were mocked; no production requests.</p><ul>{passed.map((message) => <li key={message}>{message}</li>)}</ul></section>));
}
void run().catch((error: unknown) => {
  flushSync(() => root.render(<p role="alert">Native navigation checks failed: {error instanceof Error ? error.message : 'unknown failure'}</p>));
});
