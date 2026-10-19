import { Link } from 'react-router';
import { ProductGrid } from '../components/ProductGrid';

export function ProductsPage() {
  return (
    <section aria-labelledby="catalog-heading" className="page-width pb-20 pt-10 lg:pb-28 lg:pt-16">
      <nav aria-label="Breadcrumb" className="mb-9 flex gap-3 text-xs text-muted"><Link className="nav-link" to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">All products</span></nav>
      <div className="mb-12 flex flex-col justify-between gap-5 border-b border-line pb-9 md:flex-row md:items-end">
        <div>
          <h1 id="catalog-heading" className="section-title">The everyday collection.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">Explore our first twelve finds, from everyday essentials to pieces for your space.</p>
        </div>
        <p className="max-w-xs text-xs leading-5 text-muted">Live sample data from DummyJSON. This is a graduation project; purchases are not available.</p>
      </div>
      <h2 className="sr-only">Products</h2>
      <ProductGrid />
    </section>
  );
}
