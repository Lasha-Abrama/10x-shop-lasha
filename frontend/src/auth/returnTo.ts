import { isOrderId } from '../api/orders.ts';

// Never accept an external URL, arbitrary path, query string, or hash as a post-login destination.
export function safeReturnTo(value: string | null): string {
  if (value === '/checkout' || value === '/orders' || value === '/account') return value;
  if (value?.startsWith('/orders/') && isOrderId(value.slice('/orders/'.length))) return value;
  return '/account';
}

export function authPath(mode: 'login' | 'register', destination: string): string {
  const safe = safeReturnTo(destination);
  return `/${mode}${safe === '/account' ? '' : `?returnTo=${encodeURIComponent(safe)}`}`;
}
