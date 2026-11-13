// Isolated display fixtures: controlled clocks, no authentication or order requests.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import type { Order } from '../src/api/orders';
import { OrderDetails, OrderHistory } from '../src/pages/OrdersPage';
import '../src/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing fixture root');
const root = createRoot(container);
const checks: string[] = [];
function check(value: unknown, message: string): void {
  if (!value) throw new Error(message);
  checks.push(message);
}

async function run() {
  const start = Date.parse('2026-11-09T10:00:00Z');
  let now = start;
  let nextId = 0;
  let cleared = 0;
  let requests = 0;
  const timers = new Map<number, { callback: () => void; due: number; period: number }>();
  const originalNow = Date.now;
  const originalInterval = window.setInterval;
  const originalClear = window.clearInterval;
  const originalFetch = window.fetch;
  const order: Order = { id: '00000000-0000-4000-8000-000000000001', status: 'PENDING_PAYMENT', currency: 'USD',
    totalCents: 1250, createdAt: new Date(start).toISOString(), updatedAt: new Date(start).toISOString(),
    items: [{ id: '00000000-0000-4000-8000-000000000100', productId: 1, title: 'Recorded selection', quantity: 1, unitPriceCents: 1250, lineTotalCents: 1250 }] };
  Object.freeze(order);
  function render(view: ReactNode) {
    flushSync(() => root.render(<MemoryRouter><div className="page-width py-10">{view}</div></MemoryRouter>));
  }
  function advance(ms: number) {
    const target = now + ms;
    while (timers.size && Math.min(...[...timers.values()].map((timer) => timer.due)) <= target) {
      now = Math.min(...[...timers.values()].map((timer) => timer.due));
      flushSync(() => {
        for (const timer of timers.values()) {
          if (timer.due === now) { timer.due += timer.period; timer.callback(); }
        }
      });
    }
    now = target;
  }
  try {
    Date.now = () => now;
    window.setInterval = ((handler: TimerHandler, period?: number) => {
      if (typeof handler !== 'function' || period !== 30_000) throw new Error('Unexpected interval');
      check(true, 'Refresh uses a 30-second function interval');
      const id = ++nextId;
      timers.set(id, { callback: handler as () => void, due: now + period, period });
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = (id: unknown) => { if (typeof id === 'number' && timers.delete(id)) cleared += 1; };
    window.fetch = async () => { requests += 1; throw new Error('All network requests are forbidden in this display fixture'); };

    render(<OrderHistory orders={[]} />);
    check(timers.size === 0 && container!.textContent?.includes('You have no orders yet.'), 'Empty history starts no interval');
    render(<OrderHistory orders={[order, { ...order, id: '00000000-0000-4000-8000-000000000002' }]} />);
    check(timers.size === 1, 'Two history rows share one interval');
    check(container!.querySelectorAll('[aria-label="Sample delivery status: Processing"]').length === 2, 'Each history row includes the demo qualifier and current value in its accessible name');
    check(container!.textContent?.includes('Sample: Processing') && container!.textContent.includes('Pending payment · unpaid'), 'Initial history separates demo Processing from actual unpaid status');
    const focusedLink = container!.querySelector<HTMLAnchorElement>('a')!;
    focusedLink.focus();
    advance(59_999);
    check(container!.textContent?.includes('Sample: Processing'), 'History does not advance before 60 seconds');
    advance(1);
    check(container!.textContent?.includes('Sample: Shipped'), 'The 30-second refresh updates history without reload');
    check(document.activeElement === focusedLink, 'Refresh preserves keyboard focus');
    advance(120_000);
    check(container!.textContent?.includes('Sample: Shipped'), 'History remains demo Shipped at exactly 180 seconds');
    advance(30_000);
    check(container!.textContent?.includes('Sample: Delivered'), 'History advances to demo Delivered on the next tick');

    now = start;
    render(<OrderDetails order={order} />);
    check(cleared === 1 && timers.size === 1, 'Switching to details cleans up history before creating one detail interval');
    check(container!.textContent?.includes('Sample delivery timeline') && container!.textContent.includes('This is a sample order'), 'Details prominently label the academic timeline');
    check(container!.querySelector('[aria-current="step"]')?.textContent?.includes('Sample: Processing'), 'Timeline exposes the current Processing step semantically');
    advance(60_000);
    check(container!.querySelector('[aria-current="step"]')?.textContent?.includes('Sample: Shipped'), 'Details update the current demo stage at 60 seconds');
    check(container!.textContent?.includes('Completed in sample') && container!.textContent.includes('Upcoming in sample'), 'Timeline explains completed and upcoming stages in text');
    advance(120_000);
    check(container!.querySelector('[aria-current="step"]')?.textContent?.includes('Sample: Shipped'), 'Detail timeline keeps 180 seconds inclusive');
    advance(30_000);
    check(container!.querySelector('[aria-current="step"]')?.textContent?.includes('Sample: Delivered'), 'Detail timeline advances after 180 seconds');
    check(container!.textContent?.includes('Pending payment · unpaid') && order.status === 'PENDING_PAYMENT', 'Actual status remains visible and the order snapshot is unchanged');
    check(container!.textContent?.includes('no items will ship') && container!.textContent.includes('or be reserved'), 'Demo never claims real delivery or reservation');
    check(document.documentElement.scrollWidth <= innerWidth, 'Timeline does not overflow the viewport');
    const steps = [...container!.querySelectorAll('ol li')].map((step) => step.getBoundingClientRect());
    check(steps.length === 3 && steps.every((step) => step.left >= 0 && step.right <= innerWidth), 'All timeline stages fit the viewport');
    check(innerWidth < 640 ? steps[0].top < steps[1].top && steps[1].top < steps[2].top : steps[0].left < steps[1].left && steps[1].left < steps[2].left, 'Timeline stacks on narrow screens and forms a row on desktop');
    render(<OrderHistory orders={[]} />);
    check(timers.size === 0 && cleared === 2, 'Unmounting detail clears its interval and empty history starts none');
    advance(300_000);
    check(timers.size === 0 && requests === 0, 'Unmount leaves no callbacks, API reads, status updates or order writes');
  } finally {
    flushSync(() => root.unmount());
    Date.now = originalNow;
    window.setInterval = originalInterval;
    window.clearInterval = originalClear;
    window.fetch = originalFetch;
  }
  container!.textContent = `Academic status checks passed. ${checks.length} assertions. Controlled clocks and order snapshots only; no network requests.`;
}
void run().catch((error: unknown) => {
  container!.textContent = `Academic status checks failed: ${error instanceof Error ? error.message : 'Unknown failure'}`;
});
