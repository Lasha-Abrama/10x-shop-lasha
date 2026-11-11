import { isOrderId } from '../api/orders.ts';

// Never accept an external URL, arbitrary path, query string, or hash as a post-login destination.
export function safeReturnTo(value: string | null): string {
  if (value === '/products' || value === '/checkout' || value === '/orders' || value === '/account' || value === '/profile') return value;
  if (value?.startsWith('/orders/') && isOrderId(value.slice('/orders/'.length))) return value;
  return '/products';
}

export function authPath(mode: 'login' | 'register', destination: string): string {
  const safe = safeReturnTo(destination);
  return `/${mode}${safe === '/products' ? '' : `?returnTo=${encodeURIComponent(safe)}`}`;
}
