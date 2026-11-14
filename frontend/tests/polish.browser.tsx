// Development-only browser checks. Every API response and storage operation is mocked.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { App } from '../src/App';
import { AuthProvider } from '../src/auth/AuthContext';
import { CartProvider } from '../src/cart/CartContext';
import { Pagination } from '../src/components/Pagination';
import '../src/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing fixture root');
const params = new URLSearchParams(location.search);
const width = Number(params.get('width'));
const preview = params.has('preview');
const checks: string[] = [];
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
  checks.push(message);
}
async function waitFor(condition: () => boolean) {
  const deadline = performance.now() + 8000;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error('Timed out waiting for fixture');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  check(element, `Control exists: ${selector}`);
  element.click();
}
function fill(id: string, value: string) {
  const field = document.getElementById(id);
  check(field instanceof HTMLInputElement, `Field exists: ${id}`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
  flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
}
function HistoryControls() {
  const navigate = useNavigate();
  const current = useLocation();
  return <div className="sr-only"><output id="fixture-query">{current.search}</output><button id="fixture-back" onClick={() => void navigate(-1)}>Fixture back</button><button id="fixture-forward" onClick={() => void navigate(1)}>Fixture forward</button><button id="fixture-orders" onClick={() => void navigate('/orders')}>Fixture orders</button></div>;
}

async function child() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key),
  } });
  const user = { id: '3381026f-bc0d-466f-bab3-ef735b663c35', email: 'mock@example.com', role: 'USER', createdAt: '2026-10-21T10:00:00Z', updatedAt: '2026-10-21T10:00:00Z' };
  let delay = 0;
  let orderMode: 'empty' | 'list' | 'error' | 'missing' = 'empty';
  let orderDelay = 0;
  let orderReads = 0;
  const order = { id: '00000000-0000-4000-8000-000000000002', status: 'PENDING_PAYMENT', currency: 'USD', totalCents: 2468,
    createdAt: '2026-11-08T10:00:00Z', updatedAt: '2026-11-08T10:00:00Z',
    items: [{ id: '00000000-0000-4000-8000-000000000100', productId: 1, title: 'Recorded selection', quantity: 2, unitPriceCents: 1234, lineTotalCents: 2468 }] };
  const olderOrder = { ...order, id: '00000000-0000-4000-8000-000000000001', createdAt: '2026-11-07T10:00:00Z' };
  let sessionActive = false;
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const pathname = url.pathname.replace(/^\/api\//, '/');
    if (pathname === '/auth/login') { sessionActive = true; return Response.json({ user }); }
    if (pathname === '/auth/session') return sessionActive ? Response.json({ user, expiresAt: Date.now() + 900_000 }) : new Response(null, { status: 401 });
    if (pathname === '/auth/logout') { sessionActive = false; return new Response(null, { status: 204 }); }
    if (pathname.startsWith('/orders')) {
      check(options?.method === 'GET', 'Order fixture permits GET reads only');
      orderReads += 1;
      const mode = orderMode;
      await new Promise((resolve) => setTimeout(resolve, orderDelay));
      if (mode === 'error') return Response.json({}, { status: 503 });
      if (pathname !== '/orders') return mode === 'missing' ? Response.json({}, { status: 404 }) : Response.json(order);
      return Response.json(mode === 'empty' ? [] : [order, olderOrder]);
    }
    if (pathname === '/products/categories') return Response.json([{ slug: 'beauty', name: 'Beauty' }]);
    if (pathname.startsWith('/products')) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      const skip = Number(url.searchParams.get('skip') ?? 0);
      const limit = url.searchParams.get('limit') === '0' ? 24 : 12;
      const products = Array.from({ length: 24 }, (_, i) => ({
        id: i + 1, title: `Considered piece ${i + 1}`, category: 'beauty', price: 12.5, rating: 4,
        thumbnail: `${location.origin}/images/ceramics.jpg`,
      }));
      if (url.searchParams.get('sortBy') === 'title' && url.searchParams.get('order') === 'asc') products.sort((a, b) => a.title.localeCompare(b.title));
      return Response.json({ total: 24, skip, limit, products: products.slice(skip, skip + limit) });
    }
    throw new Error('Unexpected fixture request; external fetch is disabled');
  };
  const root = createRoot(container!);
  root.render(<MemoryRouter initialEntries={['/products']}><AuthProvider><CartProvider><HistoryControls /><App /></CartProvider></AuthProvider></MemoryRouter>);
  await waitFor(() => Boolean(document.querySelector('article')) && document.fonts.status === 'loaded');
  const header = document.querySelector('header')!;
  check(document.documentElement.scrollWidth <= innerWidth, 'No horizontal overflow');
  check(!header.querySelector('a[href="/orders"]'), 'Guest desktop and mobile navigation omit Orders');
  click('#fixture-orders');
  await waitFor(() => document.querySelector('h1')?.textContent === 'Sign in to continue.');
  check(orderReads === 0 && !document.querySelector('main')?.textContent?.includes(order.id), 'Guest order route exposes no order data and makes no order request');
  click('header a[href="/products"]');
  await waitFor(() => Boolean(document.querySelector('article')));
  const login = header.querySelector<HTMLAnchorElement>('a[href="/login"]')!;
  check(header.querySelectorAll('a[href="/login"]').length === 1 && !header.querySelector('a[href="/register"]'), 'One guest login; registration is not duplicated');
  const actions = [...header.querySelectorAll<HTMLAnchorElement>('a')].filter((a) => ['Search products', 'Log in', 'Shopping bag, 0 items'].includes(a.getAttribute('aria-label') ?? a.textContent?.trim() ?? ''));
  check(actions.length === 3 && actions[1] === login, 'Search, login, bag order');
  for (const a of actions) {
    const box = a.getBoundingClientRect();
    check(box.width >= 44 && box.height >= 44, 'Header action has a 44px target');
  }
  for (const select of document.querySelectorAll('select')) {
    const svg = select.parentElement!.querySelector('svg')!;
    const a = select.getBoundingClientRect(), b = svg.getBoundingClientRect();
    check(Math.abs(a.top + a.height / 2 - b.top - b.height / 2) < 1, 'Select chevron is vertically centered');
    check(getComputedStyle(svg).pointerEvents === 'none' && parseFloat(getComputedStyle(select).paddingRight) >= 40, 'Select keeps decoration out of hit testing and text');
    select.focus();
    check(document.activeElement === select, 'Native select accepts keyboard focus');
  }
  if (preview) return;
  async function checkOrderHistory() {
    check(header.querySelectorAll('a[href="/orders"]').length === 2 && Boolean(header.querySelector('a[href="/profile"]')), 'Authenticated desktop/mobile Orders entries preserve Account');
    async function openOrders() {
      if (width < 1280) {
        click('header button[aria-controls="mobile-navigation"]');
        await waitFor(() => !header.querySelector('#mobile-navigation')?.hasAttribute('hidden'));
      }
      const link = header.querySelector<HTMLAnchorElement>(width < 1280 ? '#mobile-navigation a[href="/orders"]' : 'nav[aria-label="Main navigation"] a[href="/orders"]')!;
      link.focus();
      check(document.activeElement === link && link.tabIndex === 0 && link.getBoundingClientRect().height >= 44, 'Visible Orders link is keyboard focusable with a 44px target');
      link.click();
    }
    orderDelay = 250;
    await openOrders();
    await waitFor(() => Boolean(document.querySelector('main [data-scroll-pending]')));
    check(document.querySelector('[role="status"]')?.textContent === 'Loading your orders…', 'Order loading remains announced');
    await waitFor(() => document.querySelector('h2')?.textContent === 'You have no orders yet.');
    check(document.querySelector('main a[href="/products"]')?.textContent === 'Browse products', 'Exact empty-state catalog action targets /products');
    check(header.querySelector('#mobile-navigation')?.hasAttribute('hidden') && header.querySelector('a[href="/orders"]')?.getAttribute('aria-current') === 'page', 'Orders navigation marks the route and closes the mobile menu');
    click('main a[href="/products"]');
    await waitFor(() => Boolean(document.querySelector('article')));
    orderDelay = 0;
    orderMode = 'error';
    await openOrders();
    await waitFor(() => Boolean(document.querySelector('main [role="alert"]')));
    check(!document.querySelector('main')?.textContent?.includes(order.id), 'Failed order read reveals no stale history');
    orderMode = 'list';
    click('main button');
    await waitFor(() => Boolean(document.querySelector(`main a[href="/orders/${order.id}"]`)));
    const main = document.querySelector('main')!;
    check(main.textContent!.indexOf(order.id) < main.textContent!.indexOf(olderOrder.id), 'Newest-first server ordering is preserved');
    for (const text of ['latest 50', 'Date', 'November 8, 2026', 'Items', '2 units', 'Total', '$24.68', 'Pending payment · unpaid', 'No shipping or stock reservation']) check(main.textContent?.includes(text), `Order summary contains ${text}`);
    check(main.textContent?.includes('This is a sample order') && main.textContent.includes('Sample delivery status') && !main.textContent.includes('#10X-'), 'Demo fulfillment is explicitly academic and references remain real UUIDs');
    check(document.documentElement.scrollWidth <= innerWidth && [...main.querySelectorAll('a')].every((link) => link.getBoundingClientRect().right <= innerWidth), 'UUID references and order fields fit the viewport');
    orderMode = 'missing';
    click(`main a[href="/orders/${order.id}"]`);
    await waitFor(() => document.querySelector('h2')?.textContent === 'Order not found.');
    check(Boolean(document.querySelector('main [role="alert"]')) && !document.querySelector('main button'), 'Missing order keeps unavailable messaging without a retry action');
    check(header.querySelector('a[href="/orders"]')?.getAttribute('aria-current') === 'page', 'Orders remains active on a detail route');
    orderMode = 'list';
    click('main a[href="/orders"]');
    await waitFor(() => Boolean(document.querySelector(`main a[href="/orders/${order.id}"]`)));
  }
  if (width === 375) {
    const sort = document.querySelectorAll<HTMLSelectElement>('select')[1];
    const selectedSort = () => sort.value;
    check(JSON.stringify([...sort.options].map((option) => option.value)) === '["default","price-asc","price-desc","rating-desc","title-asc"]', 'All five typed sort options are available');
    const ids = () => [...document.querySelectorAll<HTMLAnchorElement>('article a')].map((a) => Number(a.pathname.split('/').at(-1)));
    const query = () => document.getElementById('fixture-query')?.textContent ?? '';
    click('nav[aria-label="Product pages"] a[rel="next"]');
    await waitFor(() => ids()[0] === 13);
    sort.value = 'title-asc';
    flushSync(() => sort.dispatchEvent(new Event('change', { bubbles: true })));
    await waitFor(() => ids().at(-1) === 2);
    check(query() === '?sort=title-asc' && JSON.stringify(ids()) === '[1,10,11,12,13,14,15,16,17,18,19,2]', 'Name A–Z resets page two and uses global alphabetical order');
    click('nav[aria-label="Product pages"] a[rel="next"]');
    await waitFor(() => ids()[0] === 20);
    check(query() === '?sort=title-asc&page=2' && JSON.stringify(ids()) === '[20,21,22,23,24,3,4,5,6,7,8,9]', 'Alphabetical pagination preserves sort and includes the remaining products');
    click('#fixture-back');
    await waitFor(() => ids().at(-1) === 2);
    check(selectedSort() === 'title-asc' && query() === '?sort=title-asc', 'Back restores the alphabetical first page and select state');
    click('#fixture-forward');
    await waitFor(() => ids()[0] === 20);
    check(selectedSort() === 'title-asc' && query() === '?sort=title-asc&page=2', 'Forward restores the alphabetical second page and URL');
    click('form[role="search"] button[type="button"]');
    await waitFor(() => ids()[0] === 1 && ids().at(-1) === 12);
    check(selectedSort() === 'default' && query() === '', 'Reset restores the normal catalog and default sort');
    const menu = header.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')!;
    flushSync(() => menu.click());
    flushSync(() => menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await waitFor(() => menu.getAttribute('aria-expanded') === 'false');
    check(document.activeElement === menu, 'Escape closes menu and restores focus');
    window.scrollTo({ top: 400, behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    fill('catalog-search', 'piece');
    await waitFor(() => query() === '?q=piece' && Boolean(document.querySelector('article')));
    check(Math.abs(window.scrollY - 400) < 5 && document.activeElement?.id !== 'catalog-results', 'Typing keeps scroll position');
    click('nav[aria-label="Product pages"] a[rel="next"]');
    await waitFor(() => document.activeElement?.id === 'main-content' && window.scrollY === 0 && Boolean(document.querySelector('article')));
    check(document.querySelector('article')?.textContent?.includes('13'), 'Pagination loads next page, scrolls to top and focuses main content');
    window.scrollTo({ top: 700, behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    click('header a[href="/login"]');
    await waitFor(() => Boolean(document.querySelector('#auth-email')));
    check(window.scrollY === 0, 'New route starts at top');
    click('#fixture-back');
    await waitFor(() => Boolean(document.querySelector('article')) && Math.abs(window.scrollY - 700) < 5);
    check(document.querySelector('article')?.textContent?.includes('13'), 'Back restores page state and saved scroll');
    click('#fixture-forward');
    await waitFor(() => Boolean(document.querySelector('#auth-email')));
    check(window.scrollY === 0, 'Forward restores login position');
    fill('auth-email', user.email); fill('auth-password', 'mock only password phrase');
    document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => Boolean(document.querySelector('header a[href="/profile"]')) && Boolean(document.querySelector('article')));
    check(!header.querySelector('a[href="/login"]') && header.textContent?.includes('Profile'), 'Mock login changes the single header control to Profile');
    await checkOrderHistory();
    click('header a[href="/profile"]');
    await waitFor(() => Boolean(document.querySelector('main a[href="/orders"]')));
    click('main a[href="/orders"]');
    await waitFor(() => Boolean(document.querySelector('h1')) && document.querySelector('h1')?.textContent === 'Your orders.');
    click('header a[href="/profile"]');
    await waitFor(() => Boolean(document.querySelector('main button')));
    click('main button');
    await waitFor(() => Boolean(document.querySelector('header a[href="/login"]')) && Boolean(document.querySelector('article')));
    check(!header.querySelector('a[href="/profile"]'), 'Account logout returns guest navigation');
    check(!header.querySelector('a[href="/orders"]'), 'Logout removes both Orders navigation entries');
    click('header a[href="/products#catalog-search"]');
    await waitFor(() => document.activeElement?.id === 'catalog-search');
    check(document.getElementById('catalog-search')?.getAttribute('tabindex') === null, 'Search anchor preserves native tab order');
    check(true, 'Header search lands on and focuses the search field');
    delay = 600;
    click('footer a[href="/#perspective"]');
    await waitFor(() => document.activeElement?.id === 'perspective');
    check(document.getElementById('perspective')!.getBoundingClientRect().top >= 0, 'Perspective waits for async content and receives focus');
    click('footer a[href="/#collections"]');
    await waitFor(() => document.activeElement?.id === 'collections');
    click('footer a[href="/#featured"]');
    await waitFor(() => document.activeElement?.id === 'featured');
    check(true, 'All footer section destinations receive focus');
    const anchoredY = window.scrollY;
    window.scrollTo({ top: 0, behavior: 'instant' });
    await waitFor(() => window.scrollY === 0);
    click('footer a[href="/#featured"]');
    await waitFor(() => document.activeElement?.id === 'featured' && Math.abs(window.scrollY - anchoredY) < 5);
    const target = document.getElementById('featured')!.getBoundingClientRect();
    check(window.scrollY > 0 && target.top >= 0 && target.top < innerHeight, 'Repeated hash navigation restores the visible target after scrolling away');
  } else {
    click('header a[href="/login"]');
    await waitFor(() => Boolean(document.querySelector('#auth-email')));
    fill('auth-email', user.email); fill('auth-password', 'mock only password phrase');
    document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => Boolean(header.querySelector('a[href="/profile"]')));
    await checkOrderHistory();
  }
  const account = header.querySelector<HTMLAnchorElement>('a[href="/profile"]');
  // The 375px flow ends as a guest after testing logout; other widths end signed in.
  if (width !== 375) {
    check(account && !header.querySelector('a[href="/login"]'), 'One authenticated Account control');
    const box = account.getBoundingClientRect();
    check(box.width >= 44 && box.height >= 44 && box.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth, 'Authenticated header fits viewport with a usable target');
  }
  for (const totalPages of [1, 2, 5, 6, 7, 17, 1_000_000]) {
    for (const page of new Set([1, Math.ceil(totalPages / 2), totalPages])) {
      flushSync(() => root.render(<MemoryRouter><Pagination query={{ q: '', category: '', sort: 'default', page }} totalPages={totalPages} /></MemoryRouter>));
      const context = `page ${page} of ${totalPages}`;
      const visible = [...document.querySelectorAll('ol li')].filter((item) => item.getBoundingClientRect().width > 0);
      const centers = visible.map((item) => { const box = item.getBoundingClientRect(); return box.top + box.height / 2; });
      check(document.documentElement.scrollWidth <= innerWidth && visible.length <= 7 && Math.max(...centers) - Math.min(...centers) < 1, `Pagination stays on one centered row without overflow: ${context}`);
      const numbers = [...document.querySelectorAll<HTMLElement>('ol a, ol [aria-current="page"]')].filter((item) => item.getBoundingClientRect().width > 0);
      check(numbers[0].textContent === '1' && numbers.at(-1)?.textContent === String(totalPages) && numbers.some((item) => item.getAttribute('aria-current') === 'page' && item.textContent === String(page)), `First, current and last page stay visible: ${context}`);
      const links = [...document.querySelectorAll('nav a')].map((link) => link.getBoundingClientRect()).filter((box) => box.width > 0);
      check(links.every((box) => box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth), `All visible pagination links retain 44px targets within the viewport: ${context}`);
    }
  }
  window.parent.postMessage({ kind: 'polish-result', width, checks }, location.origin);
}

async function parent() {
  const widths = preview ? [Number(params.get('preview'))] : [320, 375, 390, 480, 768, 1024, 1440];
  for (const size of widths) {
    const frame = document.createElement('iframe');
    frame.title = `Storefront at ${size}px`;
    frame.style.cssText = `display:block;width:${size}px;height:900px;border:0;max-width:none`;
    frame.src = `/tests/polish.html?width=${size}${preview ? '&preview' : ''}`;
    container!.append(frame);
    if (preview) return;
    const result = await new Promise<{ checks: string[]; error?: string }>((resolve, reject) => {
      const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error(`Viewport ${size} timed out`)); }, 25000);
      function receive(event: MessageEvent) {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.kind !== 'polish-result') return;
        clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data);
      }
      window.addEventListener('message', receive);
    });
    if (result.error) throw new Error(`${size}px: ${result.error}`);
    checks.push(`${size}px: ${result.checks.length} assertions passed`);
    frame.remove();
  }
  container!.textContent = `Polish checks passed. ${checks.join(' · ')}`;
}
void (width ? child() : parent()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown fixture error';
  container!.textContent = `Polish checks failed: ${message}`;
  if (width) window.parent.postMessage({ kind: 'polish-result', width, error: message, checks }, location.origin);
});
