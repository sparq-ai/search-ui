# Getting started

Sparq Search UI is a set of Web Components served from a CDN. You write plain HTML tags; the library talks to the Sparq API, keeps every widget in sync, and never makes more than **one request per search**.

## 1. Your first search page

You need three things from your [Sparq dashboard](https://sparq.ai): your **app id**, a **search-only API key**, and a **collection id**.

```html
<!doctype html>
<html>
<head>
  <link rel="preconnect" href="https://YOUR_APP_ID.fast.sparq.ai" crossorigin />
  <script src="https://cdn.sparq.ai/search-ui@1/sparq.js" defer></script>
</head>
<body>
  <sparq-search app-id="YOUR_APP_ID" api-key="YOUR_SEARCH_KEY" collection="YOUR_COLLECTION">
    <sparq-searchbox placeholder="Search products…"></sparq-searchbox>
    <sparq-stats></sparq-stats>
    <sparq-items></sparq-items>
    <sparq-pagination></sparq-pagination>
  </sparq-search>
</body>
</html>
```

That's a working search page: typing searches as you type (debounced), results render with a default card layout, and pagination just works.

> **API keys are visible in HTML.** Only ever use a search-only (public) key here — never an admin key.

## 2. Make results look like *your* product

Add a `<template>` child to `<sparq-items>`. It's your own markup — your page CSS styles it directly. `{{field}}` bindings support dot paths (`{{variant.color}}`) and are **always HTML-escaped**.

```html
<sparq-items empty-text="No products match your search.">
  <template>
    <article class="card">
      <img src="{{image}}" alt="{{title}}" width="160" height="160" loading="lazy" />
      <h3>{{title}}</h3>
      <p>{{vendor}} — ${{price}}</p>
      <a href="{{url}}">View product</a>
    </article>
  </template>
</sparq-items>

<style>
  .card { display: flex; gap: 16px; border-bottom: 1px solid #eee; padding: 12px 0; }
</style>
```

Details and safety rules: [`<sparq-items>`](./components/sparq-items.md).

## 3. Add filtering, sorting, and a full layout

```html
<sparq-search app-id="…" api-key="…" collection="…" routing>
  <sparq-searchbox placeholder="Search…" suggestions min-chars="2"></sparq-searchbox>
  <sparq-refinements clear-label="Reset all"></sparq-refinements>

  <aside>
    <sparq-filters attribute="system_vendor" header="Vendor" limit="8" show-more searchable></sparq-filters>
    <sparq-filters attribute="system_producttype" header="Type" sort-by="alpha"></sparq-filters>
    <sparq-range attribute="price" prefix="$"></sparq-range>
  </aside>

  <main>
    <sparq-stats></sparq-stats>
    <sparq-sort label="Sort by" options="relevance|Relevance, price:asc|Price ↑, price:desc|Price ↓"></sparq-sort>
    <sparq-items>…</sparq-items>
    <sparq-pagination padding="2" show-first-last></sparq-pagination>
  </main>
</sparq-search>
```

Facet counts stay correct after selection — pick "Nike" and the other vendors remain visible with the counts they'd have, while every other facet reflects the Nike filter. The Sparq backend computes this in a single request.

The layout (`<aside>`/`<main>`, grid, columns) is entirely yours: widgets are ordinary elements you place with your own CSS.

## 4. Shareable URLs (`routing`)

The `routing` attribute on the provider syncs search state to the URL:

```
?q=shoes&page=2&sort=price:asc&f.system_vendor=Nike~Adidas&r.price=10-50
```

Reloading restores the exact search; the browser's back button steps through query/filter/page changes. This URL format is also the contract for [SEO fallback pages](./seo.md).

## 5. SEO: don't lose your ranking to JavaScript

If the page must be indexable, have your server render the current URL's results inside `<sparq-ssr>`. Bots index that HTML; in browsers the widgets take over the moment the first live results arrive:

```html
<sparq-search app-id="…" api-key="…" collection="…" routing>
  <sparq-ssr>
    <!-- server-rendered results + crawlable <a href="?page=2"> links -->
  </sparq-ssr>
  <sparq-searchbox></sparq-searchbox>
  <sparq-items>…</sparq-items>
  <sparq-pagination></sparq-pagination>
</sparq-search>
```

Full guide: [SEO & server-rendered takeover](./seo.md).

## 6. Checklist before shipping

- [ ] `defer` on the script tag, `preconnect` to `https://{app-id}.fast.sparq.ai`
- [ ] Search-only API key
- [ ] `width`/`height` on template images (prevents layout shift)
- [ ] JS-only page? Reserve widget space pre-load — see [Performance](./performance.md)
- [ ] Indexable page? Use `<sparq-ssr>` + `routing` — see [SEO](./seo.md)
- [ ] Match your brand with tokens/parts — see [Theming](./theming.md)

## Browser support

Chrome/Edge 79+, Firefox 78+, Safari 13.1+ (iOS 13.4+) — roughly every browser since 2020, ≈99% of traffic. **IE11 is not supported and cannot be** (the underlying reactivity requires native `Proxy`, which has no polyfill). In unsupported browsers the library never engages, so a `<sparq-ssr>` fallback page remains fully usable.

## Local development without credentials

Set a mock dataset before the script loads and point the provider at it — the whole widget set runs against an in-memory engine with the same semantics as the real API:

```html
<script>
  window.__SPARQ_MOCK__ = { data: [{ title: 'Demo product', price: 10 }], delayMs: 100 };
</script>
<script src="https://cdn.sparq.ai/search-ui@1/sparq.js" defer></script>

<sparq-search collection="anything" api-host="mock:">…</sparq-search>
```
