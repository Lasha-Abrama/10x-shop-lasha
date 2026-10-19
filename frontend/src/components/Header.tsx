import { useRef, useState } from 'react';
import { Link } from 'react-router';

const navigation = [
  { label: 'Collections', href: '/#collections' },
  { label: 'The selected edit', href: '/#featured' },
  { label: 'Our perspective', href: '/#perspective' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <header className="border-b border-line bg-paper">
      <div className="page-width flex min-h-24 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
        <Link to="/" aria-label="10X Shop home" className="wordmark" onClick={() => setMenuOpen(false)}>
          10X<span className="ml-2 font-normal">SHOP</span><span className="text-accent">.</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm lg:flex">
          {navigation.map((item) => <a key={item.href} className="nav-link" href={item.href}>{item.label}</a>)}
        </nav>
        <div className="flex items-center gap-4 sm:gap-6">
          <button type="button" disabled className="future-action" aria-label="Search — coming soon" title="Search is coming soon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            <span className="hidden sm:inline">Search</span>
            <span className="soon-label">Soon</span>
          </button>
          <button type="button" disabled className="future-action" aria-label="Shopping bag — coming soon" title="Shopping bag is coming soon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></svg>
            <span className="hidden sm:inline">Bag</span>
            <span className="soon-label">Soon</span>
          </button>
          <button ref={menuButton} type="button" className="nav-link min-h-11 px-1 text-sm lg:hidden" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav id="mobile-navigation" aria-label="Mobile navigation" hidden={!menuOpen} className="w-full border-t border-line pt-3 lg:hidden" onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}>
          {navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="nav-link block py-3 text-base">{item.label}</a>)}
        </nav>
      </div>
    </header>
  );
}
