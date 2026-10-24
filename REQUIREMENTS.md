# Requirements traceability

Snapshot: **24 October 2026**, STEP 015A, before deployment. Sources inspected: **10X-Shop-Graduation-Project-PRD.docx**, version 1.1, and **დანართი A.docx (Annex A)** in the accessible workspace. Neither is committed here. English descriptions summarize named sections, not invented requirements. Lecturer approval of the backend extension is confirmed by the student; no written approval artifact is in the repository.

**Status:** COMPLETE = named implementation/evidence exists; PARTIAL = specified details remain; MISSING = absent; NOT VERIFIED = inadequate current verification. Complete code does not imply production/cross-browser sign-off. Classification follows the PRD and explicit Annex module levels; detailed examples are not automatically mandatory architectures.

## CORE checklist

| Source / requirement | Status | Evidence | Remaining work |
| --- | --- | --- | --- |
| PRD 1 / T1: Vite/React/strict TS/scripts | COMPLETE | [TS config](frontend/tsconfig.json), [scripts](package.json), [lint config](frontend/eslint.config.mjs) | Repeat checks for final release. |
| PRD 3, 16 / T1: typed props/state/API, no explicit `any` | COMPLETE | [Product types/guards](frontend/src/api/products.ts), [cart types](frontend/src/cart/cart.ts), [form types](frontend/src/orders/checkout-form.ts); lint/typecheck | Explain types/narrowing at defense. |
| PRD 4, 16 / P0.1: components, props/children, callbacks, map/key, Router/Outlet | COMPLETE | [App](frontend/src/App.tsx), [Layout](frontend/src/components/Layout.tsx), [ProductGrid](frontend/src/components/ProductGrid.tsx), [QuantitySelector](frontend/src/components/QuantitySelector.tsx) | Literal route/copy differences below. |
| P0.1: catalog at `/`, common NotFound copy/page, active navigation | PARTIAL | Homepage `/`, catalog `/products`; [Header](frontend/src/components/Header.tsx), separate product/order/route recovery views | Confirm editorial route/copy variations or make scoped corrections. Active states cover catalog/sections/bag, not all account/login links. |
| P0.1 / P2: scroll reset on navigation | PARTIAL | [Layout](frontend/src/components/Layout.tsx) reacts to pathname/hash | Query-only pagination does not reset scroll; relevant to exact FULL pagination. |
| PRD 5–6 / P0.2 / P1: controlled login, AuthContext, logout, guest checkout return | COMPLETE | [AuthPage](frontend/src/pages/AuthPage.tsx), [AuthContext](frontend/src/auth/AuthContext.tsx), [safe destinations](frontend/src/auth/returnTo.ts), [CheckoutPage](frontend/src/pages/CheckoutPage.tsx) | Approved email/real API replace simulated username login; no fake shared demo password. |
| PRD 7–8 / P2: catalog, cards/grid, detail navigation, card Add to Cart | COMPLETE | [API](frontend/src/api/products.ts), [card](frontend/src/components/ProductCard.tsx), [card add](frontend/src/components/CardBagButton.tsx), [catalog](frontend/src/pages/ProductsPage.tsx) | Stock is checked on click, not preloaded to disable unavailable cards in advance as in the Annex example. |
| PRD 10–11 / P3: details, invalid IDs, gallery/quantity/add | COMPLETE | [details](frontend/src/pages/ProductDetailsPage.tsx), [gallery](frontend/src/components/ProductGallery.tsx), [tests](frontend/tests/product-details.test.mjs) | Production keyboard/device checks pending. |
| PRD 12–13 / P4: shared immutable cart, quantities/removal, badge/totals, empty state | COMPLETE | [reducer](frontend/src/cart/cart.ts), [Context](frontend/src/cart/CartContext.tsx), [CartPage](frontend/src/pages/CartPage.tsx), [tests](frontend/tests/cart.test.mjs) | Persistence is extra; different storage key/action names do not remove CORE functionality. |
| P4 element registry: Clear cart confirmation | COMPLETE | [CartPage](frontend/src/pages/CartPage.tsx), [browser assertions](frontend/tests/checkout.browser.tsx) | Native confirmation; cancel preserves items/storage, accept clears once. Native keyboard-dialog QA remains part of final browser checks. |
| PRD 14–15 / P5: four controlled fields, validation, confirmation/cart clearing | COMPLETE | [checkout](frontend/src/pages/CheckoutPage.tsx), [validation](frontend/src/orders/checkout-form.ts), [tests](frontend/tests/checkout-form.test.mjs), [browser fixture](frontend/tests/checkout.browser.tsx) | Contact data is frontend-only; persistent server order replaces local simulation. No shipping/payment implied. |
| PRD 22 / P0.5–6: field errors, API loading/error/empty states | COMPLETE | Page state branches, [featured states](frontend/src/components/ProductGrid.tsx), API tests | Comprehensive offline/production QA pending. |
| TW1–TW3 / PRD 19–20: Tailwind v4, flex/grid, responsive, hover/focus/disabled | COMPLETE | [tokens/utilities](frontend/src/styles.css), component/page classes | Implementation exists; browser/contrast evidence is separate. |
| O2: class boundary, `getDerivedStateFromError`, `componentDidCatch`, fallback/reload | COMPLETE | [ErrorBoundary](frontend/src/components/ErrorBoundary.tsx), [tests](frontend/tests/reliability.test.mjs) | Both lifecycles implemented; generic development-only diagnostics and existing accessible recovery preserved. Editorial fallback wording retained; broader route/copy variations remain tracked above. |
| O2: three real bugs in required DEBUG-LOG format | COMPLETE | [DEBUG-LOG](DEBUG-LOG.md), existing fix commits/regressions | Retrospective reproduction disclosed; five diverse FULL incidents not supplied. |
| O2: Console/Network/Sources and React DevTools demonstrations | PARTIAL | DEBUG-LOG, earlier browser checks, [workflow](REPORT.md#reproducible-debugging-workflow) | Demonstrate/capture Sources breakpoints and Components/Profiler honestly; no recordings claimed. |
| O1: deployed Lighthouse report (CORE evidence; FULL target scores) | MISSING | No reports in repository | Capture genuine deployed baseline; no invented before/after scores. |
| O3 / PRD 19, 21: responsive full flow, Chrome + Firefox | NOT VERIFIED | Earlier targeted checks and mock fixtures | Complete all-page/device/browser matrix and keyboard/contrast review; no COMPATIBILITY report yet. |
| D1–D3 / PRD 2, 25: plan/report/English README/real history | PARTIAL | [PLAN](PLAN.md), [REPORT](REPORT.md), [README](README.md); original plan `f81658d` | Current docs await review; planned hours unrecorded; live link/final metrics missing. |
| D2 / PRD 24: public repository/live deploy/direct-route refresh | NOT VERIFIED | Configured GitHub origin and 14 local commits | Verify public visibility; review [deployment preparation](DEPLOYMENT.md), configure exact HTTPS origins and isolated database, deploy both hosts, test SPA refresh/CORS, record live URL. |
| PRD 28: final checks/submission by 6 November, 23:59 Georgia time | MISSING | [remaining plan](PLAN.md) | Owner must finish QA and submit through required form. |

## Selected FULL work and deferred extensions

| Source / feature | Status | Evidence / limit |
| --- | --- | --- |
| PRD 9 / P2: search/category/sort/pagination/URL state | PARTIAL | [catalog API](frontend/src/api/catalog.ts), [query state](frontend/src/catalog/query.ts), [tests](frontend/tests/catalog.test.mjs). Working 300ms debounce, combined filters, global price/rating sort and Previous/Next. Annex example uses 400ms, mutually exclusive search/category, Name A→Z and pagination scroll reset; not all exact details implemented. |
| PRD 18 / P6: order list/details | COMPLETE | [OrdersPage](frontend/src/pages/OrdersPage.tsx), [API](frontend/src/api/orders.ts), backend ownership; latest 50 only, no payment/shipping lifecycle. |
| PRD 18 / P7: profile | PARTIAL | [AccountPage](frontend/src/pages/AccountPage.tsx) shows safe public fields; no editing/password change. |
| React FULL: extra hooks/complex state, Formik + Yup login | PARTIAL | Context hooks/reducers exist; no generic fetch/debounce/storage hooks, Formik or Yup. Avoid adding abstractions just to imitate examples. |
| TS FULL: generics, guards, unions, utility types, OOP/ApiClient | PARTIAL | `LoadState<T>`, parsers, reducer unions, `Pick`, API Error subclasses and class boundary exist. No generic ApiClient or Cart/StorageService classes; no blanket FULL claim. |
| O1: lazy routes/images and targeted memoization | COMPLETE | [lazy routes](frontend/src/App.tsx), lazy card images, memo ProductGrid; historical bundle table in REPORT. Gallery thumbnails are eager; no runtime-speed claim. |
| TW FULL: tokens, dark mode, theme variants | PARTIAL | `@theme` tokens exist; dark-mode switch missing. |
| PRD 17: reviews/related products/promo | MISSING | Deferred optional features. |
| O2 FULL: five diverse bugs; O1/O3 FULL measured quality/evidence | MISSING | Three bugs only; no Lighthouse targets or full browser evidence package. |
| D FULL: Issues/Projects/PRs, weekly notes, time records/video | NOT VERIFIED | Hosted counts not checked; no weekly-note/time/video artifacts. Do not fabricate history to meet target numbers. |

Real auth, Prisma/Neon and persistent orders are approved extensions, not substitutes for these rows. Stripe, AI, admin UI, real shipping and stock reservation are outside the delivery plan; the supplied CORE requirements do not make them mandatory. Resolve CORE/evidence gaps before more optional work.
