# 10X Shop — graduation report

**Author:** Lasha Abramishvili. **Documentation review:** 26 October 2026, STEP 017A; production evidence dated 25 October. This submission-oriented report follows Annex A, D3. Dated local measurements below remain historical; current production results are recorded separately. Final owner acceptance and submission are pending before 6 November, 23:59 Georgia time.

## Goal, scope and delivered work

The goal is a responsive storefront demonstrating React components/state/effects, Router/Context, strict TypeScript, Tailwind v4 and optimization/debugging. DummyJSON remains the only product catalog. The lecturer allowed a real backend extension, as confirmed by the student; NestJS authentication and Neon orders are additional work, not original mandatory frontend requirements.

| Module | Planned CORE | Delivered / remaining |
| --- | --- | --- |
| React | Layout/routing, catalog/details, cart, controlled login/checkout, Context/effects | Implemented; four-field checkout added in 013B. Exact route/copy/cart details remain flagged in REQUIREMENTS. |
| TypeScript | Strict typed props/state/API data, no `any`, typecheck/lint | Implemented, with boundary validation, typed reducers/unions and safe money. |
| Tailwind | v4, responsive flex/grid, interactive states | Implemented with tokens, local typography, focus and reduced-motion styles; complete cross-browser/accessibility evidence pending. |
| Optimization/debugging | Error recovery, responsive behavior, genuine debugging evidence | Boundary/recovery, both required lifecycle methods and DEBUG-LOG exist. Production Lighthouse evidence is recorded below; Sources/Profiler demonstrations remain incomplete. |
| Project process | Repository/history, README, PLAN, REPORT, working deploy | Deployment is live; repository visibility, comprehensive final QA and submission remain unverified or unfinished. |

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
| Lighthouse before / after | Measured 25 October; see production comparison below. |
| Tracked commits / distinct author dates | Historical: 14 commits / 4 dates at `a5c5f6f`. Recount at final submission; no current process count claimed. |
| Merged PRs / closed issues | Not verified from hosting service; no count claimed. |
| Hours by epic | Not recorded; no retrospective time-sheet total invented. |
| Live URL / browser compatibility matrix | Frontend/backend live; full Chrome/Firefox matrix not completed. |

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

The [frontend](https://10x-shop-lasha.vercel.app/) is Vercel Ready and the [backend](https://one0x-shop-lasha.onrender.com/) is Render Live at `24107f8f701841e09c7dfc912e5ad6b32623eeab`; Neon uses an isolated production project confirmed by the owner. The public [health endpoint](https://one0x-shop-lasha.onrender.com/health) returned HTTP 200 with `{"status":"ok"}` on 25 October. This is a point-in-time check, not continuous database monitoring. Render Free can cold-start. See [DEPLOYMENT.md](DEPLOYMENT.md) for settings, verification scope and remaining operational QA. No production data was changed during this review.

Other limits: per-process in-memory rate limiting, memory-only sessions, no idempotency key, latest-50 order history without paging, no stock reservation, no contact/address persistence and dependence on DummyJSON/CDN. Combined filters load all search matches. Bag money uses a safe-integer bound; the backend applies the tighter PostgreSQL bound and can reject an oversized selection. Supplier minimum quantities, cross-tab cart synchronization, taxes, payments and shipping are not implemented.

STEP 014C adds generic development-only `componentDidCatch` diagnostics and native Clear bag confirmation. Some route/copy/active-link and pagination-scroll details still differ from Annex A. REQUIREMENTS tracks corrections or lecturer clarification. Comprehensive Chrome/Firefox/device QA, keyboard/contrast evidence and Sources/Profiler demonstrations remain outstanding; measured Lighthouse results follow below. Local test passes are not graduation sign-off.

## What I would do differently / next improvements

Map the rubric before expanding the backend, keep the plan current, record debugging/time evidence when work happens, and deploy a minimal version earlier to expose CORS/SPA issues. Before real commerce use, design idempotent writes, inventory/payment workflows, shared rate-limit storage and operational monitoring separately; the demo does not imply them.

Next: resolve remaining CORE variations with the lecturer, complete browser/keyboard and process evidence, and obtain owner acceptance using the REQUIREMENTS checklist. Optional FULL work must not consume the 1–4 November study buffer. Theory is 5 November; submission closes 6 November at 23:59 UTC+4.

## AI assistance and credits

- OpenAI Codex assisted inspection, implementation, tests, reviews and documentation; the project is not represented as unaided work.
- The student set scope, confirmed lecturer approval and separately authorized commits and live test writes.
- TypeScript, ESLint, tests and targeted browser checks verified changes; AI statements alone are not evidence of correctness.
- Explicit constraints avoided unnecessary state/UI libraries and excluded payment/admin/AI features; invented history/debugging evidence is not accepted.
- No turnkey auth service was used; secrets/test passwords remain private. No complete prompt-by-prompt AI log is claimed.
- The student must understand and explain the code and limitations during defense; assistance does not replace preparation.

Data/images: DummyJSON. Font/photo provenance: [README credits](README.md#credits-and-defense-notes) and [ASSET-LICENSES.md](frontend/public/images/ASSET-LICENSES.md). STEP 017A documentation is owner-approved; final graduation acceptance evidence remains pending.

## STEP 016C — targeted security and robots correction, 25 October 2026

This dated addendum records local changes after the historical snapshot above; it does not claim deployment or replace earlier measurements.

Only two transitive lockfile entries changed relative to the existing Neon CLI initialization work: `body-parser` **2.3.0 → 2.4.0** and `fast-uri` **3.1.8 → 3.1.9**. Both satisfy their parents' existing ranges. `package.json`, all other lockfile entries, and the Neon changes were preserved. No overrides, major upgrades, or automatic audit fixes were used.

The update removes the body-parser compressed-body denial-of-service advisory ([GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)) and four fast-uri parsing advisories: GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, and GHSA-333x-w4r6-6crp. The body-parser dependency handles backend requests; fast-uri is reached through Prisma tooling rather than application request handlers.

`npm audit` decreased from **3 high / 1 moderate** package entries to **2 high / 0 moderate**. Remaining entries are `multer@2.4.0` and its parent `@nestjs/platform-express@11.2.7`, both reflecting [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). The checked NestJS 11 adapter release, 11.2.8, still pins Multer 2.4.0; upgrading it would not fix this finding. No upload interceptors or asynchronous file filters were found in the app, so the advisory's required configuration is not currently present. Retain this residual risk and reassess before adding uploads; no downgrade or unsupported override was forced.

`frontend/public/robots.txt` now contains `User-agent: *` and `Allow: /`. Build output matches it exactly; Vite preview serves it as `text/plain`, while checked SPA routes and assets still resolve. The Vercel rewrite is unchanged; the correction adds the missing static file alongside existing public assets.

Validation passed: lint, both workspace typechecks/builds, **73 frontend tests**, **99 backend tests**, and `git diff --check`. Backend HTTP tests use mocked persistence and cover auth, validation, and malformed JSON. An additional isolated Express smoke check accepted valid gzip JSON, rejected trailing compressed bytes and malformed gzip JSON with HTTP 400, and confirmed the server stayed alive. No real users, orders, or database changes were made.

Release verification was pending at STEP 016C. The subsequent production checks below supersede that pending status. The audit counts above are the last recorded results, not a fresh 26 October npm audit; the dependency tree is not vulnerability-free.

## Production verification and Lighthouse — 25 October 2026

STEP 016E verified deployment of the responsive assets, robots.txt and favicon. Vercel Ready and Render Live identify commit `24107f8`, which includes security commit `a4812c0`. Render deployment/build evidence supports installation of the patched lockfile; runtime package versions were not directly introspected. The owner reports earlier successful full-stack smoke tests; the read-only production audit did not repeat registration or order creation.

STEP 016D preserved the approved layout, crop, alt text and CSS. The hero remains eager with `fetchPriority="high"`; intrinsic dimensions now match the original 1800×1350 source. A WebP `srcSet`/`sizes` and homepage-only HTML preload use matching candidate rules, with the original JPEG fallback. The collection card reuses the responsive family with its own sizes and lazy loading.

| Asset | Dimensions | Bytes |
| --- | --- | ---: |
| Original JPEG | 1800×1350 | 451,751 |
| WebP 640 | 640×480 | 45,058 |
| WebP 960 | 960×720 | 83,676 |
| WebP 1440 | 1440×1080 | 156,094 |
| WebP 1800 | 1800×1350 | 230,772 |

Production WebP URLs returned HTTP 200 with `image/webp`. At DPR 1, 390px and 1440px viewport checks selected 640px and 960px respectively, matching the preload rules; non-home routes had no hero preload. Local initial-load checks found one selected hero candidate. Production HAR-level duplicate-download counts and DPR 2/3 checks remain unverified. Targeted mobile/desktop checks found no horizontal overflow; they do not constitute a complete device/browser matrix.

Scores are Performance / Accessibility / Best Practices / SEO. All reports below were measured on **25 October 2026**; they are actual lab results, not targets.

| Run | Scores | FCP | LCP | TBT | CLS | Speed Index |
| --- | --- | --- | --- | --- | --- | --- |
| Historical mobile baseline | 77 / 100 / 100 / 92 | 2.1s | 5.1s | 10ms | 0 | 4.2s |
| Fresh mobile | 89 / 100 / 100 / 100 | 2.1s | 3.2s | 0ms | 0 | 4.4s |
| Repeat mobile | 87 / 100 / 100 / 100 | 2.3s | 3.4s | 0ms | 0 | 4.1s |
| Historical desktop baseline | 99 / 100 / 100 / 92 | 0.4s | 0.9s | 0ms | 0.002 | 0.4s |
| Fresh desktop | 100 / 100 / 100 / 100 | 0.4s | 0.4s | 0ms | 0.001 | 0.7s |

Sources: [baseline mobile](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/zkq2rvamcw?form_factor=mobile), [fresh mobile](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/pagsb4hugg?form_factor=mobile), [repeat mobile](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/haamg4ptsk?form_factor=mobile), [fresh desktop](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/pagsb4hugg?form_factor=desktop). Fresh paired run: 22:13:45 GMT+4; mobile repeat: 23:21:40 GMT+4.

The mobile LCP element remained the living-room hero, selecting the 960px WebP (about 81.7 KiB versus the original 441 KiB). Observed mobile LCP fell by 1.7–1.9s; FCP and Speed Index did not consistently improve. These separate production runs are not a controlled experiment or guaranteed future scores; no CrUX field-data result is claimed. Remaining mobile diagnostics include render-blocking CSS, font transfer/critical-chain cost and unused JavaScript. Audit savings estimates are not additive promises or grounds for a redesign before graduation.

Production [robots.txt](https://10x-shop-lasha.vercel.app/robots.txt) now returns plain-text `User-agent: *` and `Allow: /`, rather than the SPA shell. Fresh reports score SEO 100 with no failed scored SEO audits; no rewrite change was needed. Favicon SVG, 32px PNG and Apple touch icon returned successfully; the title remains **10X Shop**. A browser-tab visual check is not recorded here, and existing browser caches may retain an older icon.

Latest implementation validation (STEP 016D): lint, root typecheck/build, **75 frontend tests**, **99 backend tests**, and whitespace checks passed. Those checks were not rerun for STEP 017A's documentation-only changes; no coverage percentage or complete production-flow coverage is claimed. Acceptance gaps are tracked in [REQUIREMENTS.md](REQUIREMENTS.md#final-acceptance-checklist--26-october-2026).

### Preserved graduation evidence — 28 October 2026

[Historical Lighthouse screenshots](docs/lighthouse/README.md) preserve the 25 October PageSpeed measurements above: mobile performance 77 → 89 (repeat 87), desktop 99 → 100, and SEO 92 → 100. Screenshots were captured on 26 October and copied unchanged during STEP 018G; the current deployed build was not re-benchmarked in STEP 018F/018G.

[Browser QA evidence](docs/qa/README.md) records the 26 October Chrome 155 production guest smoke pass and partial Safari 26.6.2 coverage after STEP 018D. Firefox and human Safari typing remain unverified. Actual DevTools Console/Network screenshots, a Sources breakpoint capture, and React DevTools Components/Profiler captures remain outstanding; the preserved page screenshots do not replace them or establish complete cross-browser certification.
