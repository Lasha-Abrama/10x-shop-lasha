# Graduation plan

Updated **26 October 2026**, STEP 017A, after production verification on 25 October. Submission deadline: **6 November 2026, 23:59 Georgia time (UTC+4)**; theory exam: **5 November**. Prioritize unresolved CORE work/evidence before additional FULL features.

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

STEP 015A configuration was followed by live deployment. The frontend is Vercel Ready and the backend Render Live at `24107f8`; the owner confirms an isolated production Neon project. See [DEPLOYMENT.md](DEPLOYMENT.md) for evidence and operational gaps.

| Step | Delivered work | Evidence |
| --- | --- | --- |
| 016A | Custom 10X favicon and browser title | `3ea9e25` |
| 016B–C | Production diagnostics; body-parser/fast-uri patches and robots.txt | `a4812c0`; two high Multer-related audit entries remain |
| 016D | Responsive WebP hero and matched homepage preload | `24107f8`; 75 frontend / 99 backend tests passed |
| 016E | Production deployment, health and Lighthouse comparison | 25 October reports linked in REPORT; mobile 89/repeat 87, desktop 100, SEO 100 |
| 017A | Documentation consistency and final acceptance review | Documentation reviewed and approved for finalization; remaining acceptance items tracked below |

## Remaining milestones and definition of done

| Priority / step | Work | Definition of done | Size / dependency |
| --- | --- | --- | --- |
| P0 / CORE detail review | Resolve literal Annex differences in REQUIREMENTS: remaining route/copy/active-link variations | Scoped corrections or explicit lecturer acceptance reviewed; no unexplained complete claims | Small; before final sign-off |
| P0 / deployment closeout | Deployment is live; complete remaining operational QA | Full route/CORS/proxy matrix and cold-start limits recorded; do not alter deployment or data without authorization | Small/medium; live checks |
| P0 / final production QA | Lighthouse and targeted checks complete; comprehensive QA remains | All-page Chrome/Firefox/device matrix, native keyboard/error/empty checks and authorized demo evidence recorded; failures resolved | Medium; preserve production data |
| P0 / 017A documentation closeout | Production results and acceptance checklist updated | Documentation approved; remaining acceptance evidence tracked in REQUIREMENTS; no fabricated metrics | Small; this review |
| P0 / submission | Final review/delivery/defense preparation | Repository visibility/live access verified, checks pass, required form submitted before deadline | Small; owner action |
| P1 / optional FULL gap, only if time remains | One valuable deferred feature | Clear assessment value, manageable explanation and tests; no delay to CORE/study | Small/medium; after P0 |

Sizes are relative estimates, not hours already spent. Historical hours were not tracked; no retrospective time-sheet total is claimed.

## Working schedule

- **Completed by 25 October:** deployment, targeted responsive/security/SEO work and genuine Lighthouse before/after evidence.
- **26–27 October:** review STEP 017A documentation and acceptance checklist; resolve remaining rubric questions.
- **28–30 October:** finish Chrome/Firefox/responsive, keyboard and operational QA; capture missing tool/process evidence. Existing Lighthouse reports remain dated measurements.
- **31 October:** stabilize release and practice explaining state, effects, types, validation, money, auth and order trust boundaries.
- **1–4 November:** reserve primarily for theory preparation; only critical fixes and short defense walkthroughs.
- **5 November:** theory exam; avoid new features.
- **6 November:** final smoke checks, live-link/submission verification and buffer; submit before **23:59 UTC+4**.

Future dates are a forward plan, not a claim those activities happened already. Completed items above refer to recorded evidence.

## Risks and responses

| Risk | Response |
| --- | --- |
| Public frontend origins rejected | Exact HTTPS origins are supported/tested and the deployment is live; complete the deployed CORS/proxy matrix before final sign-off. |
| DummyJSON/CDN outage or incomplete results | Retain error/retry/cancellation handling; use mocks for automated success tests. No offline fallback is claimed. |
| Lost order response and duplicate submission | No automatic retry; inspect history. Disclose lack of server idempotency. |
| Wrong database target/destructive recovery | Verify target/history and SQL; require approval for live schema/data writes; never reset existing data. |
| Missing rubric detail/evidence | Track in REQUIREMENTS and ask focused lecturer questions instead of silently claiming equivalence. |
| Scope expansion consumes study time | Freeze optional features before 1 November; defer payments, AI, admin, reviews/promo/theme additions unless P0 is done. |

Milestone gate: lint, root typecheck/build, both test suites, diff review and `git diff --check`. Production QA/Lighthouse need separate evidence; unit tests do not replace them.
