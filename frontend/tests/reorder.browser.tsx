// Development-only. Real providers and native router history; every API and storage operation is isolated.
import { StrictMode, useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import type { NavigateFunction } from 'react-router';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { CartProvider, useCart } from '../src/cart/CartContext';
import type { CartState } from '../src/cart/cart';
import type { CartStoreAction, ReorderResult } from '../src/cart/reorder';
import { CART_STORAGE_KEY } from '../src/cart/storage';
import { OrdersPage } from '../src/pages/OrdersPage';
import { CartPage } from '../src/pages/CartPage';
import { RouteScroll } from '../src/components/RouteScroll';
import '../src/styles.css';

const container = document.getElementById('root')!;
const params = new URLSearchParams(location.search);
const width = Number(params.get('width'));
const preview = params.has('preview');
const checks: string[] = [];
function check(value: unknown, message: string): void {
  if (!value) throw new Error(message);
  checks.push(message);
}
const pause = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function waitFor(test: () => boolean) {
  const end = performance.now() + 4000;
  while (!test()) { if (performance.now() > end) throw new Error(`Timed out after ${checks.at(-1)}: ${container.textContent}`); await pause(10); }
  await pause(0);
}
function button(text: string) { return [...container.querySelectorAll('button')].find((item) => item.textContent === text); }
function click(text = 'Reorder') { const target = button(text); if (!target) throw new Error(`Missing button ${text}`); flushSync(() => target.click()); }
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const timestamp = new Date().toISOString();
const user = { id: uuid(900), email: 'fixture@example.com', role: 'USER', createdAt: timestamp, updatedAt: timestamp };
const product = (id: number, stock = 10, price = 12.5) => ({ id, title: `Current product ${id}`, category: 'beauty', price, stock,
  thumbnail: `${location.origin}/images/ceramics.jpg`, images: [], description: 'Isolated fixture product' });
const order = (id = 1) => ({ id: uuid(id), status: 'PENDING_PAYMENT', currency: 'USD', totalCents: 500,
  createdAt: timestamp, updatedAt: timestamp,
  items: [1, 2].map((productId) => ({ id: uuid(100 + productId), productId, title: `Recorded product ${productId}`,
    quantity: productId === 1 ? 2 : 3, unitPriceCents: 100, lineTotalCents: (productId === 1 ? 2 : 3) * 100 })) });

async function child() {
  const root = createRoot(container);
  const memory = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { value: {
    getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key),
  } });
  let mode: 'ok' | 'partial' | 'partial-first' | 'failed' | 'held' | 'stock' = 'ok';
  let lookups = 0;
  let writes = 0;
  let missing = false;
  let orderError = false;
  let authUser = user;
  let orderHeld = false;
  let releaseOrder = () => {};
  let releases: (() => void)[] = [];
  const signals: AbortSignal[] = [];
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeClear = window.clearTimeout.bind(window);
  let deadline: (() => void) | null = null;
  let timerId = 0;
  // Only the preparation deadline is controlled. UI waits and authentication expiry use real timers.
  window.setTimeout = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    if (ms === 20_000 && typeof handler === 'function') { deadline = handler as () => void; timerId = nativeTimeout(() => {}, 60_000); return timerId; }
    return nativeTimeout(handler, ms, ...args);
  }) as typeof window.setTimeout;
  window.clearTimeout = (id: unknown) => { if (id === timerId) deadline = null; nativeClear(id as number | undefined); };
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === '/auth/login') return Response.json({ user: authUser, accessToken: 'fixture.payload.signature', tokenType: 'Bearer', expiresIn: 900 });
    if (options?.method && options.method !== 'GET') { writes += 1; throw new Error('Unexpected write blocked'); }
    if (url.pathname === '/auth/me') return Response.json(authUser);
    if (url.pathname.startsWith('/orders/')) {
      if (orderHeld) await new Promise<void>((resolve) => { releaseOrder = resolve; });
      if (orderError) return Response.json({}, { status: 503 });
      return missing ? Response.json({}, { status: 404 }) : Response.json(order(url.pathname.endsWith(uuid(2)) ? 2 : 1));
    }
    if (/^\/products\/\d+$/.test(url.pathname)) {
      lookups += 1;
      const id = Number(url.pathname.split('/').at(-1));
      const selected = mode;
      if (options?.signal) signals.push(options.signal);
      if (selected === 'held') await new Promise<void>((resolve) => releases.push(resolve)); // Deliberately ignores abort.
      if (selected === 'failed') throw new TypeError('Internal diagnostic must never reach UI');
      if ((selected === 'partial' && id === 2) || (selected === 'partial-first' && id === 1)) return Response.json({}, { status: 404 });
      return Response.json(product(id, selected === 'stock' ? 3 : 10));
    }
    throw new Error(`Unexpected fixture GET ${url.pathname}`);
  };

  let cart: CartState = { items: [] };
  let receipt: ReorderResult | null = null;
  let dispatch: (action: CartStoreAction) => void = () => {};
  let navigate: NavigateFunction = () => {};
  let logout = () => {};
  let changeUser = () => {};
  let routeState: unknown;
  let route = '';
  const receiptIds = new Set<string>();
  let observedCommitPending = false;
  const committedReceipt = (): ReorderResult | null => receipt;
  function Probe() {
    const context = useCart();
    const auth = useAuth();
    const loc = useLocation();
    cart = context.state; receipt = context.reorderResult; dispatch = context.dispatch; navigate = useNavigate(); logout = auth.logout;
    route = loc.pathname; routeState = loc.state;
    changeUser = () => { authUser = { ...user, id: uuid(901) }; void auth.login({ email: user.email, password: 'mock-only-password' }, new AbortController().signal); };
    useLayoutEffect(() => {
      if (context.reorderResult?.acceptedCount && loc.pathname.startsWith('/orders/')) observedCommitPending = button('Updating your bag…')?.disabled === true;
    }, [context.reorderResult, loc.pathname]);
    useEffect(() => { if (context.reorderResult) receiptIds.add(context.reorderResult.requestId); }, [context.reorderResult]);
    return null;
  }
  function Setup({ signedIn }: { signedIn: boolean }) {
    const { login } = useAuth();
    const [ready, setReady] = useState(!signedIn);
    useEffect(() => {
      if (!signedIn) return;
      const controller = new AbortController();
      void login({ email: user.email, password: 'mock-only-password' }, controller.signal).then(() => {
        if (!controller.signal.aborted) setReady(true);
      }).catch(() => {});
      return () => controller.abort();
    }, []);
    return ready ? <><Probe /><RouteScroll /><main id="main-content" tabIndex={-1}>
      <Routes><Route path="/orders/:id" element={<OrdersPage />} /><Route path="/cart" element={<CartPage />} />
        <Route path="*" element={<p>Other public route</p>} /></Routes>
    </main></> : <p>Preparing mocked authentication…</p>;
  }
  let mount = 0;
  async function render({ signedIn = true, saved = false, path = `/orders/${uuid(1)}` } = {}) {
    flushSync(() => root.render(null));
    if (!saved) memory.clear();
    mode = 'ok'; missing = false; orderError = false; authUser = user; lookups = 0; receiptIds.clear(); releases = []; signals.length = 0;
    history.replaceState(null, '', path);
    flushSync(() => root.render(<StrictMode key={++mount}><BrowserRouter><AuthProvider><CartProvider><Setup signedIn={signedIn} /></CartProvider></AuthProvider></BrowserRouter></StrictMode>));
    await waitFor(() => route === path && (signedIn ? Boolean(button('Reorder')) || missing || path === '/cart' : Boolean(container.querySelector('a[href^="/login"]'))));
  }
  const seed = (id: number, qty: number, stock = 100, price = 1) => flushSync(() => dispatch({ type: 'add', product: product(id, stock, price), quantity: qty }));
  async function beginHeld() { mode = 'held'; const target = button('Reorder')!; flushSync(() => { target.click(); target.click(); }); await waitFor(() => releases.length === 2); }
  async function finishHeld() { releases.splice(0).forEach((release) => release()); await pause(50); }
  const stay = () => route.startsWith('/orders/') && Boolean(button('Reorder'));
  const results = () => container.querySelector('[aria-label="Reorder results"]')?.textContent ?? '';
  const stored = () => JSON.parse(memory.get(CART_STORAGE_KEY) ?? '{}') as { version: number; items: unknown[] };

  if (params.has('reload')) {
    const key = '10x-fixture-reorder-reload';
    if (params.get('reload') === 'after') {
      const snapshot = sessionStorage.getItem(key)!;
      memory.set(CART_STORAGE_KEY, snapshot);
      await render({ saved: true, path: '/cart' });
      check(cart.items.length === 2 && cart.items[0].quantity === 2 && cart.items[1].quantity === 3, 'Full document reload preserves exact ordinary cart quantities');
      check(receipt === null && !container.querySelector('[aria-label="Reorder results"]') && lookups === 0, 'Full document reload cannot replay a batch or success announcement');
      sessionStorage.removeItem(key);
      flushSync(() => root.unmount());
      window.parent.postMessage({ kind: 'reorder-result', checks }, location.origin);
      container.textContent = `Reorder reload checks passed. ${checks.length} assertions.`;
      return;
    }
    await render(); click(); await waitFor(() => route === '/cart' && Boolean(container.querySelector('[aria-label="Reorder results"]')));
    await waitFor(() => Boolean(routeState && typeof routeState === 'object' && 'reorderNoticeConsumed' in routeState));
    sessionStorage.setItem(key, memory.get(CART_STORAGE_KEY)!); // Fixture-only bridge for the isolated storage mock across document reload.
    history.replaceState(history.state, '', `/tests/reorder.html?width=${width}&reload=after`);
    location.reload();
    return;
  }
  await render();
  check(container.textContent?.includes('Pending payment · unpaid') && container.textContent.includes('Sample delivery timeline'), 'Real unpaid status and academic simulation remain visible');
  check((button('Reorder')?.getBoundingClientRect().height ?? 0) >= 44 && button('Reorder')?.tabIndex === 0, 'Reorder is a native keyboard-focusable 44px button');
  button('Reorder')!.focus();
  check(document.activeElement === button('Reorder'), 'Reorder accepts keyboard focus');
  if (preview) return; // Leaves an authenticated mocked detail view for real keyboard/visual inspection.
  seed(1, 1); seed(9, 4);
  await beginHeld();
  check(button('Checking availability…')?.disabled && button('Checking availability…')?.getAttribute('aria-busy') === 'true', 'Pending preparation disables activation and exposes busy state');
  const busy = button('Checking availability…')!;
  flushSync(() => { busy.click(); busy.click(); });
  check(lookups === 2 && receipt === null, 'Rapid repeated clicks start one lookup operation and no speculative commit');
  await finishHeld(); await waitFor(() => route === '/cart' && Boolean(container.querySelector('[aria-label="Reorder results"]')));
  check(cart.items.find((item) => item.id === 1)?.quantity === 3 && cart.items.find((item) => item.id === 2)?.quantity === 3, 'Full success adds exact historical quantities and merges existing units');
  check(cart.items.find((item) => item.id === 9)?.quantity === 4, 'Unrelated cart lines are preserved');
  check(cart.items.find((item) => item.id === 1)?.price === 12.5 && order().items[0].unitPriceCents === 100, 'Accepted existing line uses current price while historical data stays unchanged');
  check(receiptIds.size === 1 && committedReceipt()?.acceptedCount === 2 && observedCommitPending, 'StrictMode consumes exactly one matching committed request receipt');
  check(container.querySelector('[role="status"]') !== null && container.textContent?.includes('Items added to cart ✓'), 'Full success navigates and displays exact accessible success text');
  check(results().indexOf('Recorded product 1') < results().indexOf('Recorded product 2') && results().includes('2 units: Added.') && results().includes('3 units: Added.'), 'Feedback preserves historical ordering and quantities');
  check(container.textContent?.includes('repriced for all their units') && container.textContent.includes('no stock is reserved'), 'Feedback discloses current repricing and no reservation');
  await waitFor(() => Boolean(routeState && typeof routeState === 'object' && 'reorderNoticeConsumed' in routeState));
  check((routeState as { reorderNoticeConsumed: string }).reorderNoticeConsumed === committedReceipt()?.requestId, 'Consumed feedback matches the actual committed request ID');
  check(!('reorderFeedback' in (routeState as object)), 'Router feedback is consumed with replace');
  check(Object.keys(stored()).sort().join(',') === 'items,version' && memory.size === 1 && !memory.get(CART_STORAGE_KEY)?.includes('requestId'), 'Persistence contains ordinary cart data only');
  check(document.documentElement.scrollWidth <= innerWidth, 'Cart feedback and quantities fit viewport');
  const committed = JSON.stringify(cart);
  flushSync(() => { void navigate('/cart', { state: { keep: 'new-cart-visit' } }); });
  await waitFor(() => !container.querySelector('[aria-label="Reorder results"]'));
  history.back(); await waitFor(() => route === '/cart' && (routeState as { reorderNoticeConsumed?: string })?.reorderNoticeConsumed === committedReceipt()?.requestId);
  check(!container.querySelector('[aria-label="Reorder results"]') && JSON.stringify(cart) === committed, 'Same-path cart revisit and Back cannot revive an old announcement or addition');
  history.back(); await waitFor(stay);
  history.forward(); await waitFor(() => route === '/cart');
  check(JSON.stringify(cart) === committed && !container.textContent?.includes('Items added to cart ✓'), 'Native Back/Forward never replay additions or old announcements');
  await render({ saved: true, path: '/cart' });
  check(JSON.stringify(cart) === committed && receipt === null && !container.querySelector('[aria-label="Reorder results"]'), 'Provider reload restores only cart contents, with no receipt or feedback replay');

  await render(); mode = 'partial'; click(); await waitFor(() => route === '/cart' && Boolean(container.querySelector('[aria-label="Reorder results"]')));
  check(cart.items.length === 1 && results().includes('Recorded product 2 — 3 units: Skipped. No longer available.'), 'Individual lookup failure preserves successful additions and explains skipped quantity');
  check(container.textContent?.includes('Some items were added') && !container.textContent.includes('Items added to cart ✓'), 'Partial success never claims full success');

  await render(); mode = 'partial-first'; click(); await waitFor(() => route === '/cart' && Boolean(container.querySelector('[aria-label="Reorder results"]')));
  check(cart.items.length === 1 && cart.items[0].id === 2 && results().includes('Recorded product 1 — 2 units: Skipped.') && results().includes('Recorded product 2 — 3 units: Added.'), 'Receipt indices after a lookup exclusion map back to original historical order');

  await render(); await beginHeld(); seed(1, 9); await finishHeld(); await waitFor(() => route === '/cart' && Boolean(container.querySelector('[aria-label="Reorder results"]')));
  check(cart.items.find((item) => item.id === 1)?.quantity === 9 && cart.items.find((item) => item.id === 1)?.price === 1, 'Intervening ordinary edits are respected; fresh stock rejection preserves quantity and price');
  check(results().includes('Not enough stock for this addition'), 'Actual commit stock rejection appears beside successful lines');

  await render(); for (const id of [1, ...Array.from({ length: 19 }, (_, i) => i + 3)]) seed(id, 1);
  click(); await waitFor(() => route === '/cart' && Boolean(container.querySelector('[aria-label="Reorder results"]')));
  check(cart.items.length === 20 && cart.items.find((item) => item.id === 1)?.quantity === 3 && !cart.items.some((item) => item.id === 2), 'Capacity rejects a 21st type but accepts an existing product');
  check(results().includes('20 different products'), `Capacity rejection is explained: ${results()}`);

  await render(); seed(1, 100); seed(2, 100); const rejected = cart;
  click(); await waitFor(() => stay() && results().includes('Skipped.'));
  check(cart === rejected && results().includes('100 units of this product') && !container.textContent?.includes('Items added to cart ✓'), 'All commit rejections preserve cart identity and stay on details with retry');
  check(button('Reorder')?.disabled === false, 'All-rejected operation allows retry');

  await render(); mode = 'failed'; click(); await waitFor(() => stay() && results().includes('Skipped.'));
  check(cart.items.length === 0 && receipt === null && !container.textContent?.includes('Internal diagnostic'), 'All lookup failures never dispatch or expose internal errors');
  mode = 'ok'; click(); await waitFor(() => route === '/cart' && Boolean(container.querySelector('[aria-label="Reorder results"]')));
  check(cart.items.length === 2, 'Retry succeeds after ordinary lookup failures');

  await render(); await beginHeld(); check(deadline !== null, 'One bounded operation deadline is installed');
  flushSync(() => deadline?.()); await waitFor(() => stay() && Boolean(container.querySelector('[role="alert"]')));
  check(cart.items.length === 0 && receipt === null && container.textContent?.includes('timed out'), 'Timeout leaves cart unchanged and provides actionable retry');
  await finishHeld(); check(cart.items.length === 0 && receipt === null, 'Non-cooperative late responses cannot commit after timeout');

  for (const cancellation of ['unmount', 'logout', 'user-change', 'order-change']) {
    await render(); await beginHeld();
    if (cancellation === 'logout') flushSync(() => logout());
    else if (cancellation === 'user-change') flushSync(() => changeUser());
    else flushSync(() => { void navigate(cancellation === 'order-change' ? `/orders/${uuid(2)}` : '/products'); });
    await waitFor(() => signals.every((signal) => signal.aborted));
    await finishHeld();
    check(cart.items.length === 0 && receipt === null, `${cancellation} aborts preparation and prevents late additions`);
    check(!container.textContent?.includes('Items added to cart ✓'), `${cancellation} cannot navigate on stale success`);
  }

  await render(); flushSync(() => dispatch({ type: 'reorder', requestId: 'old-result', lines: [] }));
  await beginHeld(); check(stay() === false && route.startsWith('/orders/') && committedReceipt()?.requestId === 'old-result', 'An old Context result cannot claim success during preparation');
  seed(9, 2); await finishHeld(); await waitFor(() => route === '/cart' && Boolean(container.querySelector('[aria-label="Reorder results"]')));
  check(committedReceipt()?.requestId !== 'old-result' && cart.items.find((item) => item.id === 9)?.quantity === 2, 'Only matching new result navigates, preserving latest ordinary edits');
  await pause(50); check(cart.items.find((item) => item.id === 1)?.quantity === 2, 'Repeated renders do not duplicate committed additions');

  await render({ signedIn: false });
  check(!button('Reorder') && !container.textContent?.includes('Recorded product'), 'Guests see no Reorder or private order content');
  orderHeld = true;
  const loading = render(); await waitFor(() => Boolean(container.querySelector('[data-scroll-pending]')));
  check(!button('Reorder'), 'Loading details have no Reorder button');
  missing = true; orderHeld = false; releaseOrder(); await loading;
  await waitFor(() => container.textContent?.includes('Order not found.') === true);
  check(!button('Reorder'), 'Missing order has no Reorder button');
  orderHeld = true;
  const failing = render(); await waitFor(() => Boolean(container.querySelector('[data-scroll-pending]')));
  orderError = true; orderHeld = false; releaseOrder();
  await waitFor(() => Boolean(container.querySelector('[role="alert"]')));
  check(!button('Reorder') && Boolean(button('Try again')), 'Order fetch error offers retry but no Reorder');
  orderError = false; click('Try again'); await failing; await waitFor(() => Boolean(button('Reorder')));
  check(Boolean(button('Reorder')), 'Successful order retry restores Reorder');
  // Unknown/stale router state is removed, unrelated state survives, and it can never trigger a batch.
  flushSync(() => { void navigate('/cart', { state: { keep: 'unrelated', reorderFeedback: { requestId: 'stale', userId: user.id, lines: [] } } }); });
  await waitFor(() => route === '/cart' && typeof routeState === 'object' && routeState !== null && !('reorderFeedback' in routeState));
  check((routeState as { keep: string }).keep === 'unrelated' && !container.querySelector('[aria-label="Reorder results"]') && receipt === null, 'Invalid feedback is discarded without losing unrelated router state or replaying a batch');
  check(writes === 0, 'No order POST, checkout, payment or status update request was made');
  flushSync(() => root.unmount());
  window.setTimeout = nativeTimeout; window.clearTimeout = nativeClear;
  window.parent.postMessage({ kind: 'reorder-result', checks }, location.origin);
  container.textContent = `Reorder checks passed. ${checks.length} assertions.`;
}

async function parent() {
  const cases = preview ? [{ size: Number(params.get('preview')), reload: false }]
    : [...[320, 375, 1440].map((size) => ({ size, reload: false })), { size: 320, reload: true }];
  for (const { size, reload } of cases) {
    const frame = document.createElement('iframe');
    frame.title = `Reorder at ${size}px`; frame.style.cssText = `display:block;width:${size}px;height:1000px;border:0;max-width:none`;
    frame.src = `/tests/reorder.html?width=${size}${preview ? '&preview' : reload ? '&reload=before' : ''}`; container.append(frame);
    if (preview) return;
    const result = await new Promise<{ checks: string[]; error?: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Viewport ${size} timed out`)), 30000);
      function receive(event: MessageEvent) {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.kind !== 'reorder-result') return;
        clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data);
      }
      window.addEventListener('message', receive);
    });
    if (result.error) throw new Error(`${size}px: ${result.error}`);
    checks.push(`${reload ? 'Document reload' : `${size}px`}: ${result.checks.length} assertions`); frame.remove();
  }
  container.textContent = `Reorder checks passed. ${checks.join(' · ')}. Mocked APIs, real StrictMode providers and native history.`;
}
void (width ? child() : parent()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown failure';
  container.textContent = `Reorder checks failed: ${message}`;
  if (width) window.parent.postMessage({ kind: 'reorder-result', checks, error: message }, location.origin);
});
