import { useId } from 'react';
import { DEMO_STAGES, getDemoOrderStatus } from '../orders/status';
import type { DemoOrderStatus } from '../orders/status';

const badgeStyles: Record<DemoOrderStatus, string> = {
  Processing: 'border-line bg-surface text-ink',
  Shipped: 'border-blue-200 bg-blue-50 text-blue-800',
  Delivered: 'border-green-200 bg-green-50 text-green-800',
};

export function SimulationDisclosure() {
  return <p className="max-w-2xl text-sm leading-6">This is a sample order. No payment was taken, and no items will ship or be reserved.</p>;
}

export function DemoFulfillmentBadge({ createdAt, now }: { createdAt: string; now: number }) {
  const status = getDemoOrderStatus(createdAt, now);
  return <span role="status" aria-label={`Sample delivery status: ${status ?? 'Unavailable'}`} aria-atomic="true" className={`inline-flex rounded-full border px-3 py-1 text-xs ${status ? badgeStyles[status] : 'border-line bg-surface text-ink'}`}>Sample: {status ?? 'Unavailable'}</span>;
}

export function DemoFulfillmentTimeline({ createdAt, now }: { createdAt: string; now: number }) {
  const headingId = useId();
  const status = getDemoOrderStatus(createdAt, now);
  const current = status ? DEMO_STAGES.indexOf(status) : -1;
  return <section aria-labelledby={headingId} className="mt-10 border-y border-line py-8">
    <h2 id={headingId} className="font-display text-3xl">Sample delivery timeline</h2>
    <div className="mt-4"><SimulationDisclosure /></div>
    <div className="mt-5"><DemoFulfillmentBadge createdAt={createdAt} now={now} /></div>
    {!status && <p className="mt-3 text-sm text-muted">Sample timeline unavailable for this order date.</p>}
    <ol className="mt-6 grid gap-4 sm:grid-cols-3">
      {DEMO_STAGES.map((stage, index) => <li key={stage} aria-current={index === current ? 'step' : undefined} className="border border-line p-4">
        <p className="font-medium">Sample: {stage}</p>
        <p className="mt-2 text-sm text-muted">{index < current ? 'Completed in sample' : index === current ? 'Current sample stage' : 'Upcoming in sample'}</p>
      </li>)}
    </ol>
  </section>;
}
