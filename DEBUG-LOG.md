# Debugging log

This follows Annex A, O2: symptom → reproduction → diagnostic tool → root cause → fix/evidence → lesson learned.

Evidence was checked on 24 October 2026. These are three distinct defects supported by archived source, current code, and reproducible checks. Entry 1 was explicitly reported during STEP 007. Entries 2 and 3 were reproduced from Git snapshots during STEP 014A; their original discovery dates and original diagnostic tools were not recorded. The tools below describe what was actually used for this verification, not an invented historical workflow. None requires live accounts, orders, or database access.

## 1. A finite product price could overflow when converted to cents

**Symptom:** An API price of `1e308` passed product validation even though multiplying it by 100 produces `Infinity`. STEP 007's final review reported overflowing cart calculations. Persisted cart data also needed independent validation, because it can bypass API parsing.

**Reproduction:** In the pre-fix product parser at `da9af80`, pass an otherwise valid product with `price: 1e308` inside `{ products: [product], total: 1, skip: 0, limit: 12 }`. The parser accepts it. Evaluate `1e308 * 100`: the result is `Infinity`. The current parser rejects that same response. Current cart tests also exercise unsafe conversion, multiplication, aggregate overflow, and tampered storage.

**Tool and result:** `git show da9af80:frontend/src/api/products.ts` exposed the old predicate. An isolated Node assertion loaded that archived parser in memory using `node:module`'s `stripTypeScriptTypes`, confirmed acceptance, then compared it with the current parser. Node's test runner verifies the cart/storage regressions. The uncommitted pre-fix cart implementation is not retained in Git; it is not presented as a historical snapshot.

**Root cause:** `Number.isFinite(price)` only checks the dollar value. It does not prove that cents conversion, quantity multiplication, or addition stays within safe integer bounds.

**Actual fix:** [892fec2 — persistent cart and monetary validation](https://github.com/Lasha-Abrama/10x-shop-lasha/commit/892fec2) introduced the shared integer-cent policy in `frontend/src/money.ts`. API parsing and formatting use it; the reducer independently validates candidate line/aggregate totals, and malformed stored carts recover to empty. Invalid values are rejected rather than capped.

**Regression evidence:** `frontend/tests/products.test.mjs` — “rejects non-finite, negative and unsafe API prices”; `frontend/tests/cart.test.mjs` — conversion, line multiplication, aggregate overflow, and malformed/overflowing stored-cart tests. Run `npm test --workspace frontend`.

**Lesson learned:** A finite input can still produce an unsafe result. Validate money at every trust boundary and after arithmetic, including restored browser data.

## 2. A valid empty catalog page was rejected as malformed data

**Symptom:** The old list parser threw an unexpected-response error for an empty page whose offset exceeded the total. That would prevent the paginated UI from using the returned total to correct an out-of-range page.

**Reproduction:** Pass `{ products: [], total: 194, skip: 240, limit: 0 }` to `parseProductsResponse` from `892fec2`. It throws because `240 + 0 > 194`. The current parser accepts the empty result; `getCatalogPage` can return its total, and `CatalogResults` can redirect to the last page. This is a reconstructed parser regression, not a claim that pagination existed before STEP 011A.

**Tool and result:** `git diff 892fec2 0c9a5c8 -- frontend/src/api/products.ts` shows the changed condition. An isolated Node assertion reproduced the rejection with the archived `da9af80` parser (which has the same faulty condition) and acceptance with the current parser. The mocked catalog test verifies the out-of-range API response without network access.

**Root cause:** The parser applied the nonempty-page bound to an empty result. An empty slice can legitimately have an offset beyond the catalog's current total, for example after following a stale shared URL.

**Actual fix:** [0c9a5c8 — product discovery](https://github.com/Lasha-Abrama/10x-shop-lasha/commit/0c9a5c8) made the `skip + products.length > total` check conditional on `products.length > 0`. Validation of nonempty/inconsistent pages remains intact.

**Regression evidence:** `frontend/tests/catalog.test.mjs` — “accepts empty matches and out-of-range pages so UI can normalize the page”; `frontend/src/pages/ProductsPage.tsx` — last-page correction in `CatalogResults`. Run `npm test --workspace frontend`.

**Lesson learned:** Distinguish malformed data from a valid empty result. Boundary validation must preserve enough information for the UI to recover.

## 3. An HTTP prefix was mistaken for a valid product image URL

**Symptom:** The first catalog parser accepted `thumbnail: 'https://'`, which cannot identify a loadable image. Such data reached the card instead of being rejected at the API boundary. The existing image fallback limited the visible damage but did not make the response valid.

**Reproduction:** Supply a valid product except for `thumbnail: 'https://'` to the parser from `d1b350d`. It accepts the response, although `URL.canParse('https://')` is `false`. The current parser rejects it. The same check also rejects `http://[broken`.

**Tool and result:** `git show d1b350d:frontend/src/api/products.ts` and `git show da9af80 -- frontend/src/api/products.ts` show the old prefix-only check and its replacement. An isolated Node assertion confirmed historical acceptance, the URL parser's rejection, and current API-parser rejection. No real CDN outage or browser debugging session is claimed.

**Root cause:** `/^https?:\/\//` checks the protocol prefix but not whether the rest of the URL is parseable.

**Actual fix:** [da9af80 — product details](https://github.com/Lasha-Abrama/10x-shop-lasha/commit/da9af80) added `isImageUrl`, combining nonempty text, `URL.canParse`, and the HTTP(S) restriction, and reused it for list thumbnails and detail images. STEP 014A adds an explicit regression for this historical list-parser defect; it does not change the already-correct runtime validation.

**Regression evidence:** `frontend/tests/products.test.mjs` — “rejects HTTP image strings that have a scheme but no valid URL”; `frontend/tests/product-details.test.mjs` — malformed details and unsafe-image validation. Run `npm test --workspace frontend`.

**Lesson learned:** Use the platform URL parser alongside an allowed-protocol check. A recognizable prefix is not sufficient validation.

## Evidence limits

- The historical comparisons ran archived standalone parsers in memory; no working-tree checkout, live API write, or database change was needed.
- Git commit links above identify real fixes included in feature commits; they are not invented standalone bug-fix commits.
- These entries do not claim that malformed values came from DummyJSON in production.
- Intentionally injected Error Boundary failures, missing planned features, and expected memory-only sign-out after refresh are not counted as bugs.
- Screenshots, React Profiler recordings, and original incident timestamps are not available for these three cases. No such evidence is claimed. Broader debugging-tool demonstrations and deployment QA remain separate work.
