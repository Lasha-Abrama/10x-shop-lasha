# Production guest browser evidence

## Provenance

These genuine STEP 018E screenshots were captured on **26 October 2026**, preserved outside Git during STEP 018F, and copied unchanged on **28 October** (STEP 018G). They concern [production](https://10x-shop-lasha.vercel.app/) after commit `f3500bcda5da973efd6c9f8ccfd6ac8e31544972`. Source inventory SHA-256 hashes and destination bytes were verified. Original names started with `prior-018e-`; that prefix was removed here. No browser tests were rerun during preservation.

| Screenshot | Browser | Demonstrates | Image pixels |
| --- | --- | --- | --- |
| [Catalog at 500px](chrome-catalog-500.jpg) | Chrome 155.0.8059.85 | Two-column catalog at a 500 CSS-pixel viewport; visible Add to Bag focus | 500×900 |
| [Product](safari-product.jpg) | Safari 26.6.2 | Product 1 image/detail page in a private window | 1444×1566 |
| [Empty cart](safari-empty-cart.jpg) | Safari 26.6.2 | Cleared-bag message, zero items and recovery action | 1444×1566 |

Safari image dimensions are physical screenshot pixels, not measured CSS viewport widths. These still images demonstrate visible states; workflow results below come from the preceding browser audit, not from inferring interactions from screenshots.

## Actual coverage

**Chrome:** production guest smoke passed homepage/catalog, search/category/sort/pagination, product navigation/direct refresh, local cart add/quantity, native Clear cancellation/acceptance, empty recovery, guest checkout/account/orders restrictions, blank login/register validation, invalid route/product recovery and menu Escape. Measured catalog columns at 375/481/500/1025/1100 CSS pixels were 1/2/2/4/4, without horizontal overflow in those checks; targeted hit areas passed 44×44px minimum. This used a temporary guest tab, not a verified isolated private context.

**Safari:** partial private-window coverage passed homepage/catalog, pasted search, product navigation/refresh, cart add, native Clear Cancel/OK, recovery and menu Escape. Exact viewport measurements, auth forms and the full Chrome matrix were not repeated. Automated typing lost characters in earlier attempts; paste worked. Human slow/normal/rapid typing remains unverified, so no application defect is confirmed.

## Outstanding evidence

- Firefox compatibility remains **UNVERIFIED**.
- Capture actual DevTools Console/Network output, including request statuses and durations; existing tool exports are not DevTools screenshots or HAR files.
- Capture a real local Sources breakpoint and React DevTools Components/Profiler interaction. No paused execution or profiler recording is included.
- Complete human Safari typing checks and Firefox guest smoke before claiming broader coverage.

No production registration, login or order submission was performed for these guest checks. No complete cross-browser or WCAG certification is claimed. Historical [Lighthouse evidence](../lighthouse/README.md) and [REPORT.md](../../REPORT.md) provide separate context.
