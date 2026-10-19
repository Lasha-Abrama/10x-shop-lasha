# 10X Shop

10X Shop is a graduation e-commerce project. It contains a frontend design system, a responsive shared storefront layout, a DummyJSON product catalog at `/products`, live featured products on the homepage, and a NestJS health endpoint. DummyJSON provides sample product data; search and shopping are not available yet.

## Stack and structure

- `frontend/`: Vite, React 19, strict TypeScript, Tailwind CSS v4, and React Router.
- `backend/`: NestJS and strict TypeScript.
- npm workspaces manage both apps with one root `package-lock.json`.
- `PLAN.md` lists milestones; `REPORT.md` is a progress report template.

PostgreSQL, Prisma, authentication, Stripe, AI, and shopping features are not configured.

The storefront uses Tailwind v4 theme tokens in `frontend/src/styles.css` and shared Header/Footer/Layout components. `frontend/src/api/products.ts` validates the product fields consumed by the UI from `https://dummyjson.com/products?limit=12&skip=0`; extra API fields are ignored. ProductGrid manages loading, retry, empty states, and request cancellation, and reuses ProductCard on both pages. Prices are displayed in USD. Cards are informational until product details are implemented.

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
| `npm test --workspace frontend` | Run catalog API validation and failure tests with Node's built-in test runner |
| `npm run build` | Typecheck and build both apps |
| `npm run preview --workspace frontend` | Preview the frontend build locally |
| `npm start --workspace backend` | Run the compiled backend |

Builds are written to `frontend/dist/` and `backend/dist/`. Build before running the preview or compiled backend. For frontend production hosting, serve `frontend/dist/` and configure an SPA fallback to `index.html` for browser routing.

Use `npm install` when intentionally changing dependencies and commit the updated lockfile with those changes. Keep secrets and `.env` files out of version control.
