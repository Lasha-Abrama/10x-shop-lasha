import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Footer } from './Footer';
import { Header } from './Header';
import { ErrorBoundary } from './ErrorBoundary';
import { PageLoading } from './PageLoading';
import { useCart } from '../cart/CartContext';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { pathname, hash } = useLocation();
  const { persistenceError } = useCart();
  const { notice } = useAuth();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header />
      {notice && <p role="status" className="page-width border-b border-line py-4 text-sm text-muted">{notice}</p>}
      {persistenceError && <p role="status" className="page-width border-b border-line py-4 text-sm text-muted">Your bag works for this visit, but this browser can’t save it. Refreshing may clear your items.</p>}
      <main id="main-content" tabIndex={-1}>
        <ErrorBoundary key={pathname}><Suspense fallback={<PageLoading />}><Outlet /></Suspense></ErrorBoundary>
      </main>
      <Footer />
    </>
  );
}
