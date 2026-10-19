# 10X Shop

10X Shop is a graduation e-commerce project. It contains a frontend design system, a responsive shared storefront layout, a DummyJSON product catalog at `/products`, product details at `/products/:id`, a persistent shopping bag at `/cart`, live featured products on the homepage, and a NestJS health endpoint. DummyJSON provides sample product data; search, checkout, and payments are not available yet.

## Stack and structure

- `frontend/`: Vite, React 19, strict TypeScript, Tailwind CSS v4, and React Router.
- `backend/`: NestJS and strict TypeScript.
- npm workspaces manage both apps with one root `package-lock.json`.
- `PLAN.md` lists milestones; `REPORT.md` is a progress report template.

PostgreSQL, Prisma, authentication, Stripe, AI, and checkout are not configured.

The storefront uses Tailwind v4 theme tokens in `frontend/src/styles.css` and shared Header/Footer/Layout components. `frontend/src/api/products.ts` validates the fields consumed by the UI from the DummyJSON list and single-product endpoints; extra API fields are ignored. ProductGrid loads the first 12 products and reuses ProductCard on both catalog and home pages. Product cards link to details with an image gallery, stock-bounded quantity selection, and optional supplier information. Both fetch lifecycles support loading, retry, and request cancellation. Invalid IDs and missing products have a not-found state. Prices are displayed in USD.

The bag uses React Context and a pure reducer in `frontend/src/cart/`. Add to Bag merges duplicate products and caps quantities at the supplied stock. The shared quantity selector is controlled by its caller. Totals are calculated in cents. `localStorage` key `10x-shop.cart.v1` stores `{ version: 1, items: [...] }`, with only product ID, title, unit price, thumbnail, stock, and quantity. Missing, malformed, or unsupported data resets to an empty bag; storage failures keep the in-memory bag usable and show a notice. No sensitive data is stored. Prices and stock are snapshots, refreshed when that product is added again; they are not live inventory guarantees. Cross-tab synchronization and checkout rules such as supplier minimum orders are not implemented. Checkout remains visibly disabled.

USD policy: `frontend/src/money.ts` converts finite, nonnegative dollar prices to the nearest cent with `Math.round(price * 100)`; converted cents must be safe integers. Formatting uses the same conversion. Cart line multiplication, aggregate cents, and total unit counts must also stay within JavaScript's safe integer bounds. Monetary results must retain every cent when converted back to dollars for display. API prices are validated before display, the reducer independently rejects invalid operations without changing the bag, and invalid stored carts reset entirely instead of showing a partial subtotal. No monetary values are silently capped.

The catalog needs internet access to DummyJSON and its image CDN. Fonts and lifestyle photos are served locally. DM Sans and Libre Caslon Display are from Google Fonts, with licenses in `frontend/public/fonts/`. Lifestyle photos are from Unsplash: [living room](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0), [ceramics](https://images.unsplash.com/photo-1610701596007-11502861dcfa), [bag](https://images.unsplash.com/photo-1544816155-12df9643f363), and [candle](https://images.unsplash.com/photo-1603006905003-be475563bc59). Their source and license evidence is in `frontend/public/images/ASSET-LICENSES.md`. The homepage mood studies are inspiration only, separate from the API-backed products.

## Local setup

Install Node.js 24 or newer and npm 11 or newer. From the repository root:

```sh
npm ci
npm run dev
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health, returning `{"status":"ok"}`

No environment files or locally managed services are needed. The catalog requires internet access. Ports 5173 and 3000 must be available. Press Ctrl+C to stop both apps.

If port 3000 is in use, choose another backend port, for example `PORT=3001 npm run dev` on macOS/Linux. The backend reads `PORT` from the shell; it does not load `.env` files.

## Commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start both apps with file watching |
| `npm run dev:frontend` | Start only Vite |
| `npm run dev:backend` | Start only NestJS |
| `npm run typecheck` | Typecheck both apps |
| `npm test --workspace frontend` | Run catalog/detail API tests and cart reducer/storage tests with Node's built-in test runner |
| `npm run build` | Typecheck and build both apps |
| `npm run preview --workspace frontend` | Preview the frontend build locally |
| `npm start --workspace backend` | Run the compiled backend |

Builds are written to `frontend/dist/` and `backend/dist/`. Build before running the preview or compiled backend. For frontend production hosting, serve `frontend/dist/` and configure an SPA fallback to `index.html` for browser routing.

Use `npm install` when intentionally changing dependencies and commit the updated lockfile with those changes. Keep secrets and `.env` files out of version control.
