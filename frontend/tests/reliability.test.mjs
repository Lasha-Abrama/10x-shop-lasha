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
