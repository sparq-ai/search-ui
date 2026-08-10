# Gap Analysis — sparq/search-ui vs store-ui

**Purpose:** prioritization worksheet for closing the feature gap between this library and the legacy [`naveensky/store-ui`](https://github.com/naveensky/store-ui) (Vue 3 + Pinia + Tailwind, Shopify-coupled, ~40 components). Compared 2026-07-05 against `store-ui@main`.

**How to use:** set the **Priority** column (P0/P1/P2/—) and tick items off as they ship. Effort: S ≈ ≤1 day, M ≈ 2–4 days, L ≈ 1 week+.

**Status (updated 2026-07-06): 8 shipped · 17 pending** (25 tracked items). Tier 1 is 3/7 done, **Tier 2 is complete (5/5)**; Tiers 3 (7 items) and 4 (6 items) not started — by design, see sequencing.

Shipped so far: dual-thumb range slider · federated autocomplete w/ external-input adapter · popular searches · single-select + pill facet modes · color swatch / color-list facets · star-rating facet · in-stock/availability toggle · hierarchical menu facet.

## Pending items at a glance

| # | Item | Tier | Effort | Why it might be next |
|---|---|---|---|---|
| 1 | Merchandising redirects | 1 | S–M | `submitQuery()` seam already built; just needs the backend redirects-collection convention + a lookup |
| 2 | Page-size selector widget | 1 | S | Controller support exists; widget only — quick win |
| 3 | Prev/Next pager mode | 1 | S | Attribute variant on `sparq-pagination` — quick win |
| 4 | Responsive pagination meta-config | 1 | S–M | Decide: CSS guidance vs `mode-mobile` attribute |
| 5–11 | Shopify commerce pack (7 items) | 3 | S→L | Start as `@sparq/search-ui-shopify` when a real migration is scheduled |
| 12 | Analytics adapters (Sparq + GA4/GTM) | 4 | M | Events already carry payloads; highest-value Tier-4 item |
| 13 | i18n / translations config | 4 | S–M | Partially covered by `transformValues` today |
| 14 | Per-collection behavior | 4 | M | Redesign, don't port (store-ui's deepest coupling) |
| 15 | "Sync in progress" empty state | 4 | S | Adapter-side detection + `slot="empty"` message |
| 16 | Powered-by branding | 4 | S | Trivial |
| 17 | External loader removal | 4 | S | Possibly unnecessary given `<sparq-ssr>` — decide before building |

---

## 1. Already at parity (or better) — no action

| Capability | store-ui | search-ui |
|---|---|---|
| Search box, results, sort, pagination, infinite scroll, load-more | ✓ | ✓ |
| Applied-filter chips + clear all | `SqAppliedFilter`, `SqClear` | `sparq-refinements` |
| Facet search-within-filter, show-more, count sorting | `SqFilter` | `sparq-filters` |
| URL ↔ state sync incl. back/forward | `SqUrlManager` | `routing` (versioned param contract) |
| Skeleton loading states | fixed shimmer grid | skeletons stamped from the customer's own template (better CLS) |
| Request cancellation | ✓ | ✓ plus cache, race guard, single-request disjunctive facets |
| Custom item markup | Vue scoped slots (Vue-aware theme required) | plain `<template>` `{{field}}`, XSS-safe, zero build step |

Unique to search-ui (no store-ui counterpart): `<sparq-ssr>` SEO takeover, two-way CSS isolation, hooks pipeline, extension docs, unit + 3-engine e2e suites, mock client, bundle-size budget.

---

## 2. Tier 1 — core search-UX gaps (platform-neutral; belongs in this library)

| Priority | Item | What it is (store-ui source) | Notes / dependencies | Effort |
|---|---|---|---|---|
| ☑ shipped | ~~**External-input adapter**~~ | ~~Let a theme's *existing* search input drive the search (`SqSearchListener`) + an autocomplete panel anchored to it (`SqDropdown`)~~ | Done 2026-07-05: `<sparq-autocomplete input="selector">` — federated multi-source panel, delegated listeners survive theme re-renders, non-destructive ARIA | M |
| ☑ shipped | ~~**Popular searches**~~ | ~~Suggestions sourced from a dedicated collection (`SqPopularSearch`, `PopularSearchProcessor`, `popularCollectionId`)~~ | Done 2026-07-05: `<sparq-ac-source show-on="empty" collection="POPULAR_ID">` — any collection becomes a popular-searches section on empty input | S–M |
| ☐ | **Merchandising redirects** | Keyword → URL redirect on Enter (`SqRedirects`, `RedirectProcessor`, `redirectsCollectionId`), internal/external | Backend collection convention. **Seam ready:** `submitQuery()` in `packages/components/src/autocomplete/SparqAutocomplete.ts` — every Enter/view-all navigation funnels through it | S–M |
| ☐ | **Page-size selector widget** | User-facing per-page dropdown (`SqPerPage`) | Controller already supports `setItemsPerPage`; widget only | S |
| ☑ shipped | ~~**True dual-thumb range slider**~~ | ~~Slider UI with min/max inputs, prefix/suffix, debounce (`SqSlider`)~~ | Done 2026-07-05: track-level pointer handling (nearest-thumb pick, works on all engines incl. Firefox), keyboard/AT via native inputs, bounds-freeze policy, full-span-clears-filter | M |
| ☐ | **Prev/Next pager mode** | Minimal two-button pager (`SqPrevNext`) | Attribute/variant on `sparq-pagination` | S |
| ☐ | **Responsive pagination meta-config** | Different pagination mode desktop vs mobile, scroll-to-top on page change (`SqSyPager`) | Could be CSS-guidance + two widgets, or a `mode-mobile` attribute | S–M |

## 3. Tier 2 — facet display modes (extend `sparq-filters` / `sparq-range`)

store-ui supports 9 facet UI types (`UserInterfaceType`); search-ui currently has checkbox multi-select + numeric range.

| Priority | Item | What it is (store-ui source) | Notes / dependencies | Effort |
|---|---|---|---|---|
| ☑ shipped | ~~**Single-select + pill modes**~~ | ~~Radio-style and pill-button facet rendering (`SqFilter` SingleSelect/Pill)~~ | Done 2026-07-05: `mode="single"` (radio semantics, click-selected-clears) and `mode="pill"` on `sparq-filters` | S |
| ☑ shipped | ~~**Color swatch / color list facets**~~ | ~~Hex/gradient/multicolor/image swatches with color-group maps (`SqPalette`, `AppHelper.getHexCode`, `config.colorGroups`)~~ | Done 2026-07-05: `mode="swatch"` / `mode="color-list"` + `colors` JSON map/property; `a/b` gradients, `*` multi, `#` clear, hatched-unknown fallback | M |
| ☑ shipped | ~~**Star-rating facet**~~ | ~~Synthesized 0–5 bucket ranges over a rating field (`AppBoot`/`QueryParser` StarRating)~~ | Done 2026-07-05: `<sparq-rating>` — "N & up" rows via numeric filters (`r.attr=N-` in URLs); simpler than store-ui's bucket synthesis, same UX | M |
| ☑ shipped | ~~**Hierarchical menu facet**~~ | ~~Up to 3-level nested category tree from `>>>`-delimited facet values (`SqFilter` Menu, `ResultParser`)~~ | Done 2026-07-06: `<sparq-menu>` — drill-down tree over ancestor-chain facet values; URL paths needed no new serialization (existing `f.attr=` percent-encoding round-trips them) | L |
| ☑ shipped | ~~**In-stock / availability toggle**~~ | ~~Single-toggle facet (`system_availability` special case)~~ | Done 2026-07-05: `<sparq-toggle attribute value label>` — generalized single-value switch with live count | S |

## 4. Tier 3 — Shopify commerce pack (new optional package: `@sparq/search-ui-shopify`)

Keep the core platform-neutral; ship these as a separate CDN bundle layered on the same controller/light-DOM items.

| Priority | Item | What it is (store-ui source) | Effort |
|---|---|---|---|
| ☐ | Product image w/ hover-swap, lazy, Shopify `_WxH` optimization, variant image resolution | `SqSyImage` | M |
| ☐ | Variant color/image swatches (drives selected variant → price/image) | `SqSySwatch` + `SqPalette` | M |
| ☐ | Price + compare-at display, currency `Intl` formatting | `SqSyPrice` | S |
| ☐ | Add-to-cart button (`/cart/add.js`), loading/success/error states | `SqSyCartBtn` | S–M |
| ☐ | Quantity selector | `SqQuantitySelector` | S |
| ☐ | Quick-view modal + image carousel (product JSON fetch) | `SqSyQuickView`, `SqSyCaraousel` | L |
| ☐ | Star-rating display (product cards) | `SqReview` | S |

## 5. Tier 4 — platform glue & operations

| Priority | Item | What it is (store-ui source) | Notes | Effort |
|---|---|---|---|---|
| ◐ partial | **Analytics adapters** | Sparq analytics (`@sparq/analytics-js`) + GA4/GTag/GTM trackers (`AnalyticsTracker`, `GoogleAnalyticsTracker`) | Sparq side shipped 2026-08-06 as built-in insights (`insights` attr + `window.sparq('purchase', …)`, queryId attribution — ARCHITECTURE §20); GA4/GTM forwarding adapter still open | M |
| ☐ | **i18n / translations config** | Locale-keyed labels for filter titles, sort options (`TranslationsHelper`) | Partially covered today via `transformValues` + attributes; a config surface would formalize it | S–M |
| ☐ | **Per-collection behavior** | Widget visibility whitelist/blacklist per collection, collection-default sort tokens (`AppBoot`, `sortOrderFor_<handle>`) | Store-ui's deepest theme coupling — reconsider the design rather than port | M |
| ☐ | **"Sync in progress" empty state** | Backend index-not-ready panel (`SqNoContent`) | Detect the condition in the adapter; message via `slot="empty"` | S |
| ☐ | **Powered-by branding** | `SqPoweredBy` + `isCreditsEnabled` | Trivial | S |
| ☐ | **External loader removal** | Remove a theme's own pre-render loader when ready (`SqLoaderListener`) | Possibly unnecessary given `<sparq-ssr>`; decide | S |

---

## 6. Suggested sequencing (updated 2026-07-05)

The original Tier-1/Tier-2 first pass is largely done (dual-thumb slider, autocomplete/external-input, popular searches, all four facet display modes, rating facet, availability toggle). Recommended order for what remains:

1. **Tier-1 quick wins in one batch** — page-size selector + prev/next pager (+ the responsive-pagination decision): all S-effort, all pure widgets over existing controller support. Roughly a day combined.
2. **Merchandising redirects** — the last search-UX behavior gap. Blocked only on the backend redirects-collection convention; the client seam (`submitQuery()`) is ready, so agree the convention and it's small.
3. **Analytics adapter** (Tier 4) — pull forward ahead of Tier 3: the `sparq:*` events already carry the payloads, and analytics matters for every customer regardless of platform.
4. **Tier 3 as `@sparq/search-ui-shopify`** — start once one real Shopify migration is scheduled; requirements will be concrete.
5. **Remaining Tier 4** as demand appears; decide (rather than default-build) the external-loader-removal and per-collection-behavior items.

**Deliberately not ported:** `window.sq.config` global config injection (replaced by attributes + hooks), Tailwind/light-DOM styling (replaced by Shadow DOM isolation), dual ad-hoc GA wiring inside widgets (replaced by observe-only events + adapters), Pinia store exposure on `window` (replaced by `el.controller`).
