import { useId } from 'react';

type QuantitySelectorProps = {
  stock: number;
  quantity: number;
  onChange: (quantity: number) => void;
  productTitle: string;
};

export function QuantitySelector({ stock, quantity, onChange, productTitle }: QuantitySelectorProps) {
  const quantityId = useId();

  if (stock === 0) return <p className="text-sm text-muted">Quantity unavailable while this product is out of stock.</p>;

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium">Quantity</legend>
      <div className="inline-flex items-center border border-line">
        <button type="button" aria-label={`Decrease quantity for ${productTitle}`} aria-controls={quantityId} disabled={quantity <= 1} onClick={() => onChange(Math.max(1, quantity - 1))} className="flex h-12 w-12 items-center justify-center hover:bg-sand disabled:cursor-not-allowed disabled:text-muted disabled:opacity-40">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10" /></svg>
        </button>
        <output id={quantityId} aria-label={`Selected quantity for ${productTitle}`} aria-live="polite" className="min-w-12 text-center text-sm tabular-nums">{quantity}</output>
        <button type="button" aria-label={`Increase quantity for ${productTitle}`} aria-controls={quantityId} disabled={quantity >= stock} onClick={() => onChange(Math.min(stock, quantity + 1))} className="flex h-12 w-12 items-center justify-center hover:bg-sand disabled:cursor-not-allowed disabled:text-muted disabled:opacity-40">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10M8 3v10" /></svg>
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">Up to {stock} available.</p>
    </fieldset>
  );
}
