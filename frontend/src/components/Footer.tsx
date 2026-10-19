import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="page-width flex flex-col justify-between gap-10 py-12 md:flex-row md:items-start">
        <div>
          <Link to="/" className="wordmark" aria-label="10X Shop home">10X<span className="ml-2 font-normal">SHOP</span><span className="text-accent">.</span></Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">A considered collection for the everyday.</p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
          <Link className="nav-link" to="/products">All products</Link>
          <a className="nav-link" href="/#collections">Collections</a>
          <a className="nav-link" href="/#featured">The selected edit</a>
          <a className="nav-link" href="/#perspective">Our perspective</a>
        </nav>
      </div>
      <div className="page-width flex flex-col justify-between gap-3 border-t border-line py-6 text-xs leading-5 text-muted sm:flex-row">
        <p>© {new Date().getFullYear()} 10X Shop · Graduation project</p>
        <p>Sample catalog from DummyJSON. Checkout is not available.</p>
      </div>
    </footer>
  );
}
