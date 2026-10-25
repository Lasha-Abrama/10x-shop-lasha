# 10X Shop — graduation report

**Author:** Lasha Abramishvili. **Snapshot:** 24 October 2026, STEP 014B, before deployment. This submission-oriented draft follows Annex A, D3. Live links, production QA and final metrics still need updating before 6 November, 23:59 Georgia time.

## Goal, scope and delivered work

The goal is a responsive storefront demonstrating React components/state/effects, Router/Context, strict TypeScript, Tailwind v4 and optimization/debugging. DummyJSON remains the only product catalog. The lecturer allowed a real backend extension, as confirmed by the student; NestJS authentication and Neon orders are additional work, not original mandatory frontend requirements.

| Module | Planned CORE | Delivered / remaining |
| --- | --- | --- |
| React | Layout/routing, catalog/details, cart, controlled login/checkout, Context/effects | Implemented; four-field checkout added in 013B. Exact route/copy/cart details remain flagged in REQUIREMENTS. |
| TypeScript | Strict typed props/state/API data, no `any`, typecheck/lint | Implemented, with boundary validation, typed reducers/unions and safe money. |
| Tailwind | v4, responsive flex/grid, interactive states | Implemented with tokens, local typography, focus and reduced-motion styles; complete cross-browser/accessibility evidence pending. |
| Optimization/debugging | Error recovery, responsive behavior, genuine debugging evidence | Boundary/recovery, both required lifecycle methods and DEBUG-LOG exist. Lighthouse/tool-demonstration evidence pending. |
| Project process | Repository/history, README, PLAN, REPORT, working deploy | Documents updated here; deployment, public access checks, final QA and submission unfinished. |

The completed/partial/missing/unverified checklist is [REQUIREMENTS.md](REQUIREMENTS.md). Selected FULL work includes discovery/URL state, order history, persistence, generics/type guards, lazy loading and tokens. Formik/Yup, dark mode, reviews, related products, promo codes, editable profile and the complete FULL process/evidence package are not delivered. Optional examples do not become mandatory architectures merely because they appear in Annex A.

## Design and architecture decisions

The editorial design uses generous whitespace, neutral paper/ink/olive tokens, DM Sans and Libre Caslon Display. Tailwind handles layout and interactive states; shared CSS provides typography, focus and reduced-motion behavior. Header/Footer/Layout, cards, gallery, quantities and order summary keep presentation consistent without a UI library.

Native fetch and small API modules keep data handling explicit. `useState`/`useEffect` manage loading/error/empty/retry/cancellation. Search uses validated Router parameters and a 300ms debounce with history replacement. The established DummyJSON integration cannot directly combine search/category: all sorted search matches are verified as complete, filtered by category, then paginated. This works for the small demo catalog but would not scale like a backend supporting combined queries.

Cart Context uses a pure reducer; only validated versioned product snapshots persist. Auth Context confirms login with `/auth/me` and keeps a short-lived JWT in memory. Refresh signs out while preserving the bag. No Redux, query framework, form framework or Axios is needed to demonstrate these concepts.

Prisma models User, Order and OrderItem. NestJS validates DTOs, hashes passwords with Argon2id, verifies JWTs, reloads protected users and enforces ownership in order queries. Before a transaction, it independently fetches DummyJSON products and computes bounded integer-cent totals. Nested item creation is atomic; title/price snapshots preserve history without introducing another product catalog.

## Approved extension versus original simulation

The original assignment uses simulated login and local order confirmation. Controlled forms and Context remain visible here, but the project's NestJS code verifies credentials and orders persist in Neon. Full name, email, address and city are a **frontend demonstration exercise**: values stay in component memory and appear only in immediate confirmation. They never enter the API payload, localStorage, URLs or order history.

Orders send only product IDs/quantities. Browser totals are estimates; server values are authoritative. Successful orders remain **PENDING_PAYMENT**. No real payment, shipping, fulfillment or stock reservation occurs. There is no built-in public demo password; the assignment's DummyJSON login does not authenticate here. Arrange reviewer access privately; this report creates no account/order.

The editorial homepage is `/` and catalog `/products`, unlike the assignment's catalog-at-root convention. Real email authentication and read-only account details also differ from the simulation. These variations and literal UI gaps are disclosed in REQUIREMENTS, not silently counted as exact compliance. Lecturer approval is reported by the student; a written approval artifact is not in the repository.

## Three substantial technical challenges

1. **Monetary correctness:** a finite `1e308` price passed the old parser but could overflow cents calculations. Shared validation now protects API data, formatting, reducer operations and stored carts; backend arithmetic also respects PostgreSQL `Int` bounds.
2. **Boundary validation and recovery:** valid empty out-of-range pages were rejected, while prefix-only image checks accepted malformed URLs. Parsing now distinguishes valid empty pages and checks parseable HTTP(S) images.
3. **Uncertain order confirmation:** the server can save an order while the response is lost. The client clears the bag only after validated confirmation, preserves it on errors and blocks another submit on an uncertain view. This mitigates duplicates but does not provide server idempotency across navigation/reload.

[DEBUG-LOG.md](DEBUG-LOG.md) records three distinct defects in the required symptom/reproduction/tool/root-cause/fix/lesson format: overflow (`892fec2`), empty-page validation (`0c9a5c8`) and malformed image URLs (`da9af80`). The latter two were reproduced retrospectively from Git snapshots in STEP 014A; original discovery dates/tools are not claimed. Intentional Error Boundary fixture errors are not counted as incidents.

## Optimization and measured bundle results

STEP 012 kept the homepage/shared shell/providers eager and split other page modules with `React.lazy`/Suspense. `React.memo(ProductGrid)` skips unchanged arrays during draft typing; new products and Context changes still render. Existing debounce, cancellation, pagination, stable auth callbacks and lazy card images were retained. Small totals were not speculatively memoized.

Historical comparable local Vite production measurements were recorded in `07848ae` (before: `0c9a5c8`; after: `07848ae`). Values below are **decimal kB of emitted JavaScript, gzip**, not uncompressed size or timings:

| Measurement | Before route splitting | After STEP 012 |
| --- | --- | --- |
| Initial JavaScript gzip | 101.18 kB | 92.14 kB |
| All JavaScript chunks gzip, summed | 101.18 kB | 110.80 kB |

Splitting reduced initial JS but increased the combined compressed chunk total. These figures **do not prove runtime latency, frame-rate or Lighthouse improvements**. They describe that historical change, not today's larger app. The STEP 014B build reports initial JS **292.89 kB uncompressed / 92.72 kB gzip**, CSS **22.75 kB uncompressed / 5.45 kB gzip**, and 74 transformed modules. Current results must not replace the STEP 012 after measurement.

| Submission metric | Evidence at this snapshot |
| --- | --- |
| Lighthouse before / after | Not measured; no reports/scores claimed. Capture a genuine deployed baseline, then an after result only if a real change is made. |
| Tracked commits / distinct author dates | 14 commits / 4 dates at `a5c5f6f`, measured from Git. STEP 014B is uncommitted; recount for final submission. |
| Merged PRs / closed issues | Not verified from hosting service; no count claimed. |
| Hours by epic | Not recorded; no retrospective time-sheet total invented. |
| Live URL / browser compatibility matrix | Not available / not completed. |

## Testing and verification

Verification repeated for STEP 014B on 24 October 2026:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass: zero frontend errors/warnings; dependency warnings fail the command. |
| `npm run typecheck` | Pass: both workspaces, strict TypeScript. |
| `npm run build` | Pass: frontend production chunks and backend compilation/client generation. |
| `npm test --workspace frontend` | 71 passing tests. |
| `npm test --workspace backend` | 97 passing tests, including nested cases. |
| `git diff --check` | Pass. |

Frontend Node tests mock fetch and cover response/URL validation, money, cart/storage recovery, auth, checkout/order payloads, uncertainty, form validation and reliability. Backend tests use real local HTTP, DTOs, Argon2/JWT operations and mocked Prisma/catalog; they do not touch Neon. Mock transaction failures test application handling, not PostgreSQL rollback guarantees. No database operation or live write was performed in STEP 014B.

At STEP 014B, development browser fixtures provided 22 checkout assertions with isolated fetch/storage mocks and 14 reliability assertions. They passed in earlier local checks, not a committed cross-browser matrix or production report. STEP 014A finalization smoke-tested real DummyJSON search/category/sort/pagination, back/forward and cancellation of an unfinished draft without console warnings. That is earlier evidence, not a new STEP 014B browser session.

STEP 014C verification (24 October 2026): lint, root typecheck/build, 73 frontend tests, 97 backend tests and whitespace checks pass. The isolated browser fixtures passed 27 checkout/cart assertions and 14 reliability assertions; cancellation preserves items/storage and acceptance persists one clear update. Cart screenshots were inspected at 1440px and 375px, with no mobile horizontal overflow. Native dialog automation timed out and the bag subsequently cleared before a dialog handle was available; native keyboard activation, Escape/confirmation and refresh persistence remain manual QA items. Finalization reproduced a timeout on keyboard activation without an inspectable dialog; no native keyboard pass is claimed. The isolated fixture resets its mock storage on reload, so it cannot verify real refresh persistence. No live API writes were made. Production output excludes the browser fixtures and development diagnostic.

Error Boundaries handle descendant render failures and lazy-import rejection. They do not catch ordinary API failures or every asynchronous/event-handler error. Existing fetch error states remain separate. Diagnostics never include error objects, stack traces or user content; no external reporting was added.

Previous project sessions separately authorized real auth/checkout verification. No current record count, password, order ID or fresh live-flow result is inferred here. Dedicated test credentials remain private.

### Reproducible debugging workflow

Run the frontend locally and inspect Console and Network while loading/searching the catalog, retrying an offline failure and navigating to lazy pages. Never copy auth headers or credential responses into evidence. In Sources, break inside an API parser or reducer and inspect narrowed input/state; in React DevTools Components/Profiler, inspect Context and compare draft typing with the memoized grid. Development StrictMode can deliberately start/abort an initial GET; a continuing request loop is different. Capture actual observations before claiming those tool demonstrations complete. The development-only reliability fixture demonstrates render fallback/recovery without injecting failures into production source.

## Limitations and deployment status

No public deployment is verified. STEP 015A prepares exact HTTPS frontend origins (HTTP loopback only outside production), explicit public port binding and Vercel SPA rewrites; deployed behavior remains unverified. See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting commands, isolation/migration review and rate-limit/cold-start limitations. Use backend-only secrets, reviewed Neon migrations, explicit HTTPS origins and frontend SPA rewrites. Publish live links only after testing them.

Other limits: per-process in-memory rate limiting, memory-only sessions, no idempotency key, latest-50 order history without paging, no stock reservation, no contact/address persistence and dependence on DummyJSON/CDN. Combined filters load all search matches. Bag money uses a safe-integer bound; the backend applies the tighter PostgreSQL bound and can reject an oversized selection. Supplier minimum quantities, cross-tab cart synchronization, taxes, payments and shipping are not implemented.

STEP 014C adds generic development-only `componentDidCatch` diagnostics and native Clear bag confirmation. Some route/copy/active-link and pagination-scroll details still differ from Annex A. REQUIREMENTS tracks corrections or lecturer clarification. Comprehensive Chrome/Firefox/device QA, keyboard/contrast evidence, Sources/Profiler demonstrations and Lighthouse remain outstanding. Local test passes are not graduation sign-off.

## What I would do differently / next improvements

Map the rubric before expanding the backend, keep the plan current, record debugging/time evidence when work happens, and deploy a minimal version earlier to expose CORS/SPA issues. Before real commerce use, design idempotent writes, inventory/payment workflows, shared rate-limit storage and operational monitoring separately; the demo does not imply them.

Next: small CORE corrections, deployment, production QA/Lighthouse, then final links/metrics/checklist updates. Optional FULL work must not consume the 1–4 November study buffer. Theory is 5 November; submission closes 6 November at 23:59 UTC+4.

## AI assistance and credits

- OpenAI Codex assisted inspection, implementation, tests, reviews and documentation; the project is not represented as unaided work.
- The student set scope, confirmed lecturer approval and separately authorized commits and live test writes.
- TypeScript, ESLint, tests and targeted browser checks verified changes; AI statements alone are not evidence of correctness.
- Explicit constraints avoided unnecessary state/UI libraries and excluded payment/admin/AI features; invented history/debugging evidence is not accepted.
- No turnkey auth service was used; secrets/test passwords remain private. No complete prompt-by-prompt AI log is claimed.
- The student must understand and explain the code and limitations during defense; assistance does not replace preparation.

Data/images: DummyJSON. Font/photo provenance: [README credits](README.md#credits-and-defense-notes) and [ASSET-LICENSES.md](frontend/public/images/ASSET-LICENSES.md). This report awaits owner review and post-deployment updates.

## STEP 016C — targeted security and robots correction, 25 October 2026

This dated addendum records local changes after the historical snapshot above; it does not claim deployment or replace earlier measurements.

Only two transitive lockfile entries changed relative to the existing Neon CLI initialization work: `body-parser` **2.3.0 → 2.4.0** and `fast-uri` **3.1.8 → 3.1.9**. Both satisfy their parents' existing ranges. `package.json`, all other lockfile entries, and the Neon changes were preserved. No overrides, major upgrades, or automatic audit fixes were used.

The update removes the body-parser compressed-body denial-of-service advisory ([GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)) and four fast-uri parsing advisories: GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, and GHSA-333x-w4r6-6crp. The body-parser dependency handles backend requests; fast-uri is reached through Prisma tooling rather than application request handlers.

`npm audit` decreased from **3 high / 1 moderate** package entries to **2 high / 0 moderate**. Remaining entries are `multer@2.4.0` and its parent `@nestjs/platform-express@11.2.7`, both reflecting [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). The checked NestJS 11 adapter release, 11.2.8, still pins Multer 2.4.0; upgrading it would not fix this finding. No upload interceptors or asynchronous file filters were found in the app, so the advisory's required configuration is not currently present. Retain this residual risk and reassess before adding uploads; no downgrade or unsupported override was forced.

`frontend/public/robots.txt` now contains `User-agent: *` and `Allow: /`. Build output matches it exactly; Vite preview serves it as `text/plain`, while checked SPA routes and assets still resolve. The Vercel rewrite is unchanged; the correction adds the missing static file alongside existing public assets.

Validation passed: lint, both workspace typechecks/builds, **73 frontend tests**, **99 backend tests**, and `git diff --check`. Backend HTTP tests use mocked persistence and cover auth, validation, and malformed JSON. An additional isolated Express smoke check accepted valid gzip JSON, rejected trailing compressed bytes and malformed gzip JSON with HTTP 400, and confirmed the server stayed alive. No real users, orders, or database changes were made.

Pending release and production verification: confirm deployed dependency versions and `/robots.txt` status/MIME/body, then rerun Lighthouse. The [25 October measured baseline](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/zkq2rvamcw?form_factor=mobile) remains mobile **77 / 100 / 100 / 92** and desktop **99 / 100 / 100 / 92** (Performance / Accessibility / Best Practices / SEO). No post-change score or production SEO improvement is claimed.
