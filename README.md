# 10X Shop

10X Shop is an individual graduation storefront built with React, strict TypeScript, Tailwind CSS v4, and DummyJSON. It demonstrates product discovery, a persistent bag, controlled forms, and authenticated demonstration orders. It does not process payments, arrange shipping, or reserve stock.

Repository: [Lasha-Abrama/10x-shop-lasha](https://github.com/Lasha-Abrama/10x-shop-lasha), matching the configured Git origin. Public reviewer access still needs verification.

**Deployment (verified 25 October 2026):** [storefront](https://10x-shop-lasha.vercel.app/) on Vercel **Ready**, [NestJS backend](https://one0x-shop-lasha.onrender.com/) on Render **Live**, and [health](https://one0x-shop-lasha.onrender.com/health) returning HTTP 200. Production commit: `24107f8f701841e09c7dfc912e5ad6b32623eeab`. Authentication and order storage use an isolated production Neon PostgreSQL project; products come from DummyJSON. [PLAN.md](PLAN.md) tracks remaining work, [REPORT.md](REPORT.md) records results, [REQUIREMENTS.md](REQUIREMENTS.md) maps the specification, and [DEBUG-LOG.md](DEBUG-LOG.md) documents three verified historical defects.

## Features and scope

- **CORE functionality:** shared responsive layout, catalog/cards, details/gallery, quantities, Add to Bag, cart totals/removal, controlled login/checkout, guest checkout redirect, confirmation, loading/error/empty states, Error Boundary, strict types and linting. Remaining specification details and unverified QA are listed in REQUIREMENTS; not every CORE item is finished.
- **Selected FULL work:** search, dynamic categories, global sorting, pagination/URL state, cart persistence, order history, read-only account information, lazy routes/images, theme tokens and targeted memoization. No claim of complete FULL coverage is made.
- **Lecturer-approved extension, confirmed by the student:** NestJS authentication and PostgreSQL orders replace simulated login/order storage. Authentication is implemented in the project rather than delegated to an external auth service. The assessed frontend exercises remain visible, including the four-field checkout form.

## Stack and architecture

Frontend: React 19, React Router 7, Vite 7, TypeScript 5.9, Tailwind CSS v4. Backend: NestJS 11, Prisma **7.10.1**, Neon PostgreSQL, Argon2id and signed JWTs. npm workspaces share one lockfile; no external state-management or HTTP-client library is used.

```text
frontend/
  src/api/          Fetch clients and response validation
  src/auth/         In-memory authentication Context/reducer
  src/cart/         Cart Context, pure reducer, storage validation
  src/catalog/      Typed URL state and debounce scheduling
  src/orders/       Checkout validation and submission
  src/components/   Layout, cards, gallery, controls, boundary
  src/pages/        Routed storefront pages
  tests/            Node tests and development-only browser fixtures
backend/
  src/auth/         Registration, login, JWT guard
  src/database/     Prisma lifecycle integration
  src/orders/       Catalog checks and order transactions
  prisma/           Schema and tracked migrations
  tests/            Isolated authentication/order HTTP tests
```

The browser fetches catalog data directly from DummyJSON and shares bag/auth state through Context. Only product IDs and quantities go to the order API. NestJS derives the user from a verified token, independently checks catalog prices/stock, calculates integer-cent totals, and saves the order/items atomically. Title/price snapshots preserve order history if the catalog changes; PostgreSQL is not a second product catalog.

Routes: `/` is the editorial homepage; `/products` is the catalog; `/products/:id`, `/cart`, `/login`, `/register`, `/checkout`, `/account`, `/orders` and `/orders/:id` provide the remaining flows. Unknown routes and missing products/orders have recovery states. The catalog-at-`/products` convention differs from the assignment's catalog-at-`/`; see REQUIREMENTS.

## Local setup

Use **Node.js 24.x and npm 11+**. From the repository root:

```sh
npm ci
npm run dev:frontend
```

The catalog runs at `http://localhost:5173` with internet access to DummyJSON and its image CDN. For authentication/orders, configure the environment and database below, then run `npm run dev` for both apps. The backend defaults to `http://localhost:3000`; `GET /health` returns `{"status":"ok"}` after startup/configuration/database checks succeed. Keep the required ports available; Ctrl+C stops development servers.

### Environment configuration

Create local files from [frontend/.env.example](frontend/.env.example) and [backend/.env.example](backend/.env.example) **only if missing**; never overwrite existing credentials. Enter private values in your editor, not chat, source control, screenshots or shell history.

| File / variable | Purpose and safe example |
| --- | --- |
| `frontend/.env.local`: `VITE_API_BASE_URL` | Public API base, e.g. `http://localhost:3000`; also the default. Restart Vite after changes; production values are embedded at build time. |
| `backend/.env`: `DATABASE_URL` | Private pooled Neon runtime URL from the intended branch/database's Connect dialog. |
| `backend/.env`: `DIRECT_URL` | Private direct URL to the **same** branch/database for Prisma CLI operations. |
| `backend/.env`: `JWT_SECRET` | Locally generated random 64-character hexadecimal signing secret; never use the example placeholder. |
| `backend/.env`: `FRONTEND_ORIGINS` | Explicit comma-separated local origins, e.g. `http://localhost:5173,http://127.0.0.1:5173`; no trailing slash/path or wildcard. |
| `backend/.env`: `PORT` | Optional API port, default `3000`. If changed, update the frontend API base too. |

The backend example includes a command for generating the signing secret privately. Backend scripts load `backend/.env`; shell variables take precedence. Missing/invalid auth configuration fails startup. `VITE_*` values are public: **never put database URLs, JWT secrets, passwords or tokens in frontend environment variables**. Local environment files, dependencies, builds and the generated Prisma client are ignored by Git.

### Safe database setup

Preserve Neon's SSL options. Enable pooling for `DATABASE_URL` and disable it for `DIRECT_URL`. Prisma 7 reads its CLI URL from [backend/prisma.config.ts](backend/prisma.config.ts); runtime uses the PostgreSQL adapter in [PrismaService](backend/src/database/prisma.service.ts), which checks connectivity at startup and disconnects on shutdown.

```sh
npm run prisma:validate --workspace backend
npm run prisma:generate --workspace backend
```

Validation/generation do not connect to Neon. Generation writes ignored `backend/src/generated/prisma/` and also runs automatically for backend development, typecheck, build and tests.

Tracked migrations are `20261020000000_init_users` and `20261021000000_add_orders`. Earlier milestones applied and verified them on the configured development database; this documentation step does not recheck or alter it. Do not recreate or edit applied migrations. For another target, confirm its identity, inspect its schema/history and pending SQL, and obtain approval before applying changes:

```sh
npm run prisma:status --workspace backend
# Only after target and pending migrations have been reviewed and approved:
npm run prisma:migrate:deploy --workspace backend
npm run prisma:status --workspace backend
```

Do not use `db push`, reset/drop commands or a reset prompt to reconcile existing data. Stop on conflicting schema/history. `prisma:migrate:dev` is for future work on an isolated development branch; Studio is for deliberate private inspection, not a public service.

## Authentication and checkout behavior

Registration/login accept validated email and a **15–128-character password**. Emails are normalized; registration assigns `USER` and returns the same neutral acknowledgement for new/existing emails. Passwords use Argon2id. Login verifies `/auth/me` before authenticating the frontend. JWTs expire after 15 minutes and remain **only in React memory**: refresh, a new tab, logout or expiry returns to guest state. Tokens never enter browser storage, cookies or URLs; the saved bag is separate.

The bag's versioned localStorage key is `10x-shop.cart.v1`; malformed/unsafe data recovers to an empty bag. Quantities are stock-bounded and totals use validated integer cents. Bag prices/stock are snapshots, not inventory guarantees.

Clearing the entire bag requires native browser confirmation. Cancel preserves the bag; confirmation clears it and updates persisted storage. Individual item removal is unchanged.

Checkout requires controlled **full name, email, address and city** inputs with local validation. Use sample details: these values remain in React memory, appear only in immediate confirmation, and are **not sent to NestJS, saved in browser storage or included in order history**. Leaving/refreshing checkout discards them. Guests go to login with an allowlisted internal return route; authenticated empty checkout returns to the bag.

The order request contains only IDs and quantities:

```json
{ "items": [{ "productId": 1, "quantity": 1 }] }
```

The backend validates fresh DummyJSON prices, availability and stock. It rounds USD to cents and rejects invalid/overflowing line/order totals; its PostgreSQL `Int` bound is 2,147,483,647 cents. The server total may differ from the bag estimate. A validated success clears the bag and shows authoritative snapshots with **PENDING_PAYMENT** status. No payment, tax/shipping charge, fulfillment or stock reservation occurs.

Failed submissions preserve the bag. An uncertain response may hide a completed write: the current view blocks repeat submission and directs the user to history. There is no backend idempotency key; leaving/reloading does not undo a write. Check history after interruption and never automatically retry an uncertain order.

| API route | Contract |
| --- | --- |
| `POST /auth/register` | Email/password only; `202` neutral acknowledgement. |
| `POST /auth/login` | Email/password only; `200` bearer token, 900-second expiry, public user. |
| `GET /auth/me` | Bearer token; safe current user fields. |
| `POST /orders` | Bearer token; 1–20 distinct product IDs, quantities 1–100; `201` saved order. Unknown fields/duplicates are rejected. |
| `GET /orders` | Bearer token; current user's latest 50 orders. |
| `GET /orders/:id` | Bearer token and UUID; ownership enforced, missing/other-user order returns `404`. |

Protected endpoints reload the user from Prisma; deleted users/stale roles are not trusted. Public responses exclude hashes and user relations. DTO whitelisting, sanitized errors and modest in-memory rate limits protect auth/order writes. Missing/expired auth returns `401`, invalid input `400`, unavailable products/stock `409`, catalog/persistence failures `503`. There is no shared demo login: the assignment's DummyJSON credentials do not authenticate here. Arrange a disposable test account privately with the owner; do not publish passwords or automatically seed live users/orders.

## Commands and verification

Run commands from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start both configured apps. |
| `npm run dev:frontend` / `npm run dev:backend` | Start one app. |
| `npm run lint` | Frontend recommended TS rules, no explicit `any`, Hooks rules; warnings fail. Backend lint is not configured. |
| `npm run typecheck` / `npm run build` | Check/build both workspaces. |
| `npm test --workspace frontend` | API, money/cart/storage, auth/order, form, catalog and reliability tests. |
| `npm test --workspace backend` | Isolated HTTP tests with mocked Prisma/catalog and real validation, hashing and JWTs; no Neon writes. |
| `npm run preview --workspace frontend` | Serve the built frontend locally. |
| `npm start --workspace backend` | Run the compiled backend. |
| `npm run prisma:validate --workspace backend` / `npm run prisma:generate --workspace backend` | Offline schema validation/client generation. |
| `npm run prisma:status --workspace backend` / `npm run prisma:migrate:deploy --workspace backend` | Inspect/apply tracked migrations after target review. |
| `npm run prisma:migrate:dev --workspace backend -- --name descriptive_name` | Future migrations on an isolated development database. |
| `npm run prisma:studio --workspace backend` | Private database inspection UI. |
| `git diff --check` | Check patch whitespace. |

On Vite's development server, `/tests/checkout.html` runs 27 assertions with isolated fetch/storage mocks, and `/tests/reliability.html` runs 14 boundary/lazy/memo assertions without API writes. They are excluded from production output and frontend lint; fixture TSX remains typechecked. Successful order tests must use mocks unless a live write is separately approved. REPORT records the dated verification snapshot and limits.

The class Error Boundary uses `getDerivedStateFromError` and `componentDidCatch`. Development diagnostics contain only a fixed generic message; production emits no application diagnostic. The fallback exposes no internal details. Boundaries catch descendant rendering errors (including failed lazy imports), not ordinary API failures or every asynchronous/event-handler error; those keep their existing local error handling.

## Deployment and remaining work

The frontend and backend are live; [DEPLOYMENT.md](DEPLOYMENT.md) records settings, evidence and remaining operational checks. Render Free can cold-start. Previously authorized full-stack smoke tests are reported by the owner; this documentation review creates no users or orders.

On 25 October, measured mobile Lighthouse changed from **77 / 100 / 100 / 92** to **89 / 100 / 100 / 100** (repeat performance **87**); desktop changed from **99 / 100 / 100 / 92** to **100 / 100 / 100 / 100**. Category order is Performance / Accessibility / Best Practices / SEO. Responsive hero WebP/preload and valid robots.txt are deployed. [REPORT.md](REPORT.md#production-verification-and-lighthouse--25-october-2026) contains source reports, timings and measurement limits.

The latest implementation validation passed lint, typecheck, build, **75 frontend tests** and **99 backend tests**; these were not rerun for this documentation-only step. Two high npm audit entries remain for the same Multer advisory; see REPORT. Complete the [acceptance checklist](REQUIREMENTS.md#final-acceptance-checklist--26-october-2026), including browser/keyboard QA and rubric clarification, before submission sign-off.

## Credits and defense notes

Project author: Lasha Abramishvili. The 10X graduation PRD/Annex A and lecturer feedback define the assessed scope. OpenAI Codex assisted implementation, review, tests and documentation; human review, explicit live-write approvals and understanding the code remain essential. REPORT includes an AI-use summary.

DummyJSON supplies demonstration products/images. DM Sans and Libre Caslon Display licenses are in [frontend/public/fonts](frontend/public/fonts); local lifestyle photo provenance/verification links are in [ASSET-LICENSES.md](frontend/public/images/ASSET-LICENSES.md). Homepage mood studies are illustrative, separate from API products.
