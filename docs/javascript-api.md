# JavaScript API

Everything works without JavaScript beyond the script tag — but when you need to intercept data, drive the search programmatically, or integrate analytics, this is the surface. It's deliberately small.

## Timing: when is the API ready?

The CDN script registers everything and then fires **`sparq:ready`** on `document`. That's the safe moment to attach hooks:

```html
<script src="https://cdn.sparq.ai/search-ui@1/sparq.js" defer></script>
<script>
  document.addEventListener('sparq:ready', () => {
    // window.SparqSearchUI and all elements exist now
  });
</script>
```

(`customElements.whenDefined('sparq-search')` works too. Avoid setting properties on elements *before* the script runs — pre-upgrade properties shadow the real accessors.)

## Hooks — changing behavior

Hooks are functions, so they're JS-only. Three levels, most specific wins: **widget > provider > global**.

```js
// Global (all providers on the page)
SparqSearchUI.configure({ hooks: { /* … */ } });

// Per provider
document.querySelector('sparq-search').hooks = { /* … */ };

// Per widget (presentation-level)
itemsEl.renderItem = /* … */;
filtersEl.transformValues = /* … */;
```

### Provider-level hooks

| Hook | Signature | When it runs | Typical use |
|---|---|---|---|
| `transformRequest` | `(req, {uiState}) => req` (may be async) | Before every API call | Inject static filters, per-user boosts |
| `transformResponse` | `(res, {request}) => res` (may be async) | After the response is normalized, before anything renders | **Reshape server data before render** — derived fields, currency formatting, merging local data |
| `transformItems` | `(items, {uiState}) => items` | After merge, right before widgets see them | Decorate, reorder, dedupe items |
| `queryHook` | `(query, search) => void` | On every query change | Gate/rewrite queries — search runs only when you call `search(finalQuery)` |
| `suggestionsSource` | `(query) => Promise<string[]>` | Suggestions fetch | Power the searchbox dropdown from any source |
| `onError` | `(error, {retry}) => void \| false` | On failures, before error UI | Telemetry; return `false` to suppress the built-in error state |

```js
document.querySelector('sparq-search').hooks = {
  transformResponse: (res) => ({
    ...res,
    items: res.items.map((item) => ({ ...item, price_display: fmt(item.price) })),
  }),
  queryHook: (q, search) => { if (q.trim().length !== 1) search(q.trim()); },
  onError: (err, { retry }) => { telemetry.error(err); if (err.retryable) setTimeout(retry, 2000); },
};
```

Async hooks are awaited inside the request pipeline and stay race-safe — a stale transformed response is discarded, never rendered.

#### Shaping the request

`transformRequest` receives the normalized `SearchRequest`, so anything on it can
be set per integration. Two fields exist for cases the interface does not cover:

**`sort` accepts several keys**, applied in priority order — each one breaks the
previous key's ties. The API reads one key per array element, so a comma-joined
string does *not* work.

```js
hooks = {
  // Relevance first; equally-relevant items ordered by price, high to low.
  transformRequest: (req) => ({ ...req, sort: ['-_rank', '-price'] }),
};
```

Sort chosen in the UI stays a single string and is what round-trips through the
URL; an array is an integration-level override applied after routing.

**`raw` merges straight into the request body**, last, so it can also override a
field the client built. It is the escape hatch for API fields this interface does
not model yet — nothing validates it, so an unknown key is simply sent.

```js
hooks = {
  transformRequest: (req) => ({ ...req, raw: { typoTolerance: 2, facetCount: 5 } }),
};
```

### Widget-level hook properties

| Property | On | Purpose |
|---|---|---|
| `renderItem` | `sparq-items`, `sparq-items-infinite` | Full JS rendering; overrides the `<template>` ([details + security note](./components/sparq-items.md#js-property-renderitem)) |
| `transformValues` | `sparq-filters`, `sparq-refinements` | Reorder/relabel/hide facet values or chips |

Naming rule: `transformItems` always means result items; `transformValues` always means facet values — the same word never means two things.

## Events — observing

All `sparq:*` events bubble and cross shadow boundaries; listen on `document` for one-stop analytics. Events are **observe-only** — to change behavior, use hooks.

| Event | From | `detail` |
|---|---|---|
| `sparq:ready` | `document` | — (registration finished) |
| `sparq:search` | provider | `{ results, uiState, raw }` — `raw` is the untouched API payload |
| `sparq:error` | provider | `{ type, status?, message, retryable }` |
| `sparq:query-change` | provider | `{ query }` |
| `sparq:refine` | provider | `{ attr, value?, uiState }` |
| `sparq:page-change` | provider | `{ page }` |
| `sparq:item-click` | items widgets | `{ item, index }` |
| `sparq:takeover` | `sparq-ssr` | — (fallback replaced) |

```js
document.addEventListener('sparq:item-click', (e) => analytics.track('result_click', e.detail));
```

## The controller — driving the search

`document.querySelector('sparq-search').controller` is the live search engine behind the widgets:

```js
const { controller } = document.querySelector('sparq-search');

// Intents (all safe to call in bursts — they coalesce into one request)
controller.setQuery('running shoes');   // debounced like typing
controller.searchNow();                 // skip the debounce
controller.setPage(2);                  // 0-based
controller.setSort('price:desc');
controller.toggleFacetValue('system_vendor', 'Nike');
controller.setNumericRange('price', { min: 10, max: 50 });
controller.clearRefinements();          // all filters (query stays)
controller.setUiState({ query: 'boots', facetFilters: { system_vendor: ['Asics'] } });
controller.refresh();                   // bust the cache and re-run

// Read state (a snapshot arrives on every change)
const unsubscribe = controller.subscribe((state) => {
  console.log(state.status, state.results?.totalItems);
});
```

`state.status` is `idle → loading → stalled → success | error`; key loading UI off `stalled` (loading longer than ~200 ms) so fast responses don't flicker.

## Custom clients & offline demos

```js
// Replace the transport everywhere (custom proxy, added headers, …)
SparqSearchUI.setClient(myClient); // { search(req, {signal}): Promise<response> }

// Offline demo/mock mode — plain global, works before the script loads:
window.__SPARQ_MOCK__ = { data: [/* items */], delayMs: 100, suggestions: ['…'] };
// then: <sparq-search collection="demo" api-host="mock:">
```

`window.SparqSearchUI` also exposes `version`, `register()`, `createSparqClient(cfg)`, `createMockClient(data, opts)`, and the `SearchController` class for headless use.
