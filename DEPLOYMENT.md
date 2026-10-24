# Deployment preparation — pending

STEP 015A prepares configuration only. No hosting account settings, public deployment, database branch, migration or live write has been performed. Public URLs and production behavior remain **unverified**.

## Recommended layout

Use Vercel for static frontend files, one Render Node web service for NestJS, and Neon PostgreSQL. Keep **both hosting project roots at the repository root** so the existing npm workspace lockfile and root TypeScript dependency are available. No Docker, serverless NestJS conversion or new service is needed.

Use Node **24.x** on both hosts and npm **11 or newer**. The installed NestJS 11, Prisma 7.10.1, Vite 7, ESLint 10 and Argon2 packages accept Node 24. The root engine is bounded to prevent a future Node major being selected automatically. Actual Linux Argon2 installation and cloud builds still need verification; do not disable install scripts or omit build-time development dependencies.

## Environment names and locations

| Name | Location | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Vercel frontend, Production scope | Public HTTPS NestJS base URL, without an API path prefix. Rebuild after changes. |
| `DATABASE_URL` | Render backend secret | Pooled connection for the chosen deployment database. |
| `DIRECT_URL` | Private migration environment; Render secret only if running migrations there | Direct connection to the **same** branch/database. Not needed by the running API. |
| `JWT_SECRET` | Render backend secret | Independent production signing key: 64 cryptographically random hexadecimal characters. |
| `FRONTEND_ORIGINS` | Render backend | Exact comma-separated HTTPS frontend origins, without trailing slashes, paths, queries, credentials or wildcards. |
| `NODE_ENV` | Render backend | Set to production. Public HTTP origins are always rejected; HTTP loopback origins work only outside production. |
| `PORT` | Render-provided backend environment | Backend listens on this port and `0.0.0.0`; local default is 3000. |
| `NODE_VERSION` | Optional Render runtime selection | Select Node 24.x if the service dashboard overrides the repository engine. |

Only the public API URL belongs in Vite configuration. Never add backend secrets to Vercel, `VITE_*`, browser storage, build arguments that print values, or Git. Do not publish authorization headers, credential responses or database URLs in screenshots/logs. Production platform variables replace local ignored environment files; do not upload those files.

Preview deployments must not automatically use production credentials or write to the deployment database. Leave backend-connected previews disabled until a separate test target and exact origin allowlist are arranged. Do not allow `*.vercel.app` or arbitrary request origins.

## Neon: decide isolation before deployment

Keep the existing development database private to local development. Before public testing, arrange a separate deployment database/branch and separate connection credentials with the owner. Prefer a clean schema-only branch or empty database to avoid exposing copied development accounts/orders. A normal Neon branch copies existing data, even though subsequent writes are isolated. If schema-only branching is used, inspect its migration history before proceeding; do not blindly baseline or replay migrations over existing tables. No branch/database is created by this milestone.

Both connections must use TLS. The safe backend example now uses `sslmode=verify-full`; retain any required Neon connection options, and never disable certificate verification to bypass a failure. Existing local secrets were not edited. The PrismaPg runtime pool already has a maximum of five connections and a ten-second connection timeout. Choose Render's region near the Neon region after checking availability.

Prisma 7 configuration is already split correctly: `prisma.config.ts` reads `DIRECT_URL` for CLI operations, and PrismaService uses `DATABASE_URL` through the PostgreSQL adapter. `npm run build --workspace backend` generates the client before compiling it. Generated sources are ignored and recreated on the host.

After explicit approval for the selected database target, an authorized operator should:

1. Inspect target identity and migration history without sharing credentials. Confirm the existing tracked migrations are appropriate; do not edit applied migrations.
2. From the repository root, run `npm run prisma:status --workspace backend` using the private direct connection. Pending migrations on a new empty target are expected.
3. Only after target/SQL review and approval, run `npm run prisma:migrate:deploy --workspace backend`, then repeat status and inspect the schema read-only.
4. Never use `db push`, `migrate reset`, automatic seeding, or destructive recovery. Stop on divergence or failure.

Migrations are deliberately absent from build/start commands. Render pre-deploy commands require a paid service; if using one later, configure the existing deploy script only after approval. On Free, use a separately authorized private migration session. Do not put database writes into a build merely to work around plan restrictions.

## Render backend settings

| Setting | Value |
| --- | --- |
| Service type | Node web service, one instance initially |
| Root directory | Repository root (leave blank) |
| Build command | `npm ci --include=dev && npm run build --workspace backend` |
| Start command | `npm start --workspace backend` |
| Health check path | `/health` |
| Environment | Backend names above; keep secrets server-side |

Keep auto-deploy disabled until the first release and migration sequence are reviewed. `npm ci` installs the locked workspaces; the build compiles only the backend. No migration runs on startup. The startup database check must succeed before NestJS listens. `GET /health` returns `{"status":"ok"}` once running, but it does **not** continuously query Neon: a later database outage can leave health green while auth/orders return sanitized errors.

### Availability and rate-limit limits

Render Free currently sleeps after 15 minutes idle, may take about one minute to wake, and has a shared monthly instance-hour allowance. It is a demonstration option, not an always-available production guarantee. Verify current plan limits, memory/build capacity, outbound database access, and native Argon2 installation before choosing it. Prefer an always-on paid instance for predictable exam/demo availability if the owner approves its cost. Do not implement artificial keep-alive traffic to evade plan limits. Neon may also suspend idle compute; verify its current plan, quotas, restore window and cold-start behavior.

The existing throttler uses per-process memory and does not trust forwarded headers. Behind Render's proxy, clients may share an IP bucket; redeploy/restart clears counters, and multiple instances would not share limits. Verify actual proxy behavior and two-client rate limiting before public testing. Do not set blanket `trust proxy=true` or trust arbitrary `X-Forwarded-For` values. If a bounded trusted-proxy configuration is needed, review the provider's actual chain separately and regression-test spoofing before changing it. No proxy-trust change is made here.

## Vercel frontend settings

| Setting | Value |
| --- | --- |
| Root directory | Repository root (`.`) |
| Framework preset | Vite |
| Node version | 24.x |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build --workspace frontend` |
| Output directory | `frontend/dist` |
| Environment | Only `VITE_API_BASE_URL` for the API connection |

The root `vercel.json` supplies the documented SPA fallback to `/index.html`, allowing direct requests to `/products/1`, `/account`, `/checkout`, and `/orders/:id` to reach React Router. Vercel checks filesystem routes before rewrites, so existing static assets take precedence over this fallback. This matches the documented Vite SPA configuration; confirm actual assets and deep links on the deployed host. Browser fixtures outside the build output are not deployed. This is a static SPA, not a Vercel-hosted NestJS API.

Choose the stable frontend production domain, configure that exact origin on Render, then set the Render HTTPS API URL in Vercel **before building**. Local `.env.local` is ignored by Git and must not be uploaded. The frontend has a localhost fallback for local use; a missing production setting would therefore break API calls. Check the deployed browser's request destination. A successful Vite build alone does not prove the production URL was set correctly.

## Safe release verification — still pending

1. Review this diff and hosting plan costs/limits. Confirm database isolation, secrets, target migrations and exact domains privately before deployment. This guide does not authorize live schema changes or writes.
2. After separately authorized migration/deployment, check the public API `/health`, then open the static frontend. Confirm HTTPS, assets, actual API destination and exact-origin CORS/preflight. Check that an unlisted origin receives no allow-origin header; CORS is not authentication or a block on non-browser clients.
3. Refresh direct catalog/detail/cart/login/account/checkout/orders URLs and an unknown route. Confirm React Router recovery rather than a hosting 404, and no fixture output in deployed assets.
4. Verify guest/protected views and unauthenticated `/auth/me` (`401`) without creating data. Do not repeatedly submit invalid credentials and trigger rate limits during basic connectivity checks. Do not capture tokens or private request bodies in evidence.
5. Verify proxy/rate-limit behavior, cold/warm startup, database-outage handling and desktop/mobile behavior. Keep native Clear bag keyboard/Escape/confirmation/refresh QA explicit until observed.
6. Successful registration/order tests require separate approval and a designated disposable account. Never retry an uncertain order automatically; inspect history/database read-only first. JWTs remain memory-only, so refreshing signs the user out while the bag persists. No payment, shipping or stock reservation occurs.
7. Record tested public URLs, actual browser matrix and Lighthouse evidence in README/REPORT/REQUIREMENTS. Deployment and final QA remain pending until these checks are observed.

## Local verification for STEP 015A

Lint, root typecheck/build, 73 frontend tests, 99 backend tests (including explicit public-origin/preflight cases), and `git diff --check` pass. Local connection configuration was inspected without connecting: both URLs request TLS, runtime is pooled, CLI is direct, and both identify the same target. No configured backend secret was found in tracked files or generated frontend JavaScript; private environment paths are absent from the index/history. SPA configuration JSON and Node engine/lockfile consistency were checked locally. The rewrite matches Vercel’s documented Vite SPA configuration and filesystem-before-rewrite routing order. Actual hosted routing, cloud installation, live TLS connectivity, proxy behavior and production availability remain unverified.

## References checked during preparation

- [Render Node versions](https://render.com/docs/node-version), [port binding](https://render.com/docs/web-services#port-binding), [health checks](https://render.com/docs/health-checks), [Free limitations](https://render.com/docs/free), [pre-deploy commands](https://render.com/docs/deploys#pre-deploy-command).
- [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Vite SPA rewrites](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas), [routing order](https://vercel.com/docs/routing#routing-order), [Hobby plan](https://vercel.com/docs/plans/hobby). Confirm personal/non-commercial eligibility and quotas in the actual account before use.
- [Neon TLS](https://neon.com/docs/connect/connect-securely), [branch isolation](https://neon.com/docs/introduction/branching), [scale to zero](https://neon.com/docs/introduction/scale-to-zero), [NestJS proxy/rate-limit guidance](https://docs.nestjs.com/security/rate-limiting#proxies).

Hosting defaults and quotas change; recheck these sources and account settings at deployment time.
