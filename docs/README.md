# Sparq Search UI — Documentation

Build a complete search frontend for [Sparq.ai](https://sparq.ai) on any HTML page with one script tag — no build tooling, no manual REST calls.

## Guides

- **[Getting started](./getting-started.md)** — your first search page in 5 minutes
- **[Theming](./theming.md)** — design tokens, `::part()` styling, and the CSS isolation guarantees
- **[JavaScript API](./javascript-api.md)** — hooks, the controller, events, custom clients
- **[SEO & server-rendered takeover](./seo.md)** — `<sparq-ssr>`, the URL contract, crawlable pages
- **[Performance](./performance.md)** — Core Web Vitals checklist (CLS, LCP, INP)
- **[Manual testing](./manual-testing.md)** — browser QA checklist for every feature (playground + your live store)

## Components

| Tag | Purpose |
|---|---|
| [`<sparq-search>`](./components/sparq-search.md) | Provider — connects to your Sparq collection; wraps all widgets |
| [`<sparq-autocomplete>`](./components/sparq-autocomplete.md) | Federated multi-source autocomplete on any search input (with `<sparq-ac-source>` sections) |
| [`<sparq-ssr>`](./components/sparq-ssr.md) | Wraps server-rendered HTML that the JS render takes over |
| [`<sparq-searchbox>`](./components/sparq-searchbox.md) | Query input with optional suggestions dropdown |
| [`<sparq-items>`](./components/sparq-items.md) | Results list with customer-defined templates |
| [`<sparq-items-infinite>`](./components/sparq-items-infinite.md) | Infinite-scroll / load-more results list |
| [`<sparq-filters>`](./components/sparq-filters.md) | Facet list for one attribute — checkbox, single, pill, swatch, or color-list mode |
| [`<sparq-menu>`](./components/sparq-menu.md) | Hierarchical category drill-down menu |
| [`<sparq-rating>`](./components/sparq-rating.md) | "N stars & up" rating facet |
| [`<sparq-toggle>`](./components/sparq-toggle.md) | Single-value on/off switch (e.g. in-stock only) |
| [`<sparq-sort>`](./components/sparq-sort.md) | Sort-order select |
| [`<sparq-pagination>`](./components/sparq-pagination.md) | Page navigation |
| [`<sparq-range>`](./components/sparq-range.md) | Numeric min/max filter (e.g. price) |
| [`<sparq-refinements>`](./components/sparq-refinements.md) | Active-filter chips + clear all |
| [`<sparq-stats>`](./components/sparq-stats.md) | Result count / timing line |

## Conventions used by every component

- **Attributes** are kebab-case strings. **Booleans**: the attribute's presence means `true` (`<sparq-searchbox suggestions>`); `="false"` or `="0"` explicitly means `false`.
- **Lists** are comma-separated; entries can carry labels with `value|Label`. Any attribute value starting with `[` or `{` is parsed as JSON.
- **`for="id"`** — every widget normally finds its provider by DOM ancestry. Place a widget *outside* the provider (e.g. a search box in your page header) by pointing it at the provider's `id`.
- **Functions** (hooks, custom rendering) can't travel through attributes — they are JS properties. See the [JavaScript API](./javascript-api.md).
- **Events** are `CustomEvent`s named `sparq:*`, dispatched with `bubbles: true, composed: true` — listen anywhere, including `document`.
- **Terminology**: an **item** is one search-result record; **results** is the whole response (items + facets + stats); a **facet value** is one filterable value with its count.

## Deeper reading

[ARCHITECTURE.md](../ARCHITECTURE.md) documents the full design: the headless core, the adapter contract (verified against the live API), search semantics, and the roadmap. The [playground](../playground) pages are runnable versions of every guide (`pnpm dev`).
