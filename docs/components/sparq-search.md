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
| `insights` | off | Send search analytics events (search, result clicks) so the Sparq dashboard can show CTR, conversion and revenue — see [Insights](#insights-search-analytics) |
| `tracking-host` | `https://events.sparq.ai/v2` | Override the analytics endpoint (staging / self-hosted) |

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

## Insights (search analytics)

Add the `insights` attribute and the widget reports anonymous search analytics automatically — every settled search and every result click, each stamped with the search's `queryId` so the Sparq dashboard can compute click-through rate, search conversion and search-attributed revenue. No other markup changes:

```html
<sparq-search app-id="acme" api-key="pk_search_xxx" collection="products" insights>
  …
</sparq-search>
```

To attribute **orders** to searches, add one snippet to your order-confirmation page (this is the only part that needs your platform's order data):

```html
<script>
  window.sparq = window.sparq || function () { (window.sparq.q = window.sparq.q || []).push(arguments); };
  sparq('init', { appId: 'acme', apiKey: 'pk_search_xxx', collection: 'products' });
  sparq('purchase', {
    orderId: '10482',
    currency: 'EUR',
    items: [
      { id: '8821', price: 39.9, quantity: 2 },
      { id: '5510', price: 12.0, quantity: 1 },
    ],
  });
</script>
```

The first line is the standard pre-load stub: calls queue until the library loads, so snippet order never matters. `sparq('init', …)` is only needed on pages without a `<sparq-search insights>` element (confirmation pages usually have none). Each purchased item is matched to the search whose result was clicked within the last hour; unmatched items still count toward total revenue. Full API: [JavaScript API — insights](../javascript-api.md#insights).

### Privacy & consent

Events carry a random first-party visitor id (cookie `uId`), never personal data, and leaving the `insights` attribute off (the default) sends nothing at all. For stores with a cookie banner, wire consent with the `consent` command — while revoked, **no events are sent and no cookie is written**:

```html
<script>
  window.sparq = window.sparq || function () { (window.sparq.q = window.sparq.q || []).push(arguments); };
  sparq('consent', false);                 // before the shopper answers the banner
  myCookieBanner.onAccept(() => sparq('consent', true));
</script>
```

Calls queue through the pre-load stub, so ordering relative to the library script never matters.

### Verifying your events

Open DevTools → Network → filter on your tracking host (`events.sparq.ai`). You should see a POST per event: `search-query` after a search settles, `search-session` on the first search in 30 minutes, `product-clicked` when a result is clicked, and `purchase-complete` on the confirmation page (fired by your `sparq('purchase', …)` snippet). A `201` response means the event was accepted. Common causes of missing events: the `insights` attribute is absent, `sparq('purchase', …)` runs without `init` on a page with no `<sparq-search insights>` (a console error names the fix), consent was revoked, or an ad blocker is dropping the request.

## Notes

- The provider always issues **exactly one API request per search** — facet counts for every widget come back disjunctively in that single response.
- Repeated identical searches are served from a small in-memory cache (30 entries, 2 min); `controller.refresh()` busts it.
