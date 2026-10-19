import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getProductDetails } from '../api/products';
import type { ProductDetails } from '../api/products';
import { ProductGallery } from '../components/ProductGallery';
import { QuantitySelector } from '../components/QuantitySelector';
import { formatPrice } from '../format';

type DetailsState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'success'; product: ProductDetails };

export function ProductDetailsPage() {
  const { id } = useParams();
  return <ProductDetailsRequest key={id} id={id} />;
}

function ProductDetailsRequest({ id }: { id: string | undefined }) {
  const [state, setState] = useState<DetailsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    getProductDetails(id, controller.signal).then((product) => {
      if (!controller.signal.aborted) setState(product ? { status: 'success', product } : { status: 'not-found' });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof TypeError
        ? 'We couldn’t connect to the catalog. Check your connection and try again.'
        : error instanceof Error ? error.message : 'We couldn’t load this product. Please try again.' });
    });
    return () => controller.abort();
  }, [id, attempt]);

  return (
    <div className="page-width pb-20 pt-10 lg:pb-28 lg:pt-12">
      <nav aria-label="Breadcrumb" className="mb-9 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted">
        <Link to="/" className="nav-link">Home</Link><span aria-hidden="true">/</span>
        <Link to="/products" className="nav-link">All products</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{state.status === 'success' ? state.product.title : state.status === 'not-found' ? 'Product not found' : 'Product details'}</span>
      </nav>
      {state.status === 'loading' && <div role="status" className="min-h-96 py-16"><h1 className="section-title">A closer look.</h1><p className="mt-5 text-sm text-muted">Loading product details…</p></div>}
      {state.status === 'not-found' && <section role="status" className="min-h-80 py-12"><h1 className="section-title">Product not found.</h1><p className="mt-5 max-w-lg text-sm leading-6 text-muted">This product doesn’t exist or is no longer available. There’s more to discover in the collection.</p></section>}
      {state.status === 'error' && <section className="min-h-80 py-12"><div role="alert"><h1 className="section-title">A brief pause.</h1><p className="mt-5 max-w-lg text-sm leading-6 text-muted">{state.message}</p></div><button type="button" className="primary-link mt-6" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1); }}>Try again</button></section>}
      {state.status === 'success' && <ProductDetailsContent product={state.product} />}
      <Link to="/products" className="text-link mt-10 inline-flex items-center text-sm">Back to all products</Link>
    </div>
  );
}

function ProductDetailsContent({ product }: { product: ProductDetails }) {
  const attributes = [
    ['Availability', product.availabilityStatus],
    ['Product code', product.sku],
    ['Shipping', product.shippingInformation],
    ['Warranty', product.warrantyInformation],
    ['Returns', product.returnPolicy],
    ['Supplier minimum order', product.minimumOrderQuantity?.toString()],
  ];

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
      <ProductGallery title={product.title} images={product.images} thumbnail={product.thumbnail} />
      <section aria-labelledby="product-title" className="min-w-0 lg:pt-2">
        <h1 id="product-title" className="font-display text-[clamp(2.5rem,4vw,4rem)] leading-[1.05] tracking-[-0.02em]">{product.title}</h1>
        <p className="mt-5 text-sm text-muted"><span className="capitalize">{product.category.replaceAll('-', ' ')}</span>{product.brand && <> · {product.brand}</>}</p>
        {product.rating !== undefined && <p className="mt-3 text-sm text-muted" aria-label={`Rated ${product.rating} out of 5`}>Rating {product.rating.toFixed(1)} / 5</p>}
        <p className="mt-7 text-2xl tabular-nums">{formatPrice(product.price)} <span className="text-xs text-muted">USD</span></p>
        <p className="mt-6 max-w-prose text-base leading-7 text-muted">{product.description}</p>
        <div className="my-8 border-y border-line py-6">
          <p className="mb-5 text-sm font-medium">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</p>
          <QuantitySelector stock={product.stock} />
          <button type="button" disabled className="mt-6 flex min-h-14 w-full cursor-not-allowed items-center justify-between gap-4 rounded-editorial bg-ink px-5 py-4 text-sm text-paper" aria-describedby="bag-availability"><span>Add to Bag</span><span className="text-xs">Coming soon</span></button>
          <p id="bag-availability" className="mt-3 text-xs leading-5 text-muted">Shopping is not available yet. This page uses sample product data from DummyJSON.</p>
        </div>
        <h2 className="font-display text-2xl">The details.</h2>
        <dl className="mt-4 divide-y divide-line text-sm">
          {attributes.map(([label, value]) => value && <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-3"><dt className="text-muted">{label}</dt><dd className="wrap-break-word">{value}</dd></div>)}
        </dl>
      </section>
    </div>
  );
}
