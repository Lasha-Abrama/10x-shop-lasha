import { Link } from 'react-router';
import { ProductGrid } from '../components/ProductGrid';

type Collection = {
  name: string;
  description: string;
  image: string;
  alt: string;
};

const collections: Collection[] = [
  { name: 'Spaces to settle into', description: 'The home collection', image: '/images/living-room.jpg', alt: 'Warm living room with a neutral sofa and natural wood furniture' },
  { name: 'Objects with character', description: 'The tabletop collection', image: '/images/ceramics.jpg', alt: 'A collection of ceramic vessels and cups' },
  { name: 'Everyday companions', description: 'The carry collection', image: '/images/everyday-bag.jpg', alt: 'A simple everyday bag' },
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
            <Link className="primary-link mt-9 self-start" to="/products">Explore all products <Arrow /></Link>
            <p className="mt-12 text-xs text-muted">The 10X Shop collection · A graduation project</p>
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
          <p className="max-w-xs text-sm leading-6 text-muted">Three inspirations for everyday living. These mood studies are not shoppable categories.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {collections.map((collection) => (
            <article key={collection.name}>
              <img src={collection.image} alt={collection.alt} width="800" height="1000" loading="lazy" className="aspect-[4/3] w-full rounded-editorial bg-sand object-cover" />
              <h3 className="mt-5 font-display text-3xl leading-tight">{collection.name}</h3>
              <p className="mt-2 text-sm text-muted">{collection.description} · Inspiration only</p>
            </article>
          ))}
        </div>
        <Link to="/products" className="text-link mt-7 inline-flex items-center gap-4">Explore all products <Arrow /></Link>
      </section>

      <section id="featured" aria-labelledby="featured-heading" className="border-y border-line bg-surface py-16 lg:py-20">
        <div className="page-width">
          <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h2 id="featured-heading" className="section-title">The selected edit.</h2>
              <p className="mt-3 text-sm leading-6 text-muted">A first look at the collection, straight from the catalog.</p>
            </div>
            <Link to="/products" className="text-link inline-flex items-center gap-4 text-sm">View all products <Arrow /></Link>
          </div>
          <ProductGrid limit={3} />
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
