import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Footer } from './Footer';
import { Header } from './Header';
import { useCart } from '../cart/CartContext';

export function Layout() {
  const { pathname, hash } = useLocation();
  const { persistenceError } = useCart();

  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header />
      {persistenceError && <p role="status" className="page-width border-b border-line py-4 text-sm text-muted">Your bag works for this visit, but this browser can’t save it. Refreshing may clear your items.</p>}
      <main id="main-content" tabIndex={-1}><Outlet /></main>
      <Footer />
    </>
  );
}
