import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement, isValidElement } from 'react';
import { renderToStaticMarkup, renderToString, renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { createServer } from 'vite';

// Use the installed Vite transformer for TSX; no DOM/test library or listening server.
const server = await createServer({
  configFile: false, root: new URL('../', import.meta.url).pathname,
  server: { middlewareMode: true, watch: null, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] }, esbuild: { jsx: 'automatic' },
});
after(() => server.close());
const { ErrorBoundary } = await server.ssrLoadModule('/src/components/ErrorBoundary.tsx');
const { PageLoading } = await server.ssrLoadModule('/src/components/PageLoading.tsx');

function findElement(element, type) {
  if (!isValidElement(element)) return undefined;
  if (element.type === type) return element;
  const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
  return children.map((child) => findElement(child, type)).find(Boolean);
}

test('boundary leaves healthy children intact and renders a safe accessible fallback after an error', () => {
  const boundary = new ErrorBoundary({ children: createElement('p', null, 'Healthy page') });
  assert.equal(renderToStaticMarkup(boundary.render()), '<p>Healthy page</p>');
  boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('private diagnostic'));
  const markup = renderToStaticMarkup(boundary.render());
  assert.match(markup, /role="alert"/);
  assert.match(markup, /A brief interruption/);
  assert.match(markup, /check your order history/);
  assert.doesNotMatch(markup, /private diagnostic|stack|password|token/i);
  assert.equal(findElement(boundary.render(), 'a').props.href, '/');
});

test('componentDidCatch emits only a generic development diagnostic', (context) => {
  const diagnostic = context.mock.method(console, 'error', () => {});
  const boundary = new ErrorBoundary({ children: null });
  boundary.componentDidCatch(new Error('PRIVATE_PASSWORD_OR_TOKEN'), { componentStack: 'PRIVATE_STACK' });
  assert.deepEqual(diagnostic.mock.calls.map((call) => call.arguments), [
    ['10X Shop caught an unexpected rendering error.'],
  ]);
});

test('componentDidCatch stays silent in production', async (context) => {
  const production = await createServer({
    configFile: false, root: new URL('../', import.meta.url).pathname, mode: 'production',
    // A development SSR server already exists in this process; model the build's DEV constant explicitly.
    define: { 'import.meta.env.DEV': false },
    server: { middlewareMode: true, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, esbuild: { jsx: 'automatic' },
  });
  try {
    const { ErrorBoundary: ProductionBoundary } = await production.ssrLoadModule('/src/components/ErrorBoundary.tsx');
    const diagnostic = context.mock.method(console, 'error', () => {});
    new ProductionBoundary({ children: null }).componentDidCatch();
    assert.equal(diagnostic.mock.callCount(), 0);
  } finally {
    await production.close();
  }
});

test('boundary recovery reloads once without replaying a request or changing storage', (context) => {
  const reload = context.mock.fn();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { reload } } });
  context.after(() => { delete globalThis.window; });
  const boundary = new ErrorBoundary({ children: null });
  boundary.state = ErrorBoundary.getDerivedStateFromError();
  const button = findElement(boundary.render(), 'button');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props.children, 'Reload application');
  button.props.onClick();
  assert.equal(reload.mock.callCount(), 1);
});

test('shared route loading fallback announces loading without an animated spinner', () => {
  const markup = renderToStaticMarkup(createElement(PageLoading));
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /Loading your page/);
});

test('pagination exposes one current page, real URL links and disabled boundary controls', async () => {
  const { Pagination } = await server.ssrLoadModule('/src/components/Pagination.tsx');
  const { MemoryRouter } = await import('react-router');
  const render = (query, totalPages) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/products'] }, createElement(Pagination, { query, totalPages })));
  for (const mode of [{ q: 'EYE', category: '' }, { q: '', category: 'beauty' }]) {
    const query = { ...mode, sort: 'title-asc', page: 2 };
    const html = render(query, 4);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, /aria-label="Page 2, current page"/);
    assert.match(html, /aria-label="Page 3"/);
    assert.match(html, new RegExp(`href="/products\\?${mode.q ? 'q=EYE' : 'category=beauty'}&amp;sort=title-asc&amp;page=3"`));
  }
  const query = { q: '', category: '', sort: 'default', page: 1 };
  assert.match(render(query, 2), /aria-disabled="true">Previous/);
  assert.doesNotMatch(render(query, 2), /rel="prev"/);
  assert.match(render({ ...query, page: 2 }, 2), /aria-disabled="true">Next/);
  assert.doesNotMatch(render({ ...query, page: 2 }, 2), /rel="next"/);
  assert.doesNotMatch(render(query, 1), /<a\b/);
});

test('product detail return links use validated catalog state and safely handle missing or invalid state', async () => {
  const { ProductDetailsPage } = await server.ssrLoadModule('/src/pages/ProductDetailsPage.tsx');
  const { MemoryRouter, Routes, Route } = await import('react-router');
  for (const [state, expected] of [
    [null, '/products'], ['invalid', '/products'], [{}, '/products'],
    [{ catalogReturnTo: 'https://evil.example/products' }, '/products'],
    [{ catalogReturnTo: { pathname: '/products' } }, '/products'],
    [{ catalogReturnTo: '/cart' }, '/products'],
    [{ catalogReturnTo: '/products?q=EYE&sort=title-asc&page=2' }, '/products?q=EYE&sort=title-asc&page=2'],
    [{ catalogReturnTo: '/products?category=groceries&page=3' }, '/products?category=groceries&page=3'],
  ]) {
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [{ pathname: '/products/5', state }] },
      createElement(Routes, null, createElement(Route, { path: '/products/:id', element: createElement(ProductDetailsPage) }))));
    const back = html.match(/<a[^>]*href="([^"]*)"[^>]*>Back to all products<\/a>/);
    assert.equal(back?.[1], expected.replaceAll('&', '&amp;'));
  }
});

test('guest header has one login before the bag and keeps registration on the auth page', async () => {
  const { Header } = await server.ssrLoadModule('/src/components/Header.tsx');
  const { AuthProvider } = await server.ssrLoadModule('/src/auth/AuthContext.tsx');
  const { CartProvider } = await server.ssrLoadModule('/src/cart/CartContext.tsx');
  const { MemoryRouter } = await import('react-router');
  const html = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(AuthProvider, null, createElement(CartProvider, null, createElement(Header)))));
  assert.equal((html.match(/href="\/login"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /href="\/register"/);
  assert.doesNotMatch(html, /href="\/orders"/);
  assert.ok(html.indexOf('aria-label="Search products"') < html.indexOf('href="/login"'));
  assert.ok(html.indexOf('href="/login"') < html.indexOf('href="/cart"'));
  assert.match(html, /Log in/);
});

test('order history uses the exact empty wording and the existing catalog destination', async () => {
  const { OrderHistory } = await server.ssrLoadModule('/src/pages/OrdersPage.tsx');
  const { MemoryRouter } = await import('react-router');
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(OrderHistory, { orders: [] })));
  assert.match(html, />You have no orders yet\.</);
  assert.match(html, /href="\/products"[^>]*>Browse products<\/a>/);
  assert.doesNotMatch(html, /Pending payment|Processing|Shipped|Delivered|#10X-/);
});

test('order history preserves server order, UUIDs, quantities, historical amounts and unpaid status', async () => {
  const { OrderHistory } = await server.ssrLoadModule('/src/pages/OrdersPage.tsx');
  const { MemoryRouter } = await import('react-router');
  const item = { id: '00000000-0000-4000-8000-000000000100', productId: 1, title: 'Recorded selection', quantity: 2, unitPriceCents: 1234, lineTotalCents: 2468 };
  const newer = { id: '00000000-0000-4000-8000-000000000002', status: 'PENDING_PAYMENT', currency: 'USD', totalCents: 2468, createdAt: '2026-11-08T10:00:00Z', updatedAt: '2026-11-08T10:00:00Z', items: [item] };
  const older = { ...newer, id: '00000000-0000-4000-8000-000000000001', createdAt: '2026-11-07T10:00:00Z', items: [{ ...item, quantity: 1, lineTotalCents: 1234 }], totalCents: 1234 };
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(OrderHistory, { orders: [newer, older] })));
  assert.ok(html.indexOf(newer.id) < html.indexOf(older.id));
  for (const order of [newer, older]) assert.match(html, new RegExp(`href="/orders/${order.id}"`));
  assert.match(html, /<dt[^>]*>Date<\/dt>/);
  assert.match(html, /dateTime="2026-11-08T10:00:00Z"/);
  assert.match(html, /<dt[^>]*>Items<\/dt>/);
  assert.match(html, /2 units/);
  assert.match(html, /1 unit</);
  assert.match(html, /Total/);
  assert.match(html, /\$24\.68/);
  assert.match(html, /\$12\.34/);
  assert.equal((html.match(/Pending payment · unpaid/g) ?? []).length, 2);
  assert.match(html, /No payment has been taken/);
  assert.match(html, /No shipping or stock reservation is arranged/);
  assert.doesNotMatch(html, /Processing|Shipped|Delivered|#10X-/);
});

test('real lazy route preserves the shell while pending and resolves to the protected guest view', async () => {
  const { App } = await server.ssrLoadModule('/src/App.tsx');
  const { AuthProvider } = await server.ssrLoadModule('/src/auth/AuthContext.tsx');
  const { CartProvider } = await server.ssrLoadModule('/src/cart/CartContext.tsx');
  const { MemoryRouter } = await import('react-router');
  const tree = createElement(MemoryRouter, { initialEntries: ['/orders'] },
    createElement(AuthProvider, null, createElement(CartProvider, null, createElement(App))));
  const pending = renderToString(tree);
  assert.match(pending, /Loading your page/);
  assert.match(pending, /Shopping bag/);
  assert.match(pending, /Footer navigation/);
  const resolved = await new Promise((resolve, reject) => {
    const output = new PassThrough();
    let html = '';
    output.on('data', (chunk) => { html += chunk; });
    output.on('end', () => resolve(html));
    output.on('error', reject);
    const stream = renderToPipeableStream(tree, {
      onAllReady() { stream.pipe(output); }, onError: reject,
    });
  });
  assert.doesNotMatch(resolved, /Loading your page/);
  assert.match(resolved, /Sign in/);
  assert.match(resolved, /returnTo/);
});
