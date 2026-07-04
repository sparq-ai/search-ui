# `<sparq-search>` — the provider

Owns the connection to your Sparq collection and the shared search state. Every widget must live inside one (or point at one via `for="id"`). Renders nothing itself — your markup between the tags is laid out by your own CSS.

```html
<sparq-search app-id="acme" api-key="pk_search_xxx" collection="products" routing>
  <!-- widgets + any of your own markup -->
</sparq-search>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `app-id` * | — | Your Sparq app id — requests go to `https://{app-id}.fast.sparq.ai/v2` |
| `api-key` * | — | **Search-only** API key (sent as a Bearer token; visible in HTML by nature) |
| `collection` * | — | Collection id to search |
| `api-host` | derived | Override the API host (staging). `mock:` selects the in-memory mock client |
| `search-fields` | all | Comma list of fields to match the query against, e.g. `title, tags, vendor` |
| `return-fields` | `*` (all) | Comma list of fields to return on each item |
| `filter` | — | Raw filter string sent with every request, e.g. `in_stock = 1 AND price >= 0` |
| `items-per-page` | `20` | Page size |
| `debounce` | `200` | Milliseconds of keystroke debounce for query changes |
| `stalled-delay` | `200` | Loading UIs only appear after this delay — fast responses never flicker |
| `routing` | off | Sync state to the URL (see [SEO guide](../seo.md)) |
| `search-on-load` | `true` | Run the initial search automatically (`search-on-load="false"` to defer) |

## Events (bubbling + composed — listen on `document` if you like)

| Event | `detail` |
|---|---|
| `sparq:search` | `{ results, uiState, raw }` — after every successful search; `raw` is the untouched API payload |
| `sparq:error` | `{ type, status?, message, retryable }` |
| `sparq:query-change` | `{ query }` |
| `sparq:refine` | `{ attr, value?, uiState }` — any filter/sort change |
| `sparq:page-change` | `{ page }` (0-based) |

## JS properties

| Property | Description |
|---|---|
| `controller` | The live [`SearchController`](../javascript-api.md#the-controller) — full programmatic control |
| `hooks` | Per-provider [hooks](../javascript-api.md#hooks) object (`transformResponse`, `queryHook`, …) |
| `client` | Replace the network client for this provider only |

```html
<script>
  customElements.whenDefined('sparq-search').then(() => {
    const search = document.querySelector('sparq-search');
    search.controller.setQuery('shoes');          // drive it from your own UI
    search.hooks = { transformResponse: (r) => r }; // intercept data
  });
</script>
```

## Notes

- The provider always issues **exactly one API request per search** — facet counts for every widget come back disjunctively in that single response.
- Repeated identical searches are served from a small in-memory cache (30 entries, 2 min); `controller.refresh()` busts it.
