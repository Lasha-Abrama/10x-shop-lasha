// Development-only browser checks. This entry is not part of the production build.
import { lazy } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { Layout } from '../src/components/Layout';
import { ProductGrid } from '../src/components/ProductGrid';
import { AuthProvider } from '../src/auth/AuthContext';
import { CartProvider } from '../src/cart/CartContext';
import type { Product } from '../src/api/products';
import '../src/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing test root');
const root = createRoot(container, {
  // Expected fixture errors are counted, without logging their contents.
  onCaughtError: () => { caught += 1; },
});
let caught = 0;
const passed: string[] = [];
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed.push(message);
}
function render(children: ReactNode) { flushSync(() => root.render(children)); }
async function waitFor(condition: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for React');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
function Broken(): never { throw new Error('PRIVATE_FIXTURE_DIAGNOSTIC'); }
function Fixture({ children }: { children: ReactNode }) {
  return <MemoryRouter><AuthProvider><CartProvider><Routes><Route element={<Layout />}>
    <Route index element={children} />
    <Route path="cart" element={<h1 className="page-width py-16">Recovered page</h1>} />
  </Route></Routes></CartProvider></AuthProvider></MemoryRouter>;
}

async function run() {
  render(<ErrorBoundary><p>Healthy content</p></ErrorBoundary>);
  check(container?.textContent === 'Healthy content', 'Healthy children render normally');

  render(<Fixture><Broken /></Fixture>);
  check(Boolean(container?.querySelector('[role="alert"]')), 'Render errors show the boundary fallback');
  check(!container?.textContent?.includes('PRIVATE_FIXTURE'), 'Private diagnostics stay out of the UI');
  check(Boolean(container?.querySelector('header')) && Boolean(container?.querySelector('footer')), 'The shared shell survives a route error');
  check(container?.querySelector('button.primary-link')?.textContent === 'Reload application', 'A reload recovery action is available');
  check(caught === 1, 'The expected render error was caught once');

  // A route change resets the inner boundary without remounting shared providers.
  render(<Fixture><p>Changed children</p></Fixture>);
  // The existing boundary retains the error until the pathname changes.
  check(Boolean(container?.querySelector('[role="alert"]')), 'An unchanged failed route retains its fallback');
  // The real header link changes the pathname to /cart; no API or order writes.
  container?.querySelector<HTMLAnchorElement>('a[href="/cart"]')?.click();
  await waitFor(() => !container?.querySelector('[role="alert"]'));
  check(Boolean(container?.textContent?.includes('Recovered page')) && Boolean(container?.querySelector('header')), 'Navigation resets a failed route boundary');

  let resolvePage: (value: { default: () => ReactNode }) => void = () => { throw new Error('Lazy loader was not called'); };
  let loads = 0;
  const Deferred = lazy(() => { loads += 1; return new Promise<{ default: () => ReactNode }>((resolve) => { resolvePage = resolve; }); });
  render(<Fixture key="lazy"><Deferred /></Fixture>);
  check(container?.querySelector('[role="status"]')?.textContent === 'Loading your page…', 'A pending lazy route announces loading');
  check(Boolean(container?.querySelector('header')), 'Navigation remains available while a route loads');
  resolvePage({ default: () => <h1>Lazy page ready</h1> });
  await waitFor(() => Boolean(container?.textContent?.includes('Lazy page ready')));
  render(<Fixture key="lazy"><Deferred /></Fixture>);
  check(loads === 1, 'A resolved lazy module is reused');

  const Rejected = lazy(() => Promise.reject(new Error('PRIVATE_FIXTURE_DIAGNOSTIC')));
  render(<Fixture key="rejected"><Rejected /></Fixture>);
  await waitFor(() => Boolean(container?.querySelector('[role="alert"]')));
  check(!container?.textContent?.includes('PRIVATE_FIXTURE'), 'Rejected lazy imports use the same safe boundary');

  let titleReads = 0;
  const products: Product[] = [{ id: 1, get title() { titleReads += 1; return 'Memo fixture'; }, category: 'beauty', price: 1, thumbnail: '/images/ceramics.jpg' }];
  render(<MemoryRouter><ProductGrid products={products} /><p>Draft one</p></MemoryRouter>);
  const readsAfterMount = titleReads;
  render(<MemoryRouter><ProductGrid products={products} /><p>Draft two</p></MemoryRouter>);
  check(titleReads === readsAfterMount, 'Unchanged product cards skip a parent draft rerender');
  render(<MemoryRouter><ProductGrid products={[{ ...products[0], title: 'Updated product' }]} /></MemoryRouter>);
  check(Boolean(container?.textContent?.includes('Updated product')), 'Changed product data still updates the grid');

  render(<section className="page-width py-16"><h1 className="section-title">Reliability checks passed.</h1><p role="status" className="mt-6">{passed.length} browser assertions passed. No API writes were made.</p><ul className="mt-6 list-disc space-y-2 pl-5">{passed.map((message) => <li key={message}>{message}</li>)}</ul></section>);
}

const mode = new URLSearchParams(location.search).get('case');
if (mode === 'error') render(<Fixture><Broken /></Fixture>);
else if (mode === 'loading') {
  const Pending = lazy(() => new Promise<{ default: () => ReactNode }>(() => {}));
  render(<Fixture><Pending /></Fixture>);
} else void run().catch(() => {
  render(<p role="alert">Reliability checks failed. Inspect the test assertions.</p>);
});
