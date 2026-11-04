type RouteLocation = { pathname: string; search: string; hash: string };
export type ScrollIntent = 'preserve' | 'top' | 'results' | 'anchor' | 'restore';

export function scrollIntent(previous: RouteLocation | null, next: RouteLocation, navigation: string, saved: boolean): ScrollIntent {
  if (navigation === 'POP' && saved) return 'restore';
  if (next.hash) return 'anchor';
  if (!previous || previous.pathname !== next.pathname) return 'top';
  if (next.pathname === '/products') {
    const before = new URLSearchParams(previous.search);
    const after = new URLSearchParams(next.search);
    const sameFilters = ['q', 'category', 'sort'].every((key) => before.get(key) === after.get(key));
    if (sameFilters && (before.get('page') ?? '1') !== (after.get('page') ?? '1')) return 'results';
  }
  return 'preserve';
}

export function focusScrollTarget(target: HTMLElement): () => void {
  let temporary = !target.hasAttribute('tabindex') && target.tabIndex < 0
    && !target.isContentEditable && !target.matches('input, button, select, textarea, a[href], area[href], summary, iframe');
  if (temporary) target.setAttribute('tabindex', '-1');
  function release() {
    if (!temporary) return;
    temporary = false;
    target.removeEventListener('blur', release);
    if (target.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex');
  }
  if (temporary) target.addEventListener('blur', release, { once: true });
  target.focus({ preventScroll: true });
  return release;
}
