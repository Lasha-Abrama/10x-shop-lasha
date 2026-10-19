import { Outlet } from 'react-router';
import { Footer } from './Footer';
import { Header } from './Header';

export function Layout() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header />
      <main id="main-content" tabIndex={-1}><Outlet /></main>
      <Footer />
    </>
  );
}
