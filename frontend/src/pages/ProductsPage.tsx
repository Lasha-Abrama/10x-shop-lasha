import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { getCatalogPage, getCategories } from '../api/catalog';
import type { Category } from '../api/catalog';
import type { ProductsResponse } from '../api/products';
import { catalogParams, PAGE_SIZE, parseCatalogQuery, scheduleCatalogSearch, SORT_OPTIONS } from '../catalog/query';
import type { CatalogQuery } from '../catalog/query';
import { ProductGrid } from '../components/ProductGrid';

type LoadState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };
const fieldClass = 'mt-2 min-h-12 w-full rounded-editorial border border-muted bg-paper px-4 py-3 text-sm';

function CatalogResults({ query }: { query: CatalogQuery }) {
  const [state, setState] = useState<LoadState<ProductsResponse>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getCatalogPage(query, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ status: 'ready', data });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error' });
    });
    return () => controller.abort();
  }, [query, attempt]);

  if (state.status === 'loading') return <p role="status" className="flex min-h-64 items-center justify-center text-sm text-muted">Loading the collection…</p>;
  if (state.status === 'error') return <div className="border-y border-line py-12">
    <h2 className="font-display text-3xl">A brief pause.</h2>
    <p role="alert" className="mt-3 text-sm text-muted">We couldn’t load the collection. Check your connection and try again.</p>
    <button className="primary-link mt-6" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1); }}>Try again</button>
  </div>;
  const { products, total } = state.data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (query.page > pages) return <Navigate replace to={{ pathname: '/products', search: `?${catalogParams({ ...query, page: pages })}` }} />;
  if (!products.length) return <div role="status" className="border-y border-line py-12">
    <h2 className="font-display text-3xl">No matching finds.</h2>
    <p className="mt-3 text-sm text-muted">Try another title or category, or clear your filters.</p>
    <Link className="text-link mt-4" to="/products">Clear filters</Link>
  </div>;
  return <>
    <h2 className="sr-only">Products</h2>
    <p role="status" className="mb-7 text-xs text-muted">Showing {(query.page - 1) * PAGE_SIZE + 1}–{Math.min(query.page * PAGE_SIZE, total)} of {total} products · Prices in USD</p>
    <ProductGrid products={products} />
    <nav aria-label="Product pages" className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm">
      {query.page > 1 ? <Link className="text-link" to={`?${catalogParams({ ...query, page: query.page - 1 })}`}>Previous</Link> : <span className="text-muted" aria-disabled="true">Previous</span>}
      <span aria-current="page" className="tabular-nums">Page {query.page} of {pages}</span>
      {query.page < pages ? <Link className="text-link" to={`?${catalogParams({ ...query, page: query.page + 1 })}`}>Next</Link> : <span className="text-muted" aria-disabled="true">Next</span>}
    </nav>
  </>;
}

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // Keep the query object stable until the URL changes, so typing doesn't refetch.
  const query = useMemo(() => parseCatalogQuery(params), [params]);
  const canonical = catalogParams(query).toString();
  const [draft, setDraft] = useState(() => parseCatalogQuery(params).q);
  const [categories, setCategories] = useState<LoadState<Category[]>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { setDraft(parseCatalogQuery(new URLSearchParams(location.search)).q); }, [location.key, location.search]);
  useEffect(() => {
    if (params.toString() !== canonical) setParams(canonical, { replace: true });
  }, [params, canonical, setParams]);
  useEffect(() => {
    if (draft.trim() === query.q) return;
    return scheduleCatalogSearch(() => setParams(catalogParams({ ...query, q: draft.trim(), page: 1 }), { replace: true }));
  }, [draft, canonical, location.key, setParams]);
  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal).then((data) => {
      if (!controller.signal.aborted) setCategories({ status: 'ready', data });
    }).catch(() => { if (!controller.signal.aborted) setCategories({ status: 'error' }); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (location.hash === '#catalog-search') document.getElementById('catalog-search')?.focus();
  }, [location.hash]);

  function update(change: Partial<CatalogQuery>) {
    setParams(catalogParams({ ...query, q: draft.trim(), ...change, page: 1 }));
  }
  const unknownCategory = categories.status === 'ready' && query.category !== '' && !categories.data.some((category) => category.slug === query.category);
  return (
    <section aria-labelledby="catalog-heading" className="page-width pb-20 pt-10 lg:pb-28 lg:pt-16">
      <nav aria-label="Breadcrumb" className="mb-9 flex gap-3 text-xs text-muted"><Link className="nav-link" to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">All products</span></nav>
      <div className="mb-9 flex flex-col justify-between gap-5 border-b border-line pb-9 md:flex-row md:items-end">
        <div><h1 id="catalog-heading" className="section-title">The everyday collection.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted">Find your everyday essentials and considered pieces for your space.</p></div>
        <p className="max-w-xs text-xs leading-5 text-muted">Live sample data from DummyJSON. This is a graduation project; payments are not available.</p>
      </div>
      <form role="search" aria-label="Find products" onSubmit={(event) => { event.preventDefault(); update({}); }} className="mb-10">
        <div className="grid gap-5 md:grid-cols-[2fr_1fr_1fr]">
          <label className="text-sm" htmlFor="catalog-search">Search products<input id="catalog-search" type="search" maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search by product title" className={`${fieldClass} scroll-mt-28`} /></label>
          <label className="text-sm">Category<select className={fieldClass} value={query.category} disabled={categories.status !== 'ready'} onChange={(event) => update({ category: event.target.value })}>
            <option value="">All products</option>
            {unknownCategory && <option value={query.category}>Unavailable category</option>}
            {categories.status === 'ready' && categories.data.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select></label>
          <label className="text-sm">Sort by<select className={fieldClass} value={query.sort} onChange={(event) => update({ sort: parseCatalogQuery(new URLSearchParams({ sort: event.target.value })).sort })}>
            {Object.entries(SORT_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 text-xs text-muted"><span>Search updates as you type.</span><button type="button" className="text-link" onClick={() => { setDraft(''); setParams({}); }}>Reset all</button></div>
      </form>
      {categories.status === 'loading' && <p role="status" className="py-12 text-sm text-muted">Loading categories…</p>}
      {categories.status === 'error' && <div className="py-12"><p role="alert">We couldn’t load categories. Check your connection and try again.</p><button className="text-link mt-4" onClick={() => { setCategories({ status: 'loading' }); setAttempt((value) => value + 1); }}>Retry categories</button></div>}
      {unknownCategory && <div role="alert" className="py-12"><p>This category is unavailable.</p><Link className="text-link mt-4" to="/products">Clear filters</Link></div>}
      {categories.status === 'ready' && !unknownCategory && <CatalogResults key={canonical} query={query} />}
    </section>
  );
}
