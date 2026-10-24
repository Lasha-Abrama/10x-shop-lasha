import { useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
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
  const { itemCount } = getCartTotals(state);
  const location = useLocation();
  function isCurrent(href: string) {
    return href === '/products' ? location.pathname === '/products'
      : `${location.pathname}${location.hash}` === href;
  }

  return (
    <header className="border-b border-line bg-paper">
      <div className="page-width flex min-h-24 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
        <Link to="/" aria-label="10X Shop home" className="wordmark" onClick={() => setMenuOpen(false)}>
          10X<span className="ml-2 font-normal">SHOP</span><span className="text-accent">.</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm xl:flex">
          {navigation.map((item) => <Link key={item.href} className={`nav-link ${isCurrent(item.href) ? 'underline underline-offset-4' : ''}`} aria-current={isCurrent(item.href) ? 'page' : undefined} to={item.href}>{item.label}</Link>)}
        </nav>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden md:block"><AccountNavigation onNavigate={() => setMenuOpen(false)} /></div>
          <Link to="/products#catalog-search" onClick={() => setMenuOpen(false)} className="nav-link inline-flex min-h-11 items-center gap-1.5 text-sm" aria-label="Search products">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            <span className="hidden sm:inline">Search</span>
          </Link>
          <NavLink to="/cart" onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link inline-flex min-h-11 items-center gap-1.5 text-sm ${isActive ? 'underline underline-offset-4' : ''}`} aria-label={`Shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></svg>
            <span className="hidden sm:inline">Bag</span>
            <span className="min-w-4 text-center text-xs tabular-nums" aria-live="polite" aria-atomic="true">{itemCount}</span>
          </NavLink>
          <button ref={menuButton} type="button" className="nav-link min-h-11 px-1 text-sm xl:hidden" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav id="mobile-navigation" aria-label="Mobile navigation" hidden={!menuOpen} className="w-full border-t border-line pt-3 xl:hidden" onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}>
          {navigation.map((item) => <Link key={item.href} to={item.href} onClick={() => setMenuOpen(false)} aria-current={isCurrent(item.href) ? 'page' : undefined} className={`nav-link block py-3 text-base ${isCurrent(item.href) ? 'underline underline-offset-4' : ''}`}>{item.label}</Link>)}
          <div className="mt-3 border-t border-line py-3 md:hidden"><AccountNavigation onNavigate={() => setMenuOpen(false)} /></div>
        </nav>
      </div>
    </header>
  );
}

function AccountNavigation({ onNavigate }: { onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
    {user ? <>
      <Link to="/account" onClick={onNavigate} className="nav-link inline-flex min-h-11 max-w-44 items-center" aria-label={`My account, ${user.email}`}><span className="truncate">{user.email}</span></Link>
      <button type="button" className="nav-link min-h-11" onClick={() => { logout(); onNavigate(); void navigate('/products'); }}>Logout</button>
    </> : <>
      <Link to="/login" onClick={onNavigate} className="nav-link inline-flex min-h-11 items-center">Login</Link>
      <Link to="/register" onClick={onNavigate} className="nav-link inline-flex min-h-11 items-center">Create account</Link>
    </>}
  </div>;
}
