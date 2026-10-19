import { useRef, useState } from 'react';

type ProductGalleryProps = { title: string; images: string[]; thumbnail: string };

export function ProductGallery({ title, images, thumbnail }: ProductGalleryProps) {
  const photos = images.length > 0 ? images : [thumbnail];
  const [selected, setSelected] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function selectImage(index: number) {
    setSelected(index);
    setImageFailed(false);
  }

  return (
    <section aria-label={`Images of ${title}`} className="min-w-0">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-editorial bg-surface">
        {imageFailed ? <p role="status" className="px-8 text-center text-sm text-muted">This image is unavailable. Try another view.</p> : (
          <img key={photos[selected]} src={photos[selected]} alt={`${title}, image ${selected + 1} of ${photos.length}`} width="800" height="800" fetchPriority="high" onError={() => setImageFailed(true)} className="h-full w-full object-contain p-8 sm:p-12" />
        )}
      </div>
      <div role="group" aria-label="Choose a product image" className="mt-5 flex flex-wrap gap-3">
        {photos.map((photo, index) => (
          <button key={`${photo}-${index}`} ref={(element) => { buttons.current[index] = element; }} type="button" aria-label={`View image ${index + 1} of ${photos.length} for ${title}`} aria-pressed={selected === index}
            className={`h-20 w-20 overflow-hidden rounded-editorial border bg-surface p-2 transition-colors hover:border-accent ${selected === index ? 'border-ink' : 'border-line'}`}
            onClick={() => selectImage(index)} onKeyDown={(event) => {
              let next = index;
              if (event.key === 'ArrowRight') next = (index + 1) % photos.length;
              else if (event.key === 'ArrowLeft') next = (index - 1 + photos.length) % photos.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = photos.length - 1;
              else return;
              event.preventDefault();
              selectImage(next);
              buttons.current[next]?.focus();
            }}>
            <img src={photo} alt="" width="80" height="80" className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted" aria-live="polite">Image {selected + 1} of {photos.length}</p>
    </section>
  );
}
