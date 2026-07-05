# `<sparq-autocomplete>` — federated multi-source autocomplete

Search-as-you-type panel showing results from **multiple collections at once** — products, categories, pages, popular searches — each section rendered with its **own template**. Attaches to your theme's existing search box, or renders its own field.

```html
<sparq-autocomplete input="#Search-In-Header" app-id="…" api-key="…" search-url="/search">
  <sparq-ac-source title="Popular" collection="POPULAR_ID" limit="5" show-on="empty">
    <template><button type="button">{{query}}</button></template>
  </sparq-ac-source>

  <sparq-ac-source title="Products" collection="PRODUCTS_ID" limit="4">
    <template>
      <a href="{{url}}"><img src="{{image}}" width="40" height="40" alt="" /> {{title}} — ${{price}}</a>
    </template>
  </sparq-ac-source>

  <sparq-ac-source title="Categories" collection="CATEGORIES_ID" limit="5">
    <template><a href="{{url}}">{{title}}</a></template>
  </sparq-ac-source>
</sparq-autocomplete>
```

## `<sparq-autocomplete>` attributes

| Attribute | Default | Description |
|---|---|---|
| `input` | — | CSS selector for your theme's search input. **Omit it to render a built-in field instead.** Selectors matching several inputs work (desktop + mobile drawer): the last-focused one anchors the panel |
| `app-id` / `api-key` | — | Credentials shared by all sections (search-only key) |
| `api-host` | derived | Host override; `mock:` serves `window.__SPARQ_MOCK__.collections` |
| `search-url` | `/search` | Where "view all" and plain Enter navigate; the query is appended as `query-param`. Point it at your [SSR search page](../seo.md) — the param format matches the routing contract |
| `query-param` | `q` | Query parameter name |
| `min-chars` | `1` | Minimum characters before query-mode sections fire |
| `debounce` | `200` | Keystroke debounce in ms |
| `placeholder` | `Search…` | Built-in field placeholder (own-input mode) |
| `view-all` | `View all {count} results` | Footer label (`{count}` = summed matches). `view-all="false"` hides the footer |

## `<sparq-ac-source>` attributes (one element per section)

| Attribute | Default | Description |
|---|---|---|
| `collection` * | — | The Sparq collection this section queries |
| `title` | — | Section heading (also its accessible group label) |
| `limit` | `5` | Items shown |
| `show-on` | `query` | `query` (while typing), `empty` (focused + empty input — popular searches), `always` |
| `search-fields` | all | Comma list of fields to match |
| `filter` | — | Raw filter string for this section |
| `sort` | relevance | Sort key ([keys](./sparq-sort.md#sort-keys)) |
| `app-id` / `api-key` | inherited | Per-section credential override |

Each source carries its own `<template>` with the same `{{field}}` engine as [`sparq-items`](./sparq-items.md) — text always escaped, URL attributes scheme-checked, dot paths supported. Without a template, the first string field renders as plain text.

## Behavior

- **One parallel request per visible section** per settled keystroke (debounced, race-guarded, cached — refocusing an empty input re-shows popular searches with zero requests).
- Sections with no matches hide; if nothing matches anywhere, the panel closes.
- A failing section hides **only itself** — the others keep working.
- The panel **overlays** the page (fixed position, flips above the input near the viewport bottom) — zero layout shift.
- **Keyboard**: `↓`/`↑` traverse every section linearly (wrapping), `Enter` follows the active item (or goes to `search-url` when nothing is active), `Escape` closes, `Tab` closes and moves on.
- **Accessibility**: the input is wired as a WAI-ARIA combobox **non-destructively** — every attribute is snapshotted and restored exactly if the component is removed. Screen readers get a live result count and `aria-activedescendant` tracking.
- Theme re-renders that **replace the input node** are survived automatically (event delegation, re-wired on next focus).

## JS properties & hooks

| Property | On | Description |
|---|---|---|
| `controller` | `sparq-autocomplete` | The live `AutocompleteController` (state, `refresh()`, …) |
| `client` | `sparq-autocomplete` | Replace the shared network client |
| `hooks` | `sparq-autocomplete` | `{ transformRequest }` — applied to every section's request |
| `transformItems` | `sparq-ac-source` | `(items, {query}) => items` — reshape one section's items |
| `renderItem` | `sparq-ac-source` | `(item, {index}) => Node \| string` — full JS rendering for one section (dev-trusted, like [`sparq-items`](./sparq-items.md#js-property-renderitem)) |

## Events (observe-only, composed)

| Event | `detail` |
|---|---|
| `sparq:ac-open` | `{ query, mode }` |
| `sparq:ac-close` | `{}` |
| `sparq:ac-select` | `{ source: {id, collection, title}, item, index, query }` — fires before the item's own link navigates |

Popular-search entries are usually `<button>`s (nothing to navigate to) — handle `sparq:ac-select` and route yourself:

```js
document.addEventListener('sparq:ac-select', (e) => {
  if (e.detail.source.collection === 'POPULAR_ID') {
    location.href = '/search?q=' + encodeURIComponent(e.detail.item.query);
  }
});
```

## Styling

Item markup is your own light DOM — style it with normal page CSS. The active (keyboard-highlighted) item carries `data-active`:

```css
sparq-autocomplete [data-sparq-ac-wrapper][data-active] { background: #f3f4f6; }
```

Panel chrome via parts and tokens: parts `root`, `panel`, `section`, `section-title`, `view-all`; tokens include `--sparq-z-popup` (default 9999) and `--sparq-ac-active-bg`.

> **Stacking-context gotcha:** the panel is `position: fixed`, which a `transform`/`filter` on an ancestor (common on sticky Shopify headers) will capture. If the panel clips or misplaces, move `<sparq-autocomplete>` to be a direct child of `<body>` — it finds its input anywhere via the selector.
