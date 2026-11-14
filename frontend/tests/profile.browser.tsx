// Development-only: actual app/router/providers with isolated authentication, catalog and cart storage.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BrowserRouter, useLocation, useNavigate } from 'react-router';
import type { NavigateFunction } from 'react-router';
import { App } from '../src/App';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { CartProvider, useCart } from '../src/cart/CartContext';
import type { CartState } from '../src/cart/cart';
import { CART_STORAGE_KEY } from '../src/cart/storage';
import '../src/styles.css';

const container = document.getElementById('root')!;
const params = new URLSearchParams(location.search);
const width = Number(params.get('width'));
const checks: string[] = [];
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 10));
function check(value: unknown, message: string) { if (!value) throw new Error(message); checks.push(message); }
async function waitFor(test: () => boolean) {
  const deadline = performance.now() + 5000;
  while (!test()) { if (performance.now() > deadline) throw new Error(`Timed out after ${checks.at(-1)}: ${container.textContent}`); await pause(); }
  await pause();
}
const uuid = '00000000-0000-4000-8000-000000000001';
const user = { id: uuid, email: `${'long-email-address-'.repeat(6)}member@example.com`, role: 'USER', createdAt: '2026-01-02T12:00:00Z', updatedAt: '2026-01-03T12:00:00Z' };
const product = { id: 1, title: 'Profile cart fixture', price: 12.5, category: 'beauty', stock: 10, rating: 4,
  thumbnail: `${location.origin}/images/ceramics.jpg`, description: 'Mocked catalog', images: [] };

async function child() {
  const root = createRoot(container);
  const memory = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key),
  } });
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  let authCalls = 0;
  let forbiddenWrites = 0;
  let holdMe = false;
  let releaseMe = () => {};
  let role = 'USER';
  let sessionExpiresAt = params.get('reload') === 'after' ? Number(sessionStorage.getItem('10x-fixture-session')) : 0;
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const pathname = url.pathname.replace(/^\/api\//, '/');
    if (pathname === '/auth/login') {
      authCalls += 1;
      sessionExpiresAt = now + 900_000;
      return Response.json({ user: { ...user, role } });
    }
    if (pathname === '/auth/logout') { sessionExpiresAt = 0; return new Response(null, { status: 204 }); }
    if (options?.method && options.method !== 'GET') { forbiddenWrites += 1; throw new Error('Unexpected write blocked'); }
    if (pathname === '/auth/session') {
      if (holdMe) await new Promise<void>((resolve) => { releaseMe = resolve; });
      return sessionExpiresAt > now ? Response.json({ user: { ...user, role }, expiresAt: sessionExpiresAt }) : new Response(null, { status: 401 });
    }
    if (url.pathname === '/products/categories') return Response.json([{ slug: 'beauty', name: 'Beauty', url: 'https://dummyjson.com/products/category/beauty' }]);
    if (url.pathname === '/products') return Response.json({ products: [product], total: 1, skip: 0, limit: 12 });
    if (pathname === '/orders') return Response.json([]);
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  let cart: CartState = { items: [] };
  let navigate: NavigateFunction = () => {};
  let route = '';
  let search = '';
  let startLogin: () => Promise<void> = async () => {};
  let seed = () => {};
  function Probe() {
    const context = useCart(); const auth = useAuth(); const loc = useLocation();
    cart = context.state; route = loc.pathname; search = loc.search; navigate = useNavigate();
    startLogin = () => auth.login({ email: 'fixture@example.com', password: 'mock-only-password' }, new AbortController().signal);
    seed = () => context.dispatch({ type: 'add', product, quantity: 2 });
    return null;
  }
  function Setup({ signedIn }: { signedIn: boolean }) {
    const auth = useAuth(); const [ready, setReady] = useState(!signedIn);
    useEffect(() => {
      if (!signedIn) return;
      const controller = new AbortController();
      void auth.login({ email: 'fixture@example.com', password: 'mock-only-password' }, controller.signal)
        .then(() => { if (!controller.signal.aborted) setReady(true); }).catch(() => {});
      return () => controller.abort();
    }, []);
    return ready ? <><Probe /><App /></> : <p>Preparing mocked authentication…</p>;
  }
  let mount = 0;
  async function render(path: string, signedIn = true, saved = false) {
    flushSync(() => root.render(null));
    if (!saved) memory.clear();
    history.replaceState(null, '', path);
    flushSync(() => root.render(<StrictMode key={++mount}><BrowserRouter><AuthProvider><CartProvider><Setup signedIn={signedIn} /></CartProvider></AuthProvider></BrowserRouter></StrictMode>));
    await waitFor(() => route === path && Boolean(document.querySelector('main h1')) && !document.querySelector('[data-scroll-pending]'));
  }
  const details = () => document.querySelector('main h2')?.textContent === 'Profile details';
  const guest = () => document.querySelector('main h1')?.textContent === 'Your account awaits.';
  function click(selector: string) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    flushSync(() => element.click());
  }
  if (params.has('reload')) {
    const path = params.get('path') === 'account' ? '/account' : '/profile';
    const key = '10x-fixture-profile-reload';
    if (params.get('reload') === 'after') {
      memory.set(CART_STORAGE_KEY, sessionStorage.getItem(key)!); sessionStorage.removeItem(key);
      sessionStorage.removeItem('10x-fixture-session');
      await render(path, false, true); await waitFor(details);
      check(container.textContent?.includes(user.email) && authCalls === 0 && cart.items[0]?.quantity === 2, `${path} refresh restores the cookie session and preserves the cart`);
      click('main button'); await waitFor(() => route === '/products');
      await render(path, false, true); await waitFor(guest);
      check(sessionExpiresAt === 0 && !details(), `${path} stays signed out after logout and remount`);
    } else {
      await render(path); await waitFor(details); flushSync(() => seed());
      await waitFor(() => memory.has(CART_STORAGE_KEY));
      sessionStorage.setItem(key, memory.get(CART_STORAGE_KEY)!); // Fixture-only bridge for isolated cart storage across document reload.
      sessionStorage.setItem('10x-fixture-session', String(sessionExpiresAt)); // Mock the cookie jar across reload.
      history.replaceState(history.state, '', `/tests/profile.html?width=${width}&reload=after&path=${path.slice(1)}`);
      location.reload(); return;
    }
  } else {
    for (const path of ['/profile', '/account']) {
      await render(path); await waitFor(details); flushSync(() => seed());
      if (params.has('preview')) return; // Keep the isolated authenticated page available for keyboard/visual inspection.
      const snapshot = JSON.stringify(cart);
      check(container.textContent?.includes(user.email) && container.textContent.includes('January 2, 2026'), `${path} displays verified email and membership date`);
      check(!container.textContent?.includes(uuid) && !document.querySelector('main input') && !document.querySelector('main form'), `${path} adds no invented identity fields or editing form`);
      const account = document.querySelector<HTMLAnchorElement>('header a[href="/profile"]')!;
      check(account.textContent?.trim() === 'Profile' && account.getAttribute('aria-current') === 'page', `${path} uses the Profile label and active state`);
      account.focus(); check(document.activeElement === account && account.getBoundingClientRect().height >= 44, `${path} Account link is keyboard-focusable with a 44px target`);
      const mainLinks = [...document.querySelectorAll<HTMLElement>('main a, main button')];
      const logout = document.querySelector<HTMLButtonElement>('main button');
      logout?.focus();
      check(document.activeElement === logout && logout?.classList.contains('text-red-800') && logout.classList.contains('border-red-700'), `${path} Logout is keyboard-focusable and styled as destructive`);
      check(mainLinks.every((item) => item.getBoundingClientRect().height >= 44), `${path} account actions retain 44px targets`);
      const email = document.querySelector('dd')!.getBoundingClientRect();
      check(document.documentElement.scrollWidth <= innerWidth && email.right <= innerWidth && email.left >= 0, `${path} long email and layout fit ${width}px`);
      check(document.querySelector('main a[href="/orders"]') && document.querySelector('main button')?.textContent === 'Logout', `${path} preserves Orders and Logout`);
      check(JSON.stringify(cart) === snapshot && [...memory.keys()].every((key) => key === CART_STORAGE_KEY), `${path} profile display neither changes cart nor stores profile/auth data`);
      if (width < 1280) {
        click('header button'); check(document.querySelector('header button')?.getAttribute('aria-expanded') === 'true', `${path} mobile menu opens`);
        click('header a[href="/profile"]'); await waitFor(() => route === '/profile');
        check(document.querySelector('header button')?.getAttribute('aria-expanded') === 'false', `${path} Account navigation closes mobile menu`);
      }
      flushSync(() => { void navigate('/orders'); }); await waitFor(() => document.querySelector('main h1')?.textContent === 'Your orders.');
      history.back(); await waitFor(details);
      check(JSON.stringify(cart) === snapshot, `${path} native Back restores account without changing cart`);
      history.forward(); await waitFor(() => document.querySelector('main h1')?.textContent === 'Your orders.');
      history.back(); await waitFor(details);
      click('main button'); await waitFor(() => route === '/products' && Boolean(document.querySelector('article')));
      check(!document.querySelector('header a[href="/profile"]') && JSON.stringify(cart) === snapshot, `${path} Logout returns to catalog without clearing cart`);
      flushSync(() => { void navigate(path); }); await waitFor(guest);
      const login = document.querySelector<HTMLAnchorElement>('main a')!;
      check(login.getAttribute('href') === `/login?returnTo=${encodeURIComponent(path)}` && document.querySelector('main a[href^="/register"]')?.getAttribute('href') === `/register?returnTo=${encodeURIComponent(path)}`, `${path} guest Login/Register preserve exact internal return`);
      click('main a[href^="/login"]'); await waitFor(() => route === '/login' && Boolean(document.querySelector('form')));
      check(search === `?returnTo=${encodeURIComponent(path)}`, `${path} login navigation preserves return URL`);
      click('main a[href^="/register"]'); await waitFor(() => route === '/register');
      check(search === `?returnTo=${encodeURIComponent(path)}`, `${path} registration link preserves return URL`);
      click('main a[href^="/login"]'); await waitFor(() => route === '/login');
      await startLogin(); await waitFor(() => route === path && details());
      check(JSON.stringify(cart) === snapshot, `${path} successful mocked login returns to requested account route with cart intact`);
      now += 901_000;
      flushSync(() => window.dispatchEvent(new Event('focus'))); await waitFor(guest);
      check(!container.textContent?.includes(user.email) && !document.querySelector('header a[href="/profile"]') && JSON.stringify(cart) === snapshot, `${path} expiry removes private data/navigation and preserves cart`);
      holdMe = true; const pending = startLogin(); await waitFor(() => Boolean(document.querySelector('main [role="status"]')));
      check(document.querySelector('main [role="status"]')?.textContent === 'Confirming your account…' && !details(), `${path} pending authentication keeps private fields hidden`);
      holdMe = false; releaseMe(); await pending; await waitFor(details);
    }
    role = 'ADMIN'; await render('/profile'); await waitFor(details);
    check(document.querySelectorAll('main dd').length === 2 && ![...document.querySelectorAll('main dd')].some((node) => node.textContent === 'Admin'), 'Profile hides the verified ADMIN role');
  }
  check(forbiddenWrites === 0, 'Profile invokes no account update, order, checkout or payment write');
  check(authCalls > 0 || params.get('reload') === 'after', 'Authenticated evidence uses isolated mocked login only');
  flushSync(() => root.unmount()); Date.now = originalNow;
  window.parent.postMessage({ kind: 'profile-result', checks }, location.origin);
  container.textContent = `Profile checks passed. ${checks.length} assertions.`;
}
async function parent() {
  const cases = [...[320, 375, 768, 1440].map((size) => ({ size, path: '' })), ...['profile', 'account'].map((path) => ({ size: 320, path }))];
  for (const { size, path } of cases) {
    const frame = document.createElement('iframe'); frame.title = `Profile ${path || size}`;
    frame.style.cssText = `display:block;width:${size}px;height:950px;border:0;max-width:none`;
    frame.src = `/tests/profile.html?width=${size}${path ? `&reload=before&path=${path}` : ''}`;
    const result = new Promise<{ checks: string[]; error?: string }>((resolve, reject) => {
      const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error(`${size}px ${path} timed out`)); }, 30000);
      function receive(event: MessageEvent) {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.kind !== 'profile-result') return;
        clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data);
      }
      window.addEventListener('message', receive);
    });
    container.append(frame);
    const report = await result;
    if (report.error) throw new Error(`${size}px ${path}: ${report.error}`);
    checks.push(`${path ? `${path} reload` : `${size}px`}: ${report.checks.length} assertions`); frame.remove();
  }
  container.textContent = `Profile checks passed. ${checks.join(' · ')}. All API/storage behavior mocked; actual App and providers.`;
}
void (width ? child() : parent()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown fixture error';
  container.textContent = `Profile checks failed: ${message}`;
  if (width) window.parent.postMessage({ kind: 'profile-result', checks, error: message }, location.origin);
});
