# Historical Lighthouse evidence

## Provenance and conditions

These genuine PageSpeed Insights screenshots show audits of [production](https://10x-shop-lasha.vercel.app/) measured on **25 October 2026** (GMT+4). Existing reports were opened and captured on **26 October**, without starting new audits; the selected JPEGs were copied unchanged into this repository on **28 October** (STEP 018G). Source inventory SHA-256 hashes and destination bytes were verified. Source names containing `fresh` are named `optimized` here.

Historical audit environment: Lighthouse **13.5.0**, HeadlessChromium **153.0.8010.36**; initial page load, single-page session. Mobile used emulated Moto G Power with Slow 4G throttling; desktop used emulated Desktop with custom throttling. Captures used the Codex in-app browser; its capture-engine version was not exposed. All eight Lighthouse screenshots are 1280×720 pixels.

## Reports and screenshots

Scores below are Performance / Accessibility / Best Practices / SEO. Times are audit times on 25 October, GMT+4.

| Run and source | Time | Scores | Preserved screenshots |
| --- | --- | --- | --- |
| [Baseline mobile](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/zkq2rvamcw?form_factor=mobile) | 17:58:44 | 77 / 100 / 100 / 92 | [Scores](baseline-mobile.jpg), [metrics](baseline-mobile-metrics.jpg) |
| [Optimized mobile](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/pagsb4hugg?form_factor=mobile) | 22:13:45 | 89 / 100 / 100 / 100 | [Scores](optimized-mobile.jpg), [metrics](optimized-mobile-metrics.jpg) |
| [Repeat mobile](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/haamg4ptsk?form_factor=mobile) | 23:21:40 | 87 / 100 / 100 / 100 | [Scores](repeat-mobile.jpg), [metrics](repeat-mobile-metrics.jpg) |
| [Baseline desktop](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/zkq2rvamcw?form_factor=desktop) | 17:58:44 | 99 / 100 / 100 / 92 | [Scores](baseline-desktop.jpg) |
| [Optimized desktop](https://pagespeed.web.dev/analysis/https-10x-shop-lasha-vercel-app/pagsb4hugg?form_factor=desktop) | 22:13:45 | 100 / 100 / 100 / 100 | [Scores](optimized-desktop.jpg) |

Mobile performance increased by 12 points, or 10 in the repeat; desktop increased by one. Mobile LCP changed from 5.1s to 3.2s (repeat 3.4s), while FCP and Speed Index did not consistently improve. SEO changed from 92 to 100. Full historical metrics and optimization details remain in [REPORT.md](../../REPORT.md).

## Limits

These are screenshots, not standalone Lighthouse HTML/JSON reports or CrUX field measurements. Separate runs vary and do not establish controlled causality. The optimized reports precede commit `f3500bc`; STEP 018F/018G did not re-benchmark the current deployed build. Scores are historical observations, not guarantees.
