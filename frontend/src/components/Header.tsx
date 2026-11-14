import { useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useCart } from '../cart/CartContext';
import { getCartTotals } from '../cart/cart';
import { useAuth } from '../auth/AuthContext';

const navigation = [
  { label: 'All products', href: '/products' },
  { label: 'Collections', href: '/#collections' },
  { label: 'The selected edit', href: '/#featured' },
  { label: 'Our perspective', href: '/#perspective' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { state } = useCart();
  const { user } = useAuth();
  const links = user ? [...navigation, { label: 'Orders', href: '/orders' }] : navigation;
  const { itemCount } = getCartTotals(state);
  const location = useLocation();
  const accountPath = user ? '/profile' : '/login';
  const accountActive = location.pathname === accountPath || Boolean(user && location.pathname === '/account');
  function isCurrent(href: string) {
    if (href === '/orders') return location.pathname === href || location.pathname.startsWith('/orders/');
    return href === '/products' ? location.pathname === '/products'
      : `${location.pathname}${location.hash}` === href;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper" onKeyDown={(event) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }}>
      <div className="page-width grid items-center gap-x-6 gap-y-2 py-4 min-[480px]:grid-cols-[auto_1fr] xl:grid-cols-[auto_1fr_auto]">
        <Link to="/" aria-label="10X Shop home" className="wordmark justify-self-start" onClick={() => setMenuOpen(false)}>
          10X<span className="ml-2 font-normal">SHOP</span><span className="text-accent">.</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center justify-self-center gap-6 text-sm xl:flex">
          {links.map((item) => <Link key={item.href} className={`nav-link touch-target ${isCurrent(item.href) ? 'underline underline-offset-4' : ''}`} aria-current={isCurrent(item.href) ? 'page' : undefined} to={item.href}>{item.label}</Link>)}
        </nav>
        <div className="flex items-center justify-between gap-1 min-[480px]:justify-self-end sm:gap-4">
          <Link to="/products#catalog-search" onClick={() => setMenuOpen(false)} className="nav-link touch-target justify-center gap-1.5 text-sm" aria-label="Search products">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            <span className="hidden sm:inline">Search</span>
          </Link>
          <NavLink to="/cart" onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link touch-target justify-center gap-1.5 text-sm ${isActive ? 'underline underline-offset-4' : ''}`} aria-label={`Shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></svg>
            <span className="hidden sm:inline">Bag</span>
            {itemCount > 0 && <span className="min-w-4 text-center text-xs tabular-nums" aria-live="polite" aria-atomic="true">{itemCount}</span>}
          </NavLink>
          <Link to={accountPath} onClick={() => setMenuOpen(false)} aria-current={accountActive ? 'page' : undefined} className={`nav-link touch-target justify-center gap-1.5 px-1 text-sm ${accountActive ? 'underline underline-offset-4' : ''}`}>
            <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>
            {user ? 'Profile' : 'Log in'}
          </Link>
          <button ref={menuButton} type="button" className="nav-link touch-target justify-center px-1 text-sm xl:hidden" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav id="mobile-navigation" aria-label="Mobile navigation" hidden={!menuOpen} className="col-span-full max-h-[50dvh] w-full overflow-y-auto border-t border-line pt-3 xl:hidden">
          {links.map((item) => <Link key={item.href} to={item.href} onClick={() => setMenuOpen(false)} aria-current={isCurrent(item.href) ? 'page' : undefined} className={`nav-link touch-target block py-3 text-base ${isCurrent(item.href) ? 'underline underline-offset-4' : ''}`}>{item.label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
