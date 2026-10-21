# 10X Shop

10X Shop is a graduation e-commerce project. It contains a frontend design system, a responsive shared storefront layout, a DummyJSON product catalog at `/products`, product details at `/products/:id`, a persistent shopping bag at `/cart`, live featured products on the homepage, and a NestJS health endpoint. DummyJSON provides sample product data; search, checkout, and payments are not available yet.

## Stack and structure

- `frontend/`: Vite, React 19, strict TypeScript, Tailwind CSS v4, and React Router.
- `backend/`: NestJS, strict TypeScript, Prisma ORM 7.10.1, and Neon PostgreSQL.
- npm workspaces manage both apps with one root `package-lock.json`.
- `PLAN.md` lists milestones; `REPORT.md` is a progress report template.

The backend contains the `User` model and registration, login, and current-user authentication endpoints. Frontend authentication, Stripe, AI, and checkout are not implemented.

The storefront uses Tailwind v4 theme tokens in `frontend/src/styles.css` and shared Header/Footer/Layout components. `frontend/src/api/products.ts` validates the fields consumed by the UI from the DummyJSON list and single-product endpoints; extra API fields are ignored. ProductGrid loads the first 12 products and reuses ProductCard on both catalog and home pages. Product cards link to details with an image gallery, stock-bounded quantity selection, and optional supplier information. Both fetch lifecycles support loading, retry, and request cancellation. Invalid IDs and missing products have a not-found state. Prices are displayed in USD.

The bag uses React Context and a pure reducer in `frontend/src/cart/`. Add to Bag merges duplicate products and caps quantities at the supplied stock. The shared quantity selector is controlled by its caller. Totals are calculated in cents. `localStorage` key `10x-shop.cart.v1` stores `{ version: 1, items: [...] }`, with only product ID, title, unit price, thumbnail, stock, and quantity. Missing, malformed, or unsupported data resets to an empty bag; storage failures keep the in-memory bag usable and show a notice. No sensitive data is stored. Prices and stock are snapshots, refreshed when that product is added again; they are not live inventory guarantees. Cross-tab synchronization and checkout rules such as supplier minimum orders are not implemented. Checkout remains visibly disabled.

USD policy: `frontend/src/money.ts` converts finite, nonnegative dollar prices to the nearest cent with `Math.round(price * 100)`; converted cents must be safe integers. Formatting uses the same conversion. Cart line multiplication, aggregate cents, and total unit counts must also stay within JavaScript's safe integer bounds. Monetary results must retain every cent when converted back to dollars for display. API prices are validated before display, the reducer independently rejects invalid operations without changing the bag, and invalid stored carts reset entirely instead of showing a partial subtotal. No monetary values are silently capped.

The catalog needs internet access to DummyJSON and its image CDN. Fonts and lifestyle photos are served locally. DM Sans and Libre Caslon Display are from Google Fonts, with licenses in `frontend/public/fonts/`. Lifestyle photos are from Unsplash: [living room](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0), [ceramics](https://images.unsplash.com/photo-1610701596007-11502861dcfa), [bag](https://images.unsplash.com/photo-1544816155-12df9643f363), and [candle](https://images.unsplash.com/photo-1603006905003-be475563bc59). Their source and license evidence is in `frontend/public/images/ASSET-LICENSES.md`. The homepage mood studies are inspiration only, separate from the API-backed products.

## Local setup

Install Node.js 24 or newer and npm 11 or newer. From the repository root:

```sh
npm ci
npm run dev:frontend
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health, returning `{"status":"ok"}`

The frontend works independently and requires internet access for the catalog. Configure the backend database and authentication settings below before using `npm run dev` to start both apps. Ports 5173 and 3000 must be available. Press Ctrl+C to stop the apps.

If port 3000 is in use, choose another backend port, for example `PORT=3001 npm run dev` on macOS/Linux. Backend npm scripts load `backend/.env` using Node's built-in environment-file support; existing shell variables take precedence.

## Backend database setup

Use the existing Neon project and database. In your local editor, create `backend/.env` from `backend/.env.example` if it does not already exist. Never overwrite an existing environment file or paste credentials into chat, source files, or Git.

1. Open the Neon console's **Connect** dialog for the intended branch and database. With connection pooling enabled, copy the complete PostgreSQL URL into `DATABASE_URL="..."` in `backend/.env`.
2. Disable pooling in the same dialog and put that URL into `DIRECT_URL="..."` in the same file. Both URLs must point to the same branch/database. Keep Neon's SSL options; do not disable certificate verification. The runtime URL normally has `-pooler` in its hostname; the migration URL does not.
3. Generate and validate the client (these commands do not connect to the database):

   ```sh
   npm run prisma:validate --workspace backend
   npm run prisma:generate --workspace backend
   ```

The generated TypeScript client lives in ignored `backend/src/generated/prisma/`. Backend typecheck, build, and development scripts generate it automatically, including on a clean checkout. Prisma's `prisma-client` generator uses CommonJS to match Nest's existing build. Prisma 7 keeps connection URLs out of `schema.prisma`: `backend/prisma.config.ts` loads the backend-local environment file and uses only `DIRECT_URL` for CLI operations. Runtime `PrismaService` uses `@prisma/adapter-pg` with `DATABASE_URL`, a small connection pool, and a connection timeout. It verifies connectivity with `SELECT 1` at startup and disconnects on shutdown. The health endpoint remains `GET /health`.

The initial migration `20261020000000_init_users` was applied to the configured Neon database on 20 October 2026. Direct and pooled connectivity, migration history/checksum, User columns, Role values, and indexes were verified with read-only queries. On a different database, configure both local URLs, confirm connectivity, and inspect the existing schema and migration history before applying the migration. If existing tables or conflicting schema objects are present, stop and reconcile the history first; do not reset, drop, or overwrite them.

For an inspected compatible database, the normal tracked-migration workflow is:

```sh
npm run prisma:status --workspace backend
npm run prisma:migrate:deploy --workspace backend
npm run prisma:status --workspace backend
npm run dev:backend
```

`migrate status` reports pending migrations before deployment. `migrate deploy` applies migration files without a shadow database or a reset. For future schema changes on a dedicated development database/Neon branch, use `npm run prisma:migrate:dev --workspace backend -- --name descriptive_name`; it may need shadow-database permissions. Never accept a reset prompt for an existing database. Prefer a separate development branch when testing migrations against existing data.

`User` has a UUID primary key, unique email, required `passwordHash`, `Role` enum (`USER` by default or `ADMIN`), and creation/update timestamps. UUIDs and `updatedAt` are managed by Prisma. STEP 009A uses this schema unchanged; it requires no new migration and creates no seed accounts.

## Backend authentication

In the ignored `backend/.env`, add `JWT_SECRET` and `FRONTEND_ORIGINS` from `backend/.env.example` without changing the database URLs. Generate a 32-byte random signing secret locally with the command in the example file, then paste its 64 hexadecimal characters into `JWT_SECRET`. Do not share the output, commit it, or use the example placeholder. Set `FRONTEND_ORIGINS="http://localhost:5173"`; multiple explicit local origins can be comma-separated, for example to include `http://127.0.0.1:5173`. Paths, wildcard origins, and non-local hosts are rejected. Missing or invalid auth configuration stops startup before connecting to the database. Existing shell variables override the local file.

| Endpoint | Request | Result |
| --- | --- | --- |
| `POST /auth/register` | JSON `email` and `password` only | `202` with the same acknowledgement for a new or duplicate email |
| `POST /auth/login` | JSON `email` and `password` only | `200` with `accessToken`, `tokenType: "Bearer"`, `expiresIn: 900`, and public `user` |
| `GET /auth/me` | `Authorization: Bearer <accessToken>` | Current public user, or `401` for invalid tokens/deleted users |

Emails are trimmed and lowercased consistently. Passwords must contain 15–128 characters; whitespace is preserved, and passwords are never truncated. Unknown fields, including `role`, are rejected with `400`. Registration always assigns `USER`, hashes with Argon2id (19 MiB memory, two iterations, one parallel lane, random salt), and handles unique-email races without disclosing whether an account exists. Its response contains no user data or token; sign in separately. Login returns the same `401` message for unknown email and incorrect password, and performs Argon2 verification in both cases to reduce timing differences.

JWTs use HS256, a 15-minute expiry, fixed issuer/audience, and only user ID/role plus standard timing/issuer claims. The guard checks the signature, algorithm, claims, and expiry, then reloads the user from Prisma on every protected request. Database roles take precedence over token role claims. Public user responses contain only `id`, `email`, `role`, `createdAt`, and `updatedAt`. Authentication responses use `Cache-Control: no-store`; credentials, hashes, tokens, and connection strings are not logged. Database failures return sanitized service-unavailable messages.

Registration is limited to five requests per minute per IP; login to ten. Invalid requests also count, and forwarded IP headers are not trusted. The default throttler stores counters in memory for this single-process graduation backend; restarts clear them. Before running multiple backend instances, use a shared rate-limit store and explicitly configure any trusted proxy. CORS allows only configured local origins, supports the Authorization header, and does not enable browser credentials/cookies. CORS is a browser policy, not a substitute for token checks. Use HTTPS when moving beyond local development. There are no refresh tokens, cookies, OAuth, verification/reset emails, or admin-management endpoints.

### Test without touching Neon

```sh
npm test --workspace backend
```

This builds the backend and runs Node's built-in tests with `@nestjs/testing`, real HTTP requests on temporary loopback ports, real Argon2id/JWT operations, and an in-memory Prisma mock. The test server does not load `.env`, connect to Neon, or create real accounts; Prisma generation during the build needs no database access. Tests cover validation, normalization, hashing, duplicate races, public fields, JWT rejection/expiry, deleted users, rate limits, and CORS. No Jest or HTTP testing library is required.

For manual checks, configure the local environment, run `npm run dev:backend`, and use a local API client. Keep passwords and bearer tokens out of command history, screenshots, and logs. Calling registration against this server writes a real account to the configured Neon database; do so only when intended. Automated verification in STEP 009A does not perform that operation.

## Commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start both apps with file watching |
| `npm run dev:frontend` | Start only Vite |
| `npm run dev:backend` | Start only NestJS |
| `npm run typecheck` | Typecheck both apps |
| `npm test --workspace frontend` | Run catalog/detail API tests and cart reducer/storage tests with Node's built-in test runner |
| `npm test --workspace backend` | Build and run isolated authentication HTTP tests with mocked Prisma |
| `npm run build` | Typecheck and build both apps |
| `npm run preview --workspace frontend` | Preview the frontend build locally |
| `npm start --workspace backend` | Run the compiled backend |
| `npm run prisma:generate --workspace backend` | Generate the ignored Prisma client without connecting |
| `npm run prisma:validate --workspace backend` | Validate the Prisma schema |
| `npm run prisma:status --workspace backend` | Inspect migration status using the direct URL |
| `npm run prisma:migrate:deploy --workspace backend` | Apply reviewed tracked migrations |
| `npm run prisma:migrate:dev --workspace backend -- --name descriptive_name` | Create future migrations on a dedicated development database |
| `npm run prisma:studio --workspace backend` | Open local database inspection UI; keep it private |

Builds are written to `frontend/dist/` and `backend/dist/`. Build before running the preview or compiled backend. For frontend production hosting, serve `frontend/dist/` and configure an SPA fallback to `index.html` for browser routing.

Use `npm install` when intentionally changing dependencies and commit the updated lockfile with those changes. Keep secrets and `.env` files out of version control.
