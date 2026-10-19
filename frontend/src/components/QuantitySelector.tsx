import { useState } from 'react';

export function QuantitySelector({ stock }: { stock: number }) {
  const [quantity, setQuantity] = useState(1);

  if (stock === 0) return <p className="text-sm text-muted">Quantity unavailable while this product is out of stock.</p>;

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium">Quantity</legend>
      <div className="inline-flex items-center border border-line">
        <button type="button" aria-label="Decrease quantity" aria-controls="product-quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="flex h-12 w-12 items-center justify-center hover:bg-sand disabled:cursor-not-allowed disabled:text-muted disabled:opacity-40">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10" /></svg>
        </button>
        <output id="product-quantity" aria-label="Selected quantity" aria-live="polite" className="min-w-12 text-center text-sm tabular-nums">{quantity}</output>
        <button type="button" aria-label="Increase quantity" aria-controls="product-quantity" disabled={quantity >= stock} onClick={() => setQuantity((value) => Math.min(stock, value + 1))} className="flex h-12 w-12 items-center justify-center hover:bg-sand disabled:cursor-not-allowed disabled:text-muted disabled:opacity-40">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10M8 3v10" /></svg>
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">Up to {stock} available. Quantity is a preview until shopping launches.</p>
    </fieldset>
  );
}
