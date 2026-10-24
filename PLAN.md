# Graduation plan

Updated **24 October 2026**, before deployment. Submission deadline: **6 November 2026, 23:59 Georgia time (UTC+4)**; theory exam: **5 November**. Prioritize unresolved CORE work/evidence before additional FULL features.

## Goal and scope

Deliver an understandable storefront demonstrating React, TypeScript, Tailwind, optimization/debugging and project process. Selected FULL work already includes discovery/URL state, persistence, orders, lazy loading and theme tokens. The lecturer-approved NestJS/Neon extension supports real authentication and stored demonstration orders; it does not replace assessed frontend requirements. Payments, shipping, AI and admin features are outside the remaining graduation scope.

## Planning history

The original PLAN was committed with the foundation in `f81658d` on 19 October. It listed requirements/user journeys, database, auth, catalog/cart, checkout/orders, testing/docs/deployment and possible Stripe/AI work. “Only the foundation is in scope” described that milestone, not the present project. This update preserves that history instead of pretending the detailed plan existed earlier. Stripe/AI ideas are now deferred. Retrospective milestone dates come from Git, not reconstructed time sheets.

## Delivered milestones

| Step | Delivered work | Git evidence |
| --- | --- | --- |
| Foundation | Workspaces, strict TS, Vite/NestJS, health endpoint | `f81658d` |
| 004 | Design tokens, shared responsive layout/assets | `310ee09` |
| 005–006 | Typed DummyJSON catalog and product details/gallery | `d1b350d`, `da9af80` |
| 007 | Persistent cart, stock limits, safe monetary calculations | `892fec2` |
| 008 | Prisma 7/Neon, User schema/migration | `6392435` |
| 009A–B | Backend auth; frontend memory-only auth/account UI | `afd36a9`, `50c1132` |
| 010A–B | Order API; checkout/history/confirmation | `2cb7d95`, `e135f78` |
| 011A | Search/categories/sorting/pagination/URL state | `0c9a5c8` |
| 012 | Error Boundary, lazy routes, targeted memoization | `07848ae` |
| 013A–B | Requirements audit; controlled checkout, card add, navigation | Audit in task history; implementation `2010131` |
| 014A | ESLint, regression evidence, DEBUG-LOG | `a5c5f6f` |
| 014B | README/PLAN/REPORT and requirements mapping | `4d54f62` |
| 014C | Boundary lifecycle and Clear bag confirmation, focused tests | Implemented and verified; native keyboard-dialog QA remains explicit |

Steps 009C/010C were separately authorized manual verification sessions, not invented feature commits. This table does not imply fresh live-flow verification or a current database record count.

STEP 015A configuration and local verification are complete: see [DEPLOYMENT.md](DEPLOYMENT.md). Public URLs, cloud builds, migration target, proxy behavior and database isolation still need review/verification. No deployment or live database operations were performed.

## Remaining milestones and definition of done

| Priority / step | Work | Definition of done | Size / dependency |
| --- | --- | --- | --- |
| P0 / CORE detail review | Resolve literal Annex differences in REQUIREMENTS: remaining route/copy/active-link variations | Scoped corrections or explicit lecturer acceptance reviewed; no unexplained complete claims | Small; before final sign-off |
| P0 / 015 | STEP 015A configuration prepared; hosting still pending | Public-origin validation corrected/tested; HTTPS frontend/API and private secrets configured; reviewed migration status; SPA deep-link refresh works; live URL recorded | Medium; code review/hosting choices |
| P0 / 016 | Production QA/evidence | All-page/device/browser matrix, keyboard/error/empty checks, authorized demo flow and genuine Lighthouse evidence recorded; failures resolved | Medium; requires deployment |
| P0 / documentation closeout | Update REPORT/REQUIREMENTS/README | Actual live links, test/bundle/Git metrics and limitations current; owner review | Small; after QA |
| P0 / submission | Final review/delivery/defense preparation | Repository visibility/live access verified, checks pass, required form submitted before deadline | Small; owner action |
| P1 / 017, only if time remains | One valuable FULL gap | Clear assessment value, manageable explanation and tests; no delay to CORE/study | Small/medium; after P0 |

Sizes are relative estimates, not hours already spent. Historical hours were not tracked; no retrospective time-sheet total is claimed.

## Working schedule

- **24 October:** review STEP 014B and identify small CORE corrections.
- **25–27 October:** reviewed corrections and deployment, including public-origin configuration and database isolation. Postpone optional work if hosting slips.
- **28–30 October:** production QA, Chrome/Firefox/responsive checks, Lighthouse baseline and genuine after-change measurement if applicable; update documents.
- **31 October:** stabilize release and practice explaining state, effects, types, validation, money, auth and order trust boundaries.
- **1–4 November:** reserve primarily for theory preparation; only critical fixes and short defense walkthroughs.
- **5 November:** theory exam; avoid new features.
- **6 November:** final smoke checks, live-link/submission verification and buffer; submit before **23:59 UTC+4**.

This is a forward plan, not a claim these activities happened already.

## Risks and responses

| Risk | Response |
| --- | --- |
| Public frontend origins rejected | Exact HTTPS origins now supported/tested in STEP 015A; configure and verify the deployed allowlist. |
| DummyJSON/CDN outage or incomplete results | Retain error/retry/cancellation handling; use mocks for automated success tests. No offline fallback is claimed. |
| Lost order response and duplicate submission | No automatic retry; inspect history. Disclose lack of server idempotency. |
| Wrong database target/destructive recovery | Verify target/history and SQL; require approval for live schema/data writes; never reset existing data. |
| Missing rubric detail/evidence | Track in REQUIREMENTS and ask focused lecturer questions instead of silently claiming equivalence. |
| Scope expansion consumes study time | Freeze optional features before 1 November; defer payments, AI, admin, reviews/promo/theme additions unless P0 is done. |

Milestone gate: lint, root typecheck/build, both test suites, diff review and `git diff --check`. Production QA/Lighthouse need separate evidence; unit tests do not replace them.
