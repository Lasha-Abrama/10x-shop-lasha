import { memo, useEffect, useState } from 'react';
import { getProducts } from '../api/products';
import type { Product, ProductsResponse } from '../api/products';
import { ProductCard } from './ProductCard';

type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: ProductsResponse };

export function FeaturedProducts() {
  const limit = 3;
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    getProducts(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ status: 'success', data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setState({
          status: 'error',
          message: error instanceof TypeError
            ? 'We couldn’t connect to the catalog. Check your connection and try again.'
            : error instanceof Error ? error.message : 'We couldn’t load the products. Please try again.',
        });
      }
    });

    return () => controller.abort();
  }, [attempt]);

  if (state.status === 'loading') {
    return <div role="status" className="flex min-h-64 items-center justify-center text-sm text-muted">Loading the collection…</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="border-y border-line py-12">
        <div role="alert">
          <h3 className="font-display text-3xl">A brief pause.</h3>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted">{state.message}</p>
        </div>
        <button type="button" className="primary-link mt-6" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1); }}>Try again</button>
      </div>
    );
  }

  if (state.data.products.length === 0) {
    return <div role="status" className="border-y border-line py-12"><h3 className="font-display text-3xl">Nothing here just yet.</h3><p className="mt-3 text-sm leading-6 text-muted">The catalog has no products to display. Please check back later.</p></div>;
  }

  const products = state.data.products.slice(0, limit);

  return (
    <>
      <p role="status" className="mb-7 text-xs text-muted">Showing {products.length} of {state.data.total} sample products · Prices in USD</p>
      <ProductGrid products={products} featured />
    </>
  );
}

// Search drafts rerender the catalog while its current product array stays unchanged.
export const ProductGrid = memo(function ProductGrid({ products, featured = false }: { products: Product[]; featured?: boolean }) {
  return <div className={`grid gap-x-7 gap-y-10 ${featured ? 'sm:grid-cols-3' : 'min-[481px]:grid-cols-2 min-[768px]:grid-cols-3 min-[1025px]:grid-cols-4'}`}>
    {products.map((product) => <ProductCard key={product.id} product={product} />)}
  </div>;
});
