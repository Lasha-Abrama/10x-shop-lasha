type Collection = {
  name: string;
  description: string;
  image: string;
  alt: string;
};

type PreviewProduct = {
  name: string;
  material: string;
  price: string;
  image: string;
  alt: string;
};

const collections: Collection[] = [
  { name: 'Spaces to settle into', description: 'The home collection', image: '/images/living-room.jpg', alt: 'Warm living room with a neutral sofa and natural wood furniture' },
  { name: 'Objects with character', description: 'The tabletop collection', image: '/images/ceramics.jpg', alt: 'A collection of ceramic vessels and cups' },
  { name: 'Everyday companions', description: 'The carry collection', image: '/images/everyday-bag.jpg', alt: 'A simple everyday bag' },
];

const products: PreviewProduct[] = [
  { name: 'The ceramic collection', material: 'Earthy tones · Tabletop', price: '$38', image: '/images/ceramics.jpg', alt: 'Ceramic cups and vessels in natural tones' },
  { name: 'The everyday bag', material: 'Simple form · Everyday carry', price: '$46', image: '/images/everyday-bag.jpg', alt: 'An everyday bag with a simple silhouette' },
  { name: 'The quiet evening candle', material: 'A warm glow · Home accents', price: '$28', image: '/images/candle.jpg', alt: 'A candle arranged for a quiet evening' },
];

function Arrow() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

export function HomePage() {
  return (
    <>
      <section aria-labelledby="hero-heading" className="page-width pb-12 pt-8 lg:pb-16 lg:pt-10">
        <div className="grid overflow-hidden rounded-editorial bg-sand lg:min-h-144 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col justify-center px-7 py-12 sm:px-12 sm:py-16 lg:px-16">
            <h1 id="hero-heading" className="max-w-lg font-display text-[clamp(3.5rem,6.5vw,6rem)] leading-[0.98] tracking-[-0.025em]">Less, but<br />more considered.</h1>
            <p className="mt-7 max-w-sm text-base leading-7 text-muted">Objects for your space. Essentials for your day. A fresh perspective on the things you choose to live with.</p>
            <a className="primary-link mt-9 self-start" href="#collections">Explore the collections <Arrow /></a>
            <p className="mt-12 text-xs text-muted">The 10X Shop concept collection · Design preview</p>
          </div>
          <div className="relative min-h-80 sm:min-h-112 lg:min-h-full">
            <img src="/images/living-room.jpg" alt="A calm, sunlit living space with natural wood and soft neutral furnishings" width="1800" height="1200" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute bottom-6 left-6 bg-paper/95 px-4 py-2 text-xs text-ink">A little room for the everyday.</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-b border-line py-5 text-xs leading-5 text-muted">
          <p>Thoughtful forms. Everyday possibilities.</p>
          <p>A storefront in the making — take a look around.</p>
        </div>
      </section>

      <section id="collections" aria-labelledby="collections-heading" className="page-width scroll-mt-8 pb-20 pt-6 lg:pb-28">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 id="collections-heading" className="section-title">Find your everyday.</h2>
          <p className="max-w-xs text-sm leading-6 text-muted">Three ways to bring a little more intention to the ordinary.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {collections.map((collection) => (
            <article key={collection.name}>
              <img src={collection.image} alt={collection.alt} width="800" height="1000" loading="lazy" className="aspect-[4/3] w-full rounded-editorial bg-sand object-cover" />
              <h3 className="mt-5 font-display text-3xl leading-tight">{collection.name}</h3>
              <p className="mt-2 text-sm text-muted">{collection.description} · Preview</p>
            </article>
          ))}
        </div>
      </section>

      <section id="featured" aria-labelledby="featured-heading" className="border-y border-line bg-surface py-16 lg:py-20">
        <div className="page-width">
          <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h2 id="featured-heading" className="section-title">The selected edit.</h2>
              <p className="mt-3 text-sm leading-6 text-muted">A few things we’re imagining for the collection.</p>
            </div>
            <p className="max-w-sm text-xs leading-5 text-muted"><span className="font-semibold text-ink">Static product preview.</span> Illustrative names and prices only. Items cannot be purchased.</p>
          </div>
          <div className="grid gap-x-7 gap-y-10 sm:grid-cols-3">
            {products.map((product) => (
              <article key={product.name}>
                <div className="relative overflow-hidden rounded-editorial bg-sand">
                  <img src={product.image} alt={product.alt} width="800" height="1000" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                  <span className="absolute left-4 top-4 bg-paper px-3 py-1.5 text-xs">Preview only</span>
                </div>
                <div className="mt-5 flex items-start justify-between gap-4">
                  <h3 className="text-base font-medium leading-6">{product.name}</h3>
                  <p className="text-sm leading-6 tabular-nums" aria-label={`Illustrative price ${product.price}`}>{product.price}</p>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">{product.material}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="perspective" aria-labelledby="perspective-heading" className="page-width grid scroll-mt-8 gap-8 py-20 md:grid-cols-[1fr_1.2fr] md:gap-20 lg:py-28">
        <h2 id="perspective-heading" className="section-title max-w-md">Good things.<br />A little more thought.</h2>
        <div className="max-w-xl md:pt-2">
          <p className="font-display text-3xl leading-snug sm:text-4xl">We believe the everyday deserves a second look.</p>
          <p className="mt-5 text-base leading-7 text-muted">10X Shop is a graduation project exploring a more considered way to shop. This first collection is a visual study in useful objects, natural tones, and the spaces we call our own.</p>
          <a href="#collections" className="text-link mt-7 inline-flex items-center gap-4">Back to the collections <Arrow /></a>
        </div>
      </section>
    </>
  );
}
