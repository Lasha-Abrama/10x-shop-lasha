# 10X Shop

10X Shop is a graduation e-commerce project. It contains a frontend design system, a responsive shared storefront layout, a DummyJSON product catalog at `/products`, product details at `/products/:id`, a persistent shopping bag at `/cart`, live featured products on the homepage, and a NestJS health endpoint. DummyJSON provides sample product data. Authenticated demonstration checkout and order history are available; shipping and payments are not implemented.

## Stack and structure

- `frontend/`: Vite, React 19, strict TypeScript, Tailwind CSS v4, and React Router.
- `backend/`: NestJS, strict TypeScript, Prisma ORM 7.10.1, and Neon PostgreSQL.
- npm workspaces manage both apps with one root `package-lock.json`.
- `PLAN.md` lists milestones; `REPORT.md` is a progress report template.

The backend contains authentication and an authenticated order API backed by Prisma. The storefront has login, registration, and account pages. The frontend supports demonstration checkout and order history. The lecturer approved this backend extension, as confirmed by the student; it supplements the assessed React, TypeScript, Tailwind, and optimization work. Authentication is implemented in NestJS rather than delegated to an external authentication service. Payments and AI are not implemented.

The storefront uses Tailwind v4 theme tokens in `frontend/src/styles.css` and shared Header/Footer/Layout components. `frontend/src/api/products.ts` validates the fields consumed by the UI from the DummyJSON list and single-product endpoints; extra API fields are ignored. ProductGrid reuses ProductCard on both catalog and home pages; the homepage shows three featured products. Product cards link to details with an image gallery, stock-bounded quantity selection, and optional supplier information. Both fetch lifecycles support loading, retry, and request cancellation. Invalid IDs and missing products have a not-found state. Prices are displayed in USD.

The bag uses React Context and a pure reducer in `frontend/src/cart/`. Add to Bag merges duplicate products and caps quantities at the supplied stock. The shared quantity selector is controlled by its caller. Totals are calculated in cents. `localStorage` key `10x-shop.cart.v1` stores `{ version: 1, items: [...] }`, with only product ID, title, unit price, thumbnail, stock, and quantity. Missing, malformed, or unsupported data resets to an empty bag; storage failures keep the in-memory bag usable and show a notice. No sensitive data is stored. Prices and stock are snapshots, refreshed when that product is added again; they are not live inventory guarantees. Cross-tab synchronization and checkout rules such as supplier minimum orders are not implemented. Checkout records an authenticated demonstration order without collecting payment.

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

## Frontend authentication

`/login` and `/register` use controlled React forms, basic client-side email checks, and the backend's 15–128-character password policy (counting Unicode characters, preserving spaces). The server remains authoritative for email validation. Registration displays the backend's neutral acknowledgement for both new and existing addresses and guides the user to login; it never claims that a new account was definitely created.

To choose the backend URL, copy `frontend/.env.example` to ignored `frontend/.env.local` and set `VITE_API_BASE_URL="http://localhost:3000"` (also the default when unset). Restart Vite after changing it, or rebuild for production. This is a public API base URL only: Vite embeds `VITE_*` values in browser code. Never put `JWT_SECRET`, Neon URLs, passwords, or other secrets in frontend environment variables. Keep the browser's frontend origin in the backend's `FRONTEND_ORIGINS` list. The frontend and backend must both be running for real authentication requests.

`frontend/src/api/auth.ts` validates the actual login, registration, and public-user response contracts. Login calls `/auth/me` with a bearer header before populating `AuthContext`; unconfirmed or rejected tokens never become authenticated state. The context uses a small reducer in `frontend/src/auth/`, keeps the short-lived token only in React memory, and exposes it to authenticated API consumers alongside the current user, status, login/logout, and registration actions. Logout and session expiry remove the token and user. Requests time out, cancel on navigation/unmount, and cannot restore a stale login after logout. Pending submissions disable their controls and block duplicate clicks; HTTP, validation, rate-limit, network, and invalid-response failures use safe messages.

**Intentional limitation:** there are no refresh tokens or persisted sign-in sessions. A full refresh, new tab, or closing the page returns to guest state. Nothing auth-related is written to localStorage, sessionStorage, or cookies. The bag still uses its separate localStorage entry. Internal storefront links use React Router so ordinary navigation preserves the in-memory session. `/account` shows safe public details for a confirmed user and a login prompt for guests; the frontend prompt is not a replacement for backend authorization.

Run `npm test --workspace frontend` for the existing tests plus auth response handling, neutral registration acknowledgements, validation, cancellation, invalid/expired tokens, logout, and guest-state protection. These tests mock fetch and create no live accounts. STEP 009B browser verification used an isolated mock API. STEP 009C verified the real registration/login/current-user/account/logout/refresh flow against Neon using exactly one explicitly approved disposable account on 21 October 2026.

## Backend orders (STEP 010A)

The storefront uses this API for authenticated demonstration checkout and order history. `Order` belongs to `User`; `OrderItem` belongs to an order, with UUID primary keys, a DummyJSON product ID, title/price snapshots, quantity, integer-cent line totals, and timestamps. Orders include currency `USD`, integer-cent total, creation/update timestamps, and only `PENDING_PAYMENT` status. Snapshots preserve what was ordered even if the external catalog changes or disappears. There is no second product catalog in PostgreSQL. Foreign keys restrict deletion, and `(orderId, productId)` is unique.

**Migration status:** `backend/prisma/migrations/20261021000000_add_orders/migration.sql` was applied to the configured Neon development database on 21 October 2026 after explicit approval. Read-only checks confirmed the order enum/tables, supporting indexes, foreign keys, and checks; the initial User migration, User columns/indexes, and the existing test user remained unchanged. Both order tables were empty after deployment. On another database, inspect migration status and existing schema, obtain approval, then use `npm run prisma:migrate:deploy --workspace backend`. Never use `db push`, a reset, or ad hoc schema changes. The SQL includes checks for USD, positive product IDs, quantities 1–100, nonnegative cents, and line-total consistency; Prisma does not express these custom checks in its schema.

All order endpoints require `Authorization: Bearer <accessToken>` and use the existing JWT guard, including its current-user lookup. Missing/invalid/expired tokens and deleted users receive `401`. Responses use `Cache-Control: no-store`.

| Endpoint | Contract |
| --- | --- |
| `POST /orders` | JSON `items` only; 1–20 distinct products, each with integer `productId` (1–2,147,483,647) and integer `quantity` (1–100). Returns `201` with the saved order. Limited to 10 requests/minute/IP in the existing in-memory throttler. |
| `GET /orders` | Returns an array of the current user's latest 50 orders, newest first, with UUID descending as a tie-breaker. No pagination parameters yet. |
| `GET /orders/:id` | UUID path parameter; returns only an order owned by the current user. Missing and other users' orders both return `404`; malformed UUIDs return `400`. |

Safe example request body (use a signed-in local API client; keep bearer tokens out of logs/history):

```json
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 2, "quantity": 1 }
  ]
}
```

Unknown fields at either level are rejected with `400`, including `userId`, role, title, stock, price, currency, status, and totals. Duplicate products are rejected rather than merged. User identity comes exclusively from the guard. Public order responses contain `id`, `status`, `currency`, `totalCents`, `createdAt`, `updatedAt`, and `items`; each item exposes only `id`, `productId`, `title`, `quantity`, `unitPriceCents`, and `lineTotalCents`. No user relation, email, or auth fields are returned.

The backend fetches every product independently from the [DummyJSON single-product endpoint](https://dummyjson.com/docs/products) using native fetch, a fixed HTTPS host, no redirects/cache, and one 10-second deadline for the bounded batch. It validates matching ID, nonempty bounded title, finite nonnegative price, safe integer stock, and availability status before any database write. Prices round to the nearest USD cent as in the storefront. Unit/line/aggregate cents must be nonnegative safe integers no greater than **2,147,483,647** ($21,474,836.47), matching PostgreSQL `Int`; overflow is rejected, never capped. Zero prices are valid. The total is the sum of line totals only: no discounts, taxes, shipping charges, or payment processing.

Failure policy:

- Invalid input, duplicate products, or line/aggregate monetary overflow: `400`, no order.
- Missing products, `Out of Stock`/zero stock, or quantity exceeding current stock: `409`, no order.
- Upstream HTTP/network/timeout failures or malformed catalog data (including invalid prices): sanitized `503`, no order.
- Persistence failure: sanitized `503`; a Prisma transaction creates the order and all nested items atomically, rolling everything back on failure.
- Changed prices: the server's freshly fetched base price is authoritative, even if the browser's bag price is stale. The API does not accept a client price or perform a price-comparison/confirmation step. The checkout confirmation displays these authoritative totals. No payment step exists.

DummyJSON stock is demonstration data. It is checked but never reserved or decremented, so concurrent orders can reference the same stock. Supplier `minimumOrderQuantity` is not enforced; this demo follows the existing bag's 1-unit minimum. `PENDING_PAYMENT` does not mean paid, fulfilled, shipped, or inventory-reserved. Repeated successful POSTs create separate orders; idempotent checkout/retry handling is not implemented, so a client must not automatically retry an uncertain successful submission.

`npm test --workspace backend` runs focused order HTTP tests with the real guard/DTOs and mocked Prisma/catalog, covering validation, monetary bounds, catalog failures, transaction failure/rollback, snapshots, bounded listing, ownership, and safe responses. It creates no live orders. Database constraint definitions were checked read-only after migration deployment. Insertion/rollback behavior has not been exercised against PostgreSQL; mocks do not prove database rollback behavior. Use an explicitly approved isolated database for those checks without creating live orders.

## Checkout and order history (STEP 010B)

`/cart` links to `/checkout`. Guests are redirected to login with an allowlisted return to checkout while their persisted bag stays intact. Authenticated empty checkout redirects to `/cart` with feedback. Login and registration preserve only allowlisted internal destinations (`/checkout`, `/account`, `/orders`, or an order UUID route); external URLs and arbitrary query/hash destinations are rejected. Refreshing still signs the user out because JWTs remain only in React memory.

Checkout shows product images, quantities, line estimates, and an estimated subtotal. The only order payload is `{ "items": [{ "productId": 1, "quantity": 2 }] }`. The backend checks fresh catalog prices and stock; its total may differ from the bag estimate. The UI accepts a confirmation only after validating the server response, matching requested IDs/quantities, USD integer-cent bounds, line/aggregate consistency, and `PENDING_PAYMENT` status. It then clears the bag and displays the saved reference, title/price snapshots, and authoritative total on the checkout page. No payment form is present.

### CORE checkout form and navigation (STEP 013B)

The checkout form demonstrates controlled React inputs for **full name, email, address, and city**. Local validation requires a trimmed name of at least 3 characters, a valid email shape, an address of at least 5 characters, and a nonempty city, with bounded lengths. Errors are associated with their inputs and focus moves to the first invalid field. Pending submissions freeze the form and prevent duplicate requests; failed submissions retain the entered values and bag. An uncertain outcome still blocks repeat submission and directs the user to order history.

These contact/address values are demonstration-only: they stay in component memory, are shown on the immediate confirmation, and are never sent to the order API, persisted in browser storage, or added to order history. The form explicitly recommends sample details. No shipping is arranged. This preserves the original frontend form exercise alongside the lecturer-approved persistent-order extension without inventing a shipping contract or changing the backend. Refreshing or leaving checkout discards the form and its confirmation details.

Product cards now offer Add to Bag independently of their detail links. Each click checks a single product's fresh details (the list response omits stock), then reuses the existing stock-bounded cart reducer. Pending clicks are blocked; availability/network failures leave the bag intact. Header links indicate the active destination on desktop and mobile; logout returns to `/products` while preserving the bag. The editorial homepage remains at `/`, and the catalog remains at `/products`.

Run `npm test --workspace frontend` for form validation and existing checkout API regressions. On the Vite development server, `/tests/checkout.html` runs client-side assertions for redirects, validation, pending/failure/uncertain/success states, exact request payload, transient form values, card stock checks, and logout. All fetches and localStorage operations in this fixture are replaced with in-page mocks; it cannot write to Neon or alter the browser's saved bag. `?case=form` and `?case=card` keep the corresponding fixtures visible for responsive inspection. These entries are excluded from production builds.

`frontend/src/api/orders.ts` uses the existing public `VITE_API_BASE_URL` and the memory-only token in an Authorization header; it sends no browser prices, stock, user IDs, or product metadata. Authenticated `/orders` lists the latest 50 orders, and `/orders/:id` loads one server-authorized order. Both support loading/error states; history has an empty state, details have a not-found state, and the account page links to history. Responses and confirmations live only in React memory; they are discarded on logout, session expiry, or account changes. A `401` clears authentication without clearing the bag. Server-side ownership remains the security boundary; a missing/other-user order has the same not-found response.

A pending submission disables its action and uses an immediate request guard against duplicate clicks. No order POST is retried automatically. Failure leaves the bag unchanged. A network failure, timeout, server error, or invalid success response may leave the outcome uncertain: checkout directs the user to order history and disables further submission on that view, rather than claiming failure or blindly retrying. Leaving while pending aborts the browser request but cannot undo a server-side write; inspect history after signing in again before another attempt. The backend has no idempotency key yet. These remain demonstration orders, with no payment, fulfillment, shipping, or inventory reservation.

Run `npm test --workspace frontend` for order payload/response validation, public-field projection, auth requirements, safe return paths, checkout limits, pending/confirmed cart-clearing behavior, cancellation, uncertainty handling, listing, and not-found handling. Browser success-flow tests must use an isolated mock API unless creating live Neon orders is explicitly approved. A temporary `VITE_API_BASE_URL=http://localhost:3219` override can point Vite to that mock without changing local environment files. Never place signing secrets, database URLs, or persistent JWTs in frontend configuration or storage.

## Commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start both apps with file watching |
| `npm run dev:frontend` | Start only Vite |
| `npm run dev:backend` | Start only NestJS |
| `npm run typecheck` | Typecheck both apps |
| `npm run lint` | Lint frontend TypeScript and React Hooks; fail on warnings |
| `npm test --workspace frontend` | Run catalog/detail API, cart reducer/storage, and frontend auth/order tests with Node's built-in test runner |
| `npm test --workspace backend` | Build and run isolated authentication/order HTTP tests with mocked Prisma and catalog |
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

### Frontend code quality and debugging (STEP 014A)

`frontend/eslint.config.mjs` uses ESLint's flat configuration, core recommended rules, and typescript-eslint recommended rules. It explicitly enforces `@typescript-eslint/no-explicit-any` and `react-hooks/rules-of-hooks` as errors, with `react-hooks/exhaustive-deps` as a warning, matching Annex A, T1. `--max-warnings 0` makes warnings fail the lint command so dependency warnings cannot be missed. TypeScript's separate strict typecheck remains required; type-aware linting, formatting rules, and React Compiler-specific rules are not added.

The root `npm run lint` delegates to the frontend workspace. It checks `src/**/*.ts`, `src/**/*.tsx`, and `vite.config.ts`; generated/build/dependency/coverage directories and tests (including development-only browser fixtures) are excluded. Browser fixture TSX still participates in the existing typecheck, and tests run separately. The frontend-local scope does not traverse backend code or unrelated root skill directories. No backend lint setup existed, and this step does not introduce one. This follows the [typescript-eslint flat-config setup](https://typescript-eslint.io/packages/typescript-eslint/), with only the two React Hooks rules required by the specification.

`DEBUG-LOG.md` follows Annex A, O2 and documents three independently reproduced historical defects, real fix commits, regression evidence, and lessons learned. It distinguishes retrospective reproduction from original incident records and does not count deliberately injected Error Boundary errors as bugs.

### Catalog discovery (STEP 011A)

`/products` stores search (`q`, up to 100 characters), category slug (`category`), sort (`price-asc`, `price-desc`, `rating-desc`), and positive page number (`page`) in React Router search parameters. Defaults are all products, catalog order, page 1. Invalid parameters reset safely; pages beyond the result set redirect to the last page. Search updates after 300ms using history replacement; category, sorting, and pagination support back/forward navigation. Changing a filter resets the page.

Categories come from DummyJSON. Search, category-only, and unfiltered requests use server sorting and `limit=12`/`skip`. [DummyJSON](https://dummyjson.com/docs/products) does not combine search and category: category parameters on search and search parameters on category are ignored. For both filters together, we request **all** search matches (`limit=0`), verify the complete response, filter by category, then paginate locally. Server sorting occurs before filtering, so it applies to the entire matching set. This small demonstration catalog makes that tradeoff reasonable; a large catalog would need a backend supporting combined queries. Requests are aborted on navigation and outdated responses are ignored. No catalog dependencies were added.

### Reliability and React optimization (STEP 012)

The homepage, Header/Footer/Layout, router, and Context providers remain eager. Other page modules use `React.lazy`, declared outside `App` so resolved imports are cached. Login/register share one page module, as do order list/details. One Suspense boundary inside the layout announces route-code loading while keeping navigation visible. Existing fetch loading/error/retry states stay separate: Suspense does not handle these effect-based requests.

A reusable class ErrorBoundary surrounds the application, with another around routed content. A page render failure or rejected lazy import shows a safe fallback while the shared shell survives; changing pathname resets the route boundary. Reload recovery also covers failed/cached chunk imports after a deployment. Reloading ends the memory-only sign-in session; no request is automatically resubmitted. After a checkout interruption, sign in and inspect order history before attempting another order. Boundaries do not catch event-handler errors, arbitrary asynchronous failures, or errors in their own fallback. [React's boundary documentation](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) explains those limits.

Existing optimizations were retained: 300ms search debouncing, AbortController cleanup and stale-response guards, catalog-query `useMemo`, stable auth callbacks, pagination, and lazy product-image loading. `React.memo(ProductGrid)` skips unchanged cards while the catalog search draft changes; new product arrays still render. Context consumers must still update when auth/cart state changes. Cart totals are small and already validated, so no speculative caching, new context layers, or blanket memoization was added.

Measured with the same local Vite production build: initial JavaScript changed from **334.42 kB (101.18 kB gzip)** to **291.07 kB (92.14 kB gzip)**. Seven page chunks and automatically shared modules are loaded when needed. All JavaScript chunks combined are approximately **339.27 kB (110.80 kB gzip)**: splitting reduces initial work, not total application size. CSS changed from 21.81 kB to 22.42 kB. These are emitted asset sizes, not measured latency or frame-rate improvements.

#### Reproducible debugging workflow

1. Run `npm run dev:frontend`; use the configured backend only when needed. Open browser DevTools Console and Network, enable Preserve log, then visit `/`, `/products?q=phone`, a product detail, `/login`, and guest `/orders`/`/checkout`. Inspect failures and React warnings without copying credentials, bearer headers, or full auth responses into reports. Do not submit real accounts/orders for debugging.
2. In React DevTools Profiler, record typing in the catalog search field. The parent updates immediately; the unchanged ProductGrid should skip those renders. After 300ms, Network should show the new query. Rapid typing/navigation cancels outdated requests. Development StrictMode intentionally runs an extra effect setup/cleanup, so an aborted initial GET is expected; do not remove StrictMode to hide it. Requests should not keep looping after the UI settles.
3. Disable cache and throttle the connection to inspect route loading. Navigate from the homepage to a page not yet visited; the shell should stay visible. Revisiting a resolved page reuses its module. Use `npm run build --workspace frontend` and `npm run preview --workspace frontend` to inspect the actual split production chunks; Vite development modules are not production bundle sizes.
4. Open `/tests/reliability.html` on the Vite development server. It automatically checks client-side render-error capture, route recovery, pending/resolved/rejected lazy imports, and skipped/updated product renders. It makes no API writes. `?case=error` and `?case=loading` show persistent fallback fixtures for keyboard/responsive inspection; Return home leaves the error fixture. Reload repeats that deliberately injected error. These test entries are not included in the production build.
5. Run `npm test --workspace frontend` for the existing regressions plus boundary output/reload and a real lazy route test. The tests reuse Vite's installed TSX transformer without a listening server or new dependency. Server rendering alone cannot prove client error capture; the browser assertions cover that separately. Run root typecheck/build, backend tests, and `git diff --check` before review.

The original graduation PRD and Annex A were located in the accessible workspace and audited in STEP 013A. PLAN.md still lists general milestones and REPORT.md remains a report template; completing submission documentation is planned for STEP 014. The backend extension does not replace the original assessed frontend requirements.
