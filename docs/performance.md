# Performance — Core Web Vitals

The library is built to keep PageSpeed scores intact: ~40 kB gzipped total (Vue included), zero render-blocking resources, one API request per search. Most CWV behavior is automatic; this page covers what's built in and the two things only *your page* can do.

## What the library does automatically

- **Skeleton placeholders with real dimensions** — during the first load, `sparq-items` stamps blank copies of *your own* template, so results replace placeholders of the same size. (`skeleton="false"` opts out.)
- **Height retention** — during page/filter changes the results list pins its height and keeps the previous items visible (slightly dimmed) until new results commit. No collapse-and-reflow between searches.
- **Widgets never move your content** — the suggestions dropdown overlays instead of pushing; pagination reserves its row invisibly before the first results; stats always occupies its line.
- **LCP-friendly loading** — all styles live inside shadow roots (nothing render-blocking), no web fonts, and on [SSR pages](./seo.md) the takeover search waits for idle time after first paint.
- **INP-friendly interaction** — one network request per keystroke burst (debounce + coalescing), fragment-based rendering with no per-item HTML parsing, DOM reads batched before writes.

## What only your page can do

### 1. Reserve widget space on JS-only pages (CLS)

The browser can paint your page **before** the deferred script executes — and nothing library-side exists yet at that moment. Without an [SSR fallback](./seo.md) (which occupies the space naturally), reserve the widgets' space with plain CSS:

```css
/* Pre-upgrade space reservation — remove any you don't use */
sparq-searchbox:not(:defined)  { display: block; min-height: 44px; }
sparq-items:not(:defined)      { display: block; min-height: 544px; } /* rows × row height */
sparq-pagination:not(:defined) { display: block; min-height: 46px; }
```

Size `sparq-items` to `items-per-page × your item height`. This one block took our test page from CLS 0.09 to ~0 — it's the single highest-impact line on this page.

### 2. Image discipline in item templates

```html
<template>
  <img src="{{image}}" alt="{{title}}" width="160" height="160" loading="lazy" />
  …
</template>
```

- Always set `width`/`height` (or `aspect-ratio` in CSS) — images without dimensions shift the layout as they load.
- `loading="lazy"` for below-the-fold items.

## Quick checklist

- [ ] `<script … defer>` — never blocking
- [ ] `<link rel="preconnect" href="https://{app-id}.fast.sparq.ai" crossorigin>` — cuts DNS+TLS off the first query
- [ ] SSR page → `<sparq-ssr>` occupies the space; JS-only page → the `:not(:defined)` block above
- [ ] Template images have dimensions
- [ ] One navigation model per provider (pagination *or* infinite scroll)

## How this is verified

CI measures real `layout-shift` entries in Chromium on fixture pages (skeleton flow and SSR takeover) and fails above CLS 0.05; the bundle has a hard 70 kB gzip budget (currently ~40 kB).
