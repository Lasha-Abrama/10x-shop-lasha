import { useState } from 'react';
import { Link } from 'react-router';
import type { Product } from '../api/products';
import { formatPrice } from '../format';
import { CardBagButton } from './CardBagButton';

export function ProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="min-w-0">
      <Link to={`/products/${product.id}`} className="group block" aria-label={`View ${product.title}`}>
        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-editorial bg-surface">
          {imageFailed ? (
            <p className="px-6 text-center text-sm text-muted">Image unavailable for {product.title}</p>
          ) : (
            <img src={product.thumbnail} alt={product.title} width="400" height="500" loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-contain p-5" />
          )}
        </div>
        <p className="mt-4 text-xs capitalize text-muted">{product.category.replaceAll('-', ' ')}</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-base font-medium leading-6 wrap-break-word group-hover:underline group-hover:underline-offset-4">{product.title}</h3>
          <p className="shrink-0 text-sm leading-6 tabular-nums">{formatPrice(product.price)}</p>
        </div>
        {product.rating !== undefined && <p className="mt-2 text-xs text-muted" aria-label={`Rated ${product.rating} out of 5`}>Rating {product.rating.toFixed(1)} / 5</p>}
      </Link>
      <CardBagButton productId={product.id} title={product.title} />
    </article>
  );
}
