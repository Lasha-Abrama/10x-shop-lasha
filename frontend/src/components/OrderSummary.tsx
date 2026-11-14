import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Order } from '../api/orders';
import { getProductDetails } from '../api/products';
import { formatPrice } from '../format';
import { actualOrderStatusLabels } from '../orders/status';

export function OrderSummary({ order, thumbnails }: { order: Order; thumbnails?: ReadonlyMap<number, string> }) {
  return <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
    <div className="min-w-0">
      <dl className="mb-8 grid gap-5 border-b border-line pb-7 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Order reference</dt><dd className="mt-2 wrap-anywhere">{order.id}</dd></div>
        <div><dt className="text-muted">Recorded on</dt><dd className="mt-2"><time dateTime={order.createdAt}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(order.createdAt))}</time></dd></div>
      </dl>
      <h2 className="font-display text-3xl">Your selection.</h2>
      <ul className="mt-5 divide-y divide-line border-b border-line">
        {order.items.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-6">
          <OrderThumbnail productId={item.productId} src={thumbnails?.get(item.productId)} />
          <div className="min-w-0 flex-1 basis-32"><h3 className="font-display text-2xl leading-tight wrap-anywhere"><Link className="nav-link" to={`/products/${item.productId}`}>{item.title}</Link></h3><p className="mt-2 text-sm text-muted">{item.quantity} × {formatPrice(item.unitPriceCents / 100)}</p></div>
          <p className="pt-1 text-sm tabular-nums">{formatPrice(item.lineTotalCents / 100)}</p>
        </li>)}
      </ul>
    </div>
    <aside aria-label="Order status and total" className="rounded-editorial bg-surface p-7 sm:p-8">
      <h2 className="font-display text-3xl">{actualOrderStatusLabels[order.status]}</h2>
      <p className="mt-4 text-sm leading-7 text-muted">No payment was taken. No shipping or stock reservation is arranged.</p>
      <dl className="mt-7 border-y border-line py-5"><div className="flex flex-wrap justify-between gap-3"><dt>Total (USD)</dt><dd className="tabular-nums">{formatPrice(order.totalCents / 100)}</dd></div></dl>
      <p className="mt-4 text-xs leading-6 text-muted">This is the server-confirmed item total. No tax, shipping charge, or discount has been added.</p>
    </aside>
  </div>;
}

function OrderThumbnail({ productId, src }: { productId: number; src?: string }) {
  const [catalogSrc, setCatalogSrc] = useState<string | null>();
  const [failedSrc, setFailedSrc] = useState<string>();

  // შეკვეთის ისტორიაში მხოლოდ productId გვაქვს, ამიტომ სურათს კატალოგიდან ვიღებთ.
  useEffect(() => {
    if (src) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
    void getProductDetails(String(productId), signal)
      .then((product) => {
        if (!controller.signal.aborted) setCatalogSrc(product?.thumbnail ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogSrc(null);
      });
    return () => controller.abort();
  }, [productId, src]);

  const image = src ?? catalogSrc;
  return <div className="flex size-16 shrink-0 items-center justify-center rounded-editorial bg-surface">
    {image && image !== failedSrc
      ? <img src={image} alt="" width="64" height="64" className="size-full object-contain" onError={() => setFailedSrc(image)} />
      : <span className="px-1 text-center text-xs text-muted">{!src && catalogSrc === undefined ? 'Loading image…' : 'Image unavailable'}</span>}
  </div>;
}
