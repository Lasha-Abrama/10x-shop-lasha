import type { Order } from '../api/orders';

export const actualOrderStatusLabels: Record<Order['status'], string> = { PENDING_PAYMENT: 'Pending payment · unpaid' };
export const DEMO_STAGES = ['Processing', 'Shipped', 'Delivered'] as const;
export type DemoOrderStatus = typeof DEMO_STAGES[number];

export function getDemoOrderStatus(createdAt: string, now: number): DemoOrderStatus | null {
  const placedAt = Date.parse(createdAt);
  if (!Number.isFinite(placedAt) || !Number.isFinite(now) || placedAt > now) return null;
  const elapsed = now - placedAt;
  if (elapsed < 60_000) return 'Processing';
  if (elapsed <= 180_000) return 'Shipped';
  return 'Delivered';
}
