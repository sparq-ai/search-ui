# Gap Analysis — sparq/search-ui vs store-ui

**Purpose:** prioritization worksheet for closing the feature gap between this library and the legacy [`naveensky/store-ui`](https://github.com/naveensky/store-ui) (Vue 3 + Pinia + Tailwind, Shopify-coupled, ~40 components). Compared 2026-07-05 against `store-ui@main`.

**How to use:** set the **Priority** column (P0/P1/P2/—) and tick items off as they ship. Effort: S ≈ ≤1 day, M ≈ 2–4 days, L ≈ 1 week+.

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
| ☐ | **Single-select + pill modes** | Radio-style and pill-button facet rendering (`SqFilter` SingleSelect/Pill) | `mode` attribute on `sparq-filters` | S |
| ☐ | **Color swatch / color list facets** | Hex/gradient/multicolor/image swatches with color-group maps (`SqPalette`, `AppHelper.getHexCode`, `config.colorGroups`) | Needs a color-map config surface (JSON attribute or hook) | M |
| ☐ | **Star-rating facet** | Synthesized 0–5 bucket ranges over a rating field (`AppBoot`/`QueryParser` StarRating) | Client-side bucket synthesis onto numeric filters; star display component | M |
| ☐ | **Hierarchical menu facet** | Up to 3-level nested category tree from `>>>`-delimited facet values (`SqFilter` Menu, `ResultParser`) | Also needs URL serialization for paths | L |
| ☐ | **In-stock / availability toggle** | Single-toggle facet (`system_availability` special case) | Thin preset over existing facet filters | S |

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
| ☐ | **Analytics adapters** | Sparq analytics (`@sparq/analytics-js`) + GA4/GTag/GTM trackers (`AnalyticsTracker`, `GoogleAnalyticsTracker`) | `sparq:*` events already carry the payloads; ship an official adapter that subscribes and forwards | M |
| ☐ | **i18n / translations config** | Locale-keyed labels for filter titles, sort options (`TranslationsHelper`) | Partially covered today via `transformValues` + attributes; a config surface would formalize it | S–M |
| ☐ | **Per-collection behavior** | Widget visibility whitelist/blacklist per collection, collection-default sort tokens (`AppBoot`, `sortOrderFor_<handle>`) | Store-ui's deepest theme coupling — reconsider the design rather than port | M |
| ☐ | **"Sync in progress" empty state** | Backend index-not-ready panel (`SqNoContent`) | Detect the condition in the adapter; message via `slot="empty"` | S |
| ☐ | **Powered-by branding** | `SqPoweredBy` + `isCreditsEnabled` | Trivial | S |
| ☐ | **External loader removal** | Remove a theme's own pre-render loader when ready (`SqLoaderListener`) | Possibly unnecessary given `<sparq-ssr>`; decide | S |

---

## 6. Suggested sequencing (before prioritization)

1. **Tier 1 first** — pure search UX, no platform coupling, unblocks non-Shopify customers too. External-input adapter is the single highest-leverage item for theme integrations.
2. **Tier 2 next** — facet display modes are the most visible parity gap on real store pages.
3. **Tier 3 as a separate package** — start once one real Shopify migration is scheduled; requirements will be concrete.
4. **Tier 4 opportunistically** — analytics adapter first (events already exist), the rest as demand appears.

**Deliberately not ported:** `window.sq.config` global config injection (replaced by attributes + hooks), Tailwind/light-DOM styling (replaced by Shadow DOM isolation), dual ad-hoc GA wiring inside widgets (replaced by observe-only events + adapters), Pinia store exposure on `window` (replaced by `el.controller`).
