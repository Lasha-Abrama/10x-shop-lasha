import { useId } from 'react';
import { DEMO_STAGES, getDemoOrderStatus } from '../orders/status';
import type { DemoOrderStatus } from '../orders/status';

const badgeStyles: Record<DemoOrderStatus, string> = {
  Processing: 'border-line bg-surface text-ink',
  Shipped: 'border-blue-200 bg-blue-50 text-blue-800',
  Delivered: 'border-green-200 bg-green-50 text-green-800',
};

export function SimulationDisclosure() {
  return <p className="max-w-2xl text-sm leading-6">Academic simulation only. No payment is processed, no actual shipping or delivery occurs, and no inventory is reserved.</p>;
}

export function DemoFulfillmentBadge({ createdAt, now }: { createdAt: string; now: number }) {
  const status = getDemoOrderStatus(createdAt, now);
  return <span role="status" aria-label={`Demo fulfillment status: ${status ?? 'Unavailable'}`} aria-atomic="true" className={`inline-flex rounded-full border px-3 py-1 text-xs ${status ? badgeStyles[status] : 'border-line bg-surface text-ink'}`}>Demo: {status ?? 'Unavailable'}</span>;
}

export function DemoFulfillmentTimeline({ createdAt, now }: { createdAt: string; now: number }) {
  const headingId = useId();
  const status = getDemoOrderStatus(createdAt, now);
  const current = status ? DEMO_STAGES.indexOf(status) : -1;
  return <section aria-labelledby={headingId} className="mt-10 border-y border-line py-8">
    <h2 id={headingId} className="font-display text-3xl">Simulated fulfillment timeline</h2>
    <div className="mt-4"><SimulationDisclosure /></div>
    <div className="mt-5"><DemoFulfillmentBadge createdAt={createdAt} now={now} /></div>
    {!status && <p className="mt-3 text-sm text-muted">Simulation unavailable: the order date is invalid or ahead of this device’s clock.</p>}
    <ol className="mt-6 grid gap-4 sm:grid-cols-3">
      {DEMO_STAGES.map((stage, index) => <li key={stage} aria-current={index === current ? 'step' : undefined} className="border border-line p-4">
        <p className="font-medium">Demo: {stage}</p>
        <p className="mt-2 text-sm text-muted">{index < current ? 'Completed in simulation' : index === current ? 'Current demo stage' : 'Upcoming in simulation'}</p>
      </li>)}
    </ol>
  </section>;
}
