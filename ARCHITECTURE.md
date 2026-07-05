# Sparq Search UI — Architecture

Sparq Search UI lets Sparq.ai customers build a complete search frontend on a plain HTML page — no build tooling, no manual REST calls. Components are written in Vue 3, compiled to native Custom Elements, and served from a CDN as one script tag.

```html
<script src="https://cdn.sparq.ai/search-ui@1/sparq.js" defer></script>

<sparq-search app-id="acme" api-key="pk_search_xxx" collection="products" routing>
  <sparq-searchbox placeholder="Search products…"></sparq-searchbox>
  <sparq-filters attribute="brand" header="Brand"></sparq-filters>
  <sparq-items></sparq-items>
  <sparq-pagination></sparq-pagination>
</sparq-search>
```

## 1. Layer model

```
┌───────────────────────────────────────────────────────────────────┐
│ Host page (plain HTML)                                            │
│   one CDN <script>; attributes in, sparq:* CustomEvents out       │
└──────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────▼────────────────────────────────────┐
│ COMPONENT LAYER (@sparq/search-ui) — Vue 3 SFCs → Custom Elements │
│   <sparq-search> provider (plain CE): owns a SearchController     │
│   Widgets: thin views over controller state; Shadow DOM + parts   │
└──────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────▼────────────────────────────────────┐
│ HEADLESS CORE (@sparq/search-core) — plain TS + @vue/reactivity   │
│   SearchController: state, intents, derived state, subscriptions  │
│   Scheduler (debounce + microtask coalescing) · request builder   │
│   LRU cache + in-flight de-dupe · race guard (requestId + abort)  │
│   Item-template engine (XSS-safe) · UrlSync (optional) · hooks    │
└──────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────▼────────────────────────────────────┐
│ ADAPTER — client/sparqClient.ts: the ONLY file that knows the     │
│   REST API (URL, auth, payload/response mapping, error taxonomy)  │
│   + mockClient.ts for playground/tests/demos                      │
└───────────────────────────────────────────────────────────────────┘
```

Data flow for one interaction: widget intent → controller mutates state → scheduler coalesces to **one** request → hooks (`transformRequest`) → client fetch (previous in-flight aborted) → race guard accepts only the newest response → hooks (`transformResponse`, `transformItems`) → merged into reactive state → every widget's computed updates → provider dispatches `sparq:search` to the host page.

State flows **down** (reactive reads), intents flow **up** (controller method calls). Widgets never talk to each other or to the network.

## 2. Repo layout (pnpm monorepo)

```
search-ui/
├── package.json / pnpm-workspace.yaml / tsconfig.base.json
├── .github/workflows/ci.yml
├── packages/
│   ├── core/                  # @sparq/search-core — headless, no DOM deps except template engine
│   │   └── src/
│   │       ├── state.ts                    # UiState / SearchResults / SearchState types
│   │       ├── controller/
│   │       │   ├── SearchController.ts
│   │       │   ├── requestBuilder.ts       # state + registered widgets → one SearchRequest
│   │       │   ├── scheduler.ts            # debounce + microtask coalescing
│   │       │   └── cache.ts                # LRU + TTL + in-flight promise de-dupe
│   │       ├── client/
│   │       │   ├── types.ts                # SparqClient / SearchRequest / SearchResponse / SearchError
│   │       │   ├── sparqClient.ts          # REST adapter — only API-specific file
│   │       │   └── mockClient.ts           # in-memory engine for playground + tests
│   │       ├── template/
│   │       │   ├── compileItemTemplate.ts  # {{path}} engine → (item) => DocumentFragment
│   │       │   └── sanitize.ts             # attr allowlist + URL scheme checks
│   │       └── routing/urlSync.ts
│   └── components/            # @sparq/search-ui — Vue SFC → custom elements
│       └── src/
│           ├── index.ts / cdn.ts / register.ts
│           ├── provider/SparqSearch.ts     # plain CE (no Vue) — controller on host element
│           ├── provider/SparqSsr.ts        # plain CE — SEO fallback wrapper
│           ├── widgets/*.ce.vue            # SearchBox, Items, ItemsInfinite, Filters,
│           │                               # Sort, Pagination, Range, Refinements, Stats
│           ├── composables/                # useController, useSearchState, useLightTemplate,
│           │                               # useCombobox, useInfiniteSentinel, useHostEvents
│           ├── attrs.ts / events.ts
│           └── styles/reset.ts             # all:initial firewall + internal reset (§12)
├── playground/                # plain .html pages = dev harness + living docs (mock client)
└── e2e/                       # Playwright against the built CDN bundle
```

Widget SFCs are named after their final tags (`Items.ce.vue`, not legacy jargon — see §19).

## 3. Core state and controller API

```ts
type SearchStatus = 'idle' | 'loading' | 'stalled' | 'success' | 'error';

interface UiState {                      // the serializable "input" half — used by URL sync
  query: string;
  page: number;                          // 0-based internally; 1-based in URLs/UI
  itemsPerPage: number;
  sort: string | null;
  facetFilters: Record<string, string[]>;    // OR within an attribute, AND across attributes
  numericFilters: Record<string, { min?: number; max?: number }>;
}

interface FacetValue { value: string; count: number; selected: boolean }

interface SearchResults {
  items: Record<string, unknown>[];
  totalItems: number;
  page: number;
  totalPages: number;
  facets: Record<string, FacetValue[]>;      // zero-count selected values retained (§4)
  facetStats: Record<string, { min: number; max: number }>;
  processingTimeMs: number;
  forUiState: UiState;                       // snapshot the results correspond to
}

interface SearchState extends UiState {
  status: SearchStatus;
  results: SearchResults | null;
  accumulatedItems: Record<string, unknown>[];  // infinite-scroll buffer; reset on refinement change
  error: SearchError | null;
  suggestions: string[];
}
```

Controller (public API — also reachable from page JS via `document.querySelector('sparq-search').controller`):

```ts
class SearchController {
  readonly state: Readonly<SearchState>;     // deep-reactive; widgets read, never write

  // intents — all coalesce to one request per microtask; refinement changes reset page to 0
  setQuery(q: string): void;                 // debounced (default 200 ms)
  setPage(page: number): void;
  setSort(sortKey: string | null): void;
  toggleFacetValue(attr: string, value: string): void;
  setNumericRange(attr: string, range: { min?: number; max?: number } | null): void;
  clearRefinements(attr?: string): void;     // no arg = everything except query
  setUiState(partial: Partial<UiState>): void;
  loadMore(): Promise<void>;
  refresh(): void;                           // bust cache, re-run
  fetchSuggestions(q: string): Promise<void>;

  // derived
  get totalPages(): number;
  get hasRefinements(): boolean;
  get refinements(): Refinement[];

  // lifecycle
  registerWidget(reg: WidgetRegistration): () => void;   // returns unregister
  subscribe(fn: (state: Readonly<SearchState>) => void): () => void;
  on(event: 'search' | 'error' | 'stateChange', fn: (detail: unknown) => void): () => void;
  dispose(): void;
}
```

`status` includes `stalled` (loading longer than 200 ms) so fast responses never flicker spinners — widgets key loading UI off `stalled`, not `loading`.

## 4. Search semantics

- **Exactly one request per search — always.** The Sparq backend computes facet counts disjunctively (a facet's own filter is excluded when aggregating that facet): applying `brand=Nike` still returns counts for all brands, while other facets reflect the filter. **This is a load-bearing API contract.** If backend behavior ever changes, `requestBuilder.ts` is the single seam where client-side multi-request fan-out would be reintroduced.
- **Zero-count retention:** if a selected facet value disappears from response counts (query change → 0 matches), the merge re-appends it with `count: 0, selected: true` so a checked box never vanishes.
- **Scheduling:** every intent marks state dirty and schedules one run per microtask; N synchronous mutations = 1 network round. `setQuery` additionally passes a trailing 200 ms debounce.
- **Races:** each run captures a monotonically increasing `requestId`; responses older than the latest are discarded before touching state. The previous run's `AbortController` is also aborted (bandwidth), but the id check is the correctness guarantee.
- **Cache:** LRU (30 entries, 2 min TTL) keyed on canonical JSON of the request; identical in-flight requests share one promise. `refresh()` clears it.
- **`registerWidget`** tells the request builder which facet attributes to request counts for — only facets a widget actually displays are requested.

## 5. Adapter contract (the real Sparq API — verified live)

Endpoint (per https://docs.sparq.ai/api-docs/search-records): `POST https://{appUniqueId}.fast.sparq.ai/v2`, Bearer-token auth, JSON body. Everything below lives in `sparqClient.ts` only. **All mappings verified against a production store (2026-07-04).**

| Internal              | Sparq API wire behavior (verified) |
|-----------------------|-----------------|
| `query`               | `query` |
| collection            | `collection` |
| `page`/`itemsPerPage` | `skip = page × itemsPerPage`, `count = itemsPerPage` (derive `totalPages`) |
| `sort` key            | `sort` array; **"field" = asc, "-field" = desc** — `"field:desc"` is silently ignored by the API, so the adapter translates our `field:desc` convention to `-field` |
| returned fields       | `fields` — **must default to `["*"]`**: omitting it returns bare `{id, _rank}` items |
| facet count requests  | `textFacets` (array) + `facetCount: 100` |
| facet refinements     | `textFacetFilters` (attr → values array; empty arrays tolerated) |
| numeric range filters | composed into the **`filter` string** (`price >= 5 AND price <= 20`), AND-joined with any user-supplied filter — arbitrary ranges work; bucket-style `numericFacetFilters` (`"[5,20)"`) exist but suit fixed-bucket UIs (v2 candidate) |
| range widget bounds   | request `numericFacets: {attr: []}` (empty bucket list) → response `stats: {attr: {min, avg, max}}` → `facetStats` |
| `items`               | `results` |
| `totalItems`          | total-count wire field (renamed at this boundary — §19) |
| counts                | response `textFacets`: **attr → `[{label, value}]` where `label` is the facet VALUE and `value` is the COUNT** → normalized to `Record<attr, FacetValue[]>` |
| timing                | `responseTime` → `processingTimeMs` |

Verified live: **both text and numeric facet counts are disjunctive server-side** (refining `system_vendor` still returns all vendors with counts; other facets reflect the filter) — the §4 single-request contract holds in production. Passthrough: `searchFields`; `typoTolerance`, `groupBy`/`groupCount`, `highlightFields`, `textFacetQuery`, `geo` exist in the API (v2 candidates). Errors normalized to `SearchError { type: 'network'|'auth'|'rate-limit'|'server'|'client'; status?; message; retryable }` (401 → `auth`, 429 → `rate-limit`, 5xx → `server`, fetch failure → `network`; error body `{status, data}`). `raw` passthrough preserves the untouched payload (including `stats`, `uniqueId`).

Spec-driven decisions:
- **Facet counts are disjunctive server-side** (§4) → single-request client, no batch method in the interface.
- **No suggestions endpoint** → the searchbox dropdown stays hidden unless a `suggestionsSource` hook (§11) or a client `suggest` method is provided.
- **No highlighting in v1.** Client-side literal string matching would mis-highlight under typo-tolerance, stemming, and synonyms (query "shos" matching an item containing "shoes" finds no literal "shos" to wrap). Correct highlighting requires match metadata computed by the engine that did the matching — the backend. v1 ships zero highlighting code; `SearchResponse` reserves an optional `highlights?` field so when the API adds match metadata, only the adapter and template engine gain a mapping.

`mockClient.ts` implements the same interface over an in-memory JSON array (substring match, facet counting with own-filter exclusion, sorting, numeric stats) and powers the playground, unit tests, and demos. `api-host="mock:"` on the provider selects it.

## 6. Cross-element communication

**Decision: DOM-ancestor discovery + controller-on-host-element. Not Vue provide/inject.**

- `<sparq-search>` is a **plain custom element** (no Vue — it renders only `<slot>`): it creates its `SearchController` synchronously in `connectedCallback` and assigns `host.controller`. Because it registers first and upgrades run in document order, the controller exists before any descendant widget mounts.
- Widgets resolve their provider by walking `parentNode`, jumping shadow boundaries via `getRootNode().host`. The optional `for="id"` attribute overrides discovery (searchbox in the page header, results in `<main>`).
- Late/dynamically-inserted widgets retry after `customElements.whenDefined('sparq-search')` + a microtask. Still not found → clear `console.error` naming the element and fix, widget renders inert, retries on next `connectedCallback`.
- Widgets call `controller.registerWidget(...)` on mount and the returned unregister on unmount. Registration is idempotent (custom elements disconnect/reconnect when moved in the DOM).

Why not provide/inject: it couples coordination to Vue internals and upgrade timing we don't control, defeats the headless layering, and gives page JS no story. `el.controller` is a first-class public API and debuggable in devtools.

## 7. Item templating (plain-HTML custom rendering)

```html
<sparq-items>
  <template>
    <article class="card">
      <img src="{{image}}" alt="{{name}}" width="160" height="160">
      <h3>{{name}}</h3>
      <p>{{brand}} — ${{price}}</p>
      <a href="{{url}}">View</a>
    </article>
  </template>
</sparq-items>
```

- The widget reads its light-DOM child `<template>` on mount (a `<template>` is inert — never renders, no flash). No template → a built-in default card.
- The engine (core, ~1.5 kB — **not** Vue; keeps Vue's runtime template compiler out of the bundle): clones content per item, walks with `TreeWalker`; text bindings `{{dot.path}}` are written via `textContent` — **inherently XSS-safe, user data is never parsed as HTML**; attribute bindings are sanitized (any `on*` attribute is stripped; `href`/`src`/`srcset`/`action` reject `javascript:`/`data:`/`vbscript:` schemes). Missing paths render empty. No raw-HTML/triple-stache syntax exists.
- **Rendered items live in the light DOM**, slotted into the widget's shadow root: the customer's markup is styled by the customer's page CSS directly. Widget chrome (list layout, empty/error/loading states, load-more) stays encapsulated in the shadow root.
- No highlighting in v1 (§5).

## 8. SEO & progressive enhancement — `<sparq-ssr>`

Customers server-render the search results HTML for the current URL; in browsers the JS widgets take it over.

```html
<sparq-search app-id="acme" api-key="pk_xxx" collection="products" routing>
  <sparq-ssr>
    <!-- server-rendered for the current URL: results, crawlable filter/pagination <a> links -->
  </sparq-ssr>
  <sparq-searchbox></sparq-searchbox>
  <sparq-items>…</sparq-items>
  <sparq-pagination></sparq-pagination>
</sparq-search>
```

- **Bots / no JS / pre-upgrade:** `<sparq-ssr>` children render normally and are fully crawlable. Widget tags render nothing pre-upgrade (their only children are inert `<template>`s), so nothing looks broken.
- **Takeover:** the wrapper hides itself (`display:none`, which also removes it from the a11y tree) on the **first successful search render** — not on script load — so there is never a blank gap. It dispatches `sparq:takeover` when hidden. If JS fails or the first search errors, the fallback stays visible: graceful degradation.
- **CLS-safe:** the hide and the first results commit land in the same render frame (§17).
- **State parity:** requires `routing` — the URL-sync param format (§13) is a **stable, versioned contract** shared with customer backends so the JS render matches what the server rendered (same query/page/filters).
- **SEO guidance:** this is progressive enhancement, not cloaking — same content for bots and users. Fallback pagination/filters should be plain `<a href>` links in the routing param format. Load the script with `defer`. Do not apply a blanket `:not(:defined) { visibility: hidden }` FOUC guard on SSR pages — `sparq-ssr` must be visible pre-upgrade (and widgets render nothing pre-upgrade anyway, so no guard is needed).

## 9. Component inventory

| Tag | Key attributes | Events | Notes |
|---|---|---|---|
| `sparq-search` | `app-id`\*, `api-key`\*, `collection`\*, `api-host`, `search-fields`, `return-fields`, `filter`, `items-per-page` (20), `debounce` (200), `stalled-delay` (200), `routing`, `search-on-load` (default true) | `sparq:search`, `sparq:error`, `sparq:query-change`, `sparq:refine`, `sparq:page-change` | Provider; renders `<slot>` only; exposes `el.controller`, `el.hooks` |
| `sparq-ssr` | `for` | `sparq:takeover` | Wraps server-rendered HTML; hides on first successful render (§8) |
| `sparq-searchbox` | `placeholder`, `autofocus`, `suggestions`, `min-chars` (1), `for` | `sparq:query-change` (via provider) | ARIA combobox when suggestions active |
| `sparq-items` | child `<template>`, `empty-text`, `skeleton` (default true), `for` | `sparq:item-click` | Items in light DOM (§7); skeleton placeholders + height retention (§17) |
| `sparq-items-infinite` | same + `auto`, `load-more-text` | `sparq:item-click` | Appends via `accumulatedItems` |
| `sparq-filters` | `attribute`\*, `limit` (10), `show-more`, `searchable`, `sort-by` (`count`\|`alpha`), `header`, `for` | `sparq:refine` (via provider) | Checkbox facet list; counts stay correct after selection (§4) |
| `sparq-sort` | `options`\* (`value\|Label` list), `label`, `for` | `sparq:refine` | Select dropdown |
| `sparq-pagination` | `padding` (2), `show-first-last`, `for` | `sparq:page-change` | |
| `sparq-range` | `attribute`\*, `min`, `max`, `step`, `prefix`, `for` | `sparq:refine` | Bounds auto-filled from `facetStats` |
| `sparq-refinements` | `clear-label` ("Clear all"), `for` | `sparq:refine` | Chips + clear-all |
| `sparq-stats` | `template` (default `"{totalItems} results in {processingTimeMs}ms"`), `for` | — | |

\* = required. Parts are kebab-case nouns; state variants are additional part tokens on the same element (`part="link link-active"`); every component root is `part="root"`. Empty/error/loading are parts + named slots (`slot="empty"`, `slot="error"`) on the items widgets, not separate components.

**Terminology:** **item** = one search-result record — used consistently in state (`items`, `totalItems`, `itemsPerPage`), tags (`sparq-items`), events (`sparq:item-click`), and hooks (`transformItems`, `renderItem`). **Facet value** = one filterable value + count. See §19.

Host-page JS interop:

```html
<script>
  document.addEventListener('sparq:item-click', e => analytics.track('result_click', e.detail));
  customElements.whenDefined('sparq-search').then(() => {
    document.querySelector('sparq-search').controller.setQuery('shoes');
  });
</script>
```

All public events are dispatched with `{ bubbles: true, composed: true }` (Vue emits are not composed — never use them for public events).

Attribute conventions: kebab-case attrs ↔ camelCase props; boolean = attribute presence, with `="false"`/`="0"` explicitly parsed as false; comma lists with `value|Label` items; a value starting with `[`/`{` is parsed as JSON; functions/objects are property-only.

## 10. Composables (internal)

| Module | Purpose |
|---|---|
| `useController(reg)` | Provider discovery (§6), registration + symmetric teardown, `for` override, inert error path |
| `useItemsWidget(mode)` | Shared items engine: template compile, light-DOM rendering, skeletons, height retention, click delegation — used by both items widgets |
| `useInfiniteSentinel(ref, cb)` | IntersectionObserver lifecycle for `auto` infinite scroll |
| `findProviderFor(el)` | DOM-ancestor / `for="id"` provider resolution with retry + console diagnostics |
| `events.ts` | `dispatchSparqEvent` — composed + bubbling `sparq:*` CustomEvent dispatch |
| `attrs.ts` | Boolean/number/list/`value\|Label`/JSON attribute parsing conventions |

(The suggestions combobox keyboard handling lives inline in `SearchBox.ce.vue` — it has a single consumer.)

Public JS surface (everything else is internal): `window.SparqSearchUI { version, register(), setClient(), configure() }` and `el.controller`. Composables are not public API in v1; the headless path for JS users is `controller.subscribe()`.

## 11. Extension hooks

Hooks are JS-delivered (functions can't ride HTML attributes), precedence **widget > provider > global**:

1. Global: `SparqSearchUI.configure({ hooks: {…} })`
2. Per provider: `searchEl.hooks = {…}` (after `customElements.whenDefined` or on `sparq:ready`)
3. Per widget: `itemsEl.renderItem`, `filtersEl.transformValues`

| Hook | Signature | Fires | Typical use |
|---|---|---|---|
| `transformRequest` | `(req, {uiState}) => req \| Promise` | before every network call | inject static filters, custom params, boosts |
| `transformResponse` | `(res, {request}) => res \| Promise` | after adapter normalization, before merge | reshape server data before it renders |
| `transformItems` | `(items, {uiState}) => items` | after merge, before widgets render | decorate, reorder, dedupe items |
| `queryHook` | `(query, search) => void` | on query change | rewrite/gate queries; search proceeds only when `search(q)` is called |
| `suggestionsSource` | `(query) => Promise<string[]>` | suggestions fetch | plug any autocomplete source (no API endpoint yet) |
| `onError` | `(error, {retry}) => void \| false` | before widgets show error state | telemetry; `false` suppresses built-in error UI |

Widget-level: `transformValues` on `sparq-filters`/`sparq-refinements` (`(values) => values` — relabel/i18n, reorder, hide); `renderItem` on items widgets (`(item, {index}) => Node | string` — overrides `<template>`; dev-trusted: returned strings are injected as HTML, unlike `{{}}` bindings which are always escaped).

Distinct names on purpose: `transformItems` always means result items, `transformValues` always means facet values.

Async hooks are awaited inside the request pipeline and remain race-guarded. `sparq:*` events are **observe-only**; all interception goes through hooks — one mechanism. `register()` fires a document-level `sparq:ready` event for safe hook-attachment timing.

## 12. CSS isolation — hard guarantees, both directions

**Inbound — host CSS must never break component rendering.**
1. Page selectors (including global `* {}` resets) cannot match inside a shadow root.
2. Property inheritance (`font`, `color`, `text-transform`, … inherit from the host element into shadow content) is severed by an **`all: initial` firewall** on each component's `.sq-root` wrapper, then the baseline is rebuilt from `--sparq-*` tokens. `all` does not reset custom properties, so **tokens + `::part()` are the only two doors in** — both intentional.
3. An **internal reset** ships inside every shadow root: `box-sizing: border-box`, form controls `font: inherit`, margins zeroed.

```css
.sq-root {
  all: initial;                     /* sever all inherited page styles */
  display: block;
  box-sizing: border-box;
  font-family: var(--sparq-font-family, system-ui, sans-serif);
  font-size: var(--sparq-font-size, 0.9375rem);
  line-height: 1.5;
  color: var(--sparq-color-text, #1f2937);
}
.sq-root *, .sq-root *::before, .sq-root *::after { box-sizing: border-box; font: inherit; margin: 0; }
```

Consequences: components do **not** auto-inherit the page font (pages opt in via `--sparq-font-family`); host elements themselves remain page-styleable (that's the page's layout domain — only the interior is sealed); item markup is page-styled light DOM by design.

**Outbound — library CSS must never affect the host page.**
- All component CSS is compiled into shadow roots; the library **never injects styles into `document.head`** and ships no global stylesheet.
- The only host-visible mutations: `<sparq-ssr>` hiding itself, and URL updates when `routing` is on.
- CI enforces both directions: an e2e test asserts `document.head` gains zero style/link nodes and sentinel host-page computed styles are identical before/after load; a hostile-stylesheet test (`* { all: unset !important; text-transform: uppercase !important }`) asserts component interiors are unchanged.

**Theming contract** (tokens read through the shadow boundary; set them on any ancestor):

```
--sparq-font-family, --sparq-font-size
--sparq-color-text, --sparq-color-text-muted
--sparq-color-bg, --sparq-color-bg-elevated
--sparq-color-primary, --sparq-color-primary-contrast
--sparq-color-border, --sparq-color-focus, --sparq-color-error
--sparq-radius, --sparq-radius-sm, --sparq-spacing, --sparq-shadow-popup
```

```html
<style>
  body { --sparq-color-primary: #6d28d9; --sparq-radius: 8px; }
  sparq-searchbox::part(input) { border-width: 2px; }
</style>
```

## 13. URL state sync

`<sparq-search routing>` enables it. Format (stable, versioned with the library major — it is the §8 contract with customer backends):

```
?q=shoes&page=2&sort=price:asc&f.brand=Nike~Adidas&r.price=10-50
```

Only non-default values are written; unrelated params are preserved; `page` is 1-based in URLs. `replaceState` while typing (debounced 400 ms), `pushState` for discrete actions (filter/sort/page) so the back button steps through meaningful states. On load, the URL is parsed into state *before* the first search. `popstate` re-applies with a re-entrancy guard.

## 14. Build, CDN, browser support

- Vite library mode; `@vitejs/plugin-vue` with custom-element mode (`.ce.vue` styles compile into each shadow root — never `document.head`).
- Outputs: `dist/sparq.js` (IIFE, Vue inlined, auto-registers on load, double-load guard, exposes `window.SparqSearchUI`), `dist/sparq.esm.js` (side-effect-free exports) + `dist/sparq.esm.auto.js`.
- CDN: immutable pinned paths (`search-ui@1.4.2/sparq.js`, `max-age=31536000, immutable`) + floating major alias (`search-ui@1/sparq.js`, `max-age=300`).
- **Bundle budget ≤ 70 kB gzip**, enforced by size-limit in CI (currently ~39.5 kB). Levers: no runtime template compiler, no polyfills, shared reset CSS as one string, esbuild minify, `treeshake: 'smallest'` on the IIFE build. Composition (measured): ~70% Vue runtime, ~30% our code — the floor of the Vue-inlined architecture; the next step-change would be Vue Vapor mode (v2 candidate). `SPARQ_ANALYZE=1 pnpm build` emits `dist/stats.html` for size investigations. The ESM build is intentionally only identifier-minified: whitespace and `@__PURE__` annotations are preserved so consumers' bundlers can tree-shake it; browsers should load `sparq.js`.
- **Browser support: Chrome/Edge ≥ 79, Firefox ≥ 78, Safari ≥ 13.1 / iOS ≥ 13.4** (≈99% of traffic). Binding floors: Vue 3 needs native `Proxy`; `::part()` needs Safari 13.1. Build target `es2019`. Fallbacks above the floor: `requestIdleCallback` → `setTimeout` (Safari); no `adoptedStyleSheets` dependency in v1.
- **Hard limitation (README, upfront): IE11 is impossible, ever** — `Proxy` cannot be polyfilled and Shadow DOM has no viable polyfill. Below-floor browsers still get the `<sparq-ssr>` server-rendered page untouched — the enhancement simply never engages.
- SSR frameworks (Nuxt/Next hydration) are a non-goal in v1; `<sparq-ssr>` covers the SEO need without hydration.

## 15. Testing strategy

- **Core (Vitest, node env):** scheduler coalescing/debounce (fake timers); race guard (out-of-order resolutions must not clobber); abort propagation; request builder (registered facets → request fields); zero-count retention; LRU/TTL/in-flight de-dupe; hook pipeline incl. async-hook race guarding; URL sync round-trips; template-engine XSS suite (`onerror` attrs, `javascript:` hrefs, HTML in data).
- **Components (Vitest browser mode, Chromium):** upgrade timing, shadow parts, attribute parsing, provider discovery — real browser because happy-dom diverges exactly where this library lives.
- **E2E (Playwright, built `dist/sparq.js`, plain HTML fixtures, `page.route()` mocks):** search flow; facet toggling; routing reload/back-button; SSR takeover (visible → hidden → stays on API failure); CSS isolation both directions; CLS < 0.05 on takeover and skeleton pages. **Runs on all three engines** — Chromium (Chrome/Edge), Firefox, WebKit (Safari) — as a parallel CI matrix. Chromium-only exceptions: the CLS assertion (`layout-shift` is a Chromium-only API) and the live-store smoke (one engine is enough for an external API). Note: this verifies *current* engine versions; the historical floors (Safari 13.1, Firefox 78) rely on the `es2019` build target + feature fallbacks, not automated runs.
- **CI:** typecheck → unit → browser-mode → build → size-limit → e2e → terminology grep (§19). Lighthouse CI budgets (mobile ≥ 90, CLS < 0.1, TBT < 200 ms) as trend, blocking at v1.0.

## 16. Roadmap

0. Scaffold (workspace, builds, CI) →
1. Core (controller, scheduler, race/cache, hooks, adapter contract, mock client) →
2. Vertical slice (provider + searchbox + items, skeletons + height retention) →
3. Refinement widgets (filters, sort, pagination, range, refinements) →
4. Suggestions combobox, infinite items, theming/a11y pass, widget hooks →
5. URL sync + `<sparq-ssr>` takeover, real adapter verification, e2e + CWV CI, CDN pipeline.

## 17. Performance — Core Web Vitals playbook

**CLS ≈ 0:**
- Atomic takeover swap (§8): fallback hide + first results commit in the same frame.
- **Skeletons stamped from the user's own `<template>`**: during first load (non-SSR pages), `sparq-items` renders `items-per-page` copies of the customer's template with blank values + CSS shimmer — placeholders inherit real item dimensions, so results land with minimal shift. `skeleton="false"` opts out.
- **Pre-upgrade space reservation (documented, JS-only pages):** first paint can happen before the deferred script executes, and nothing library-side can reserve space before its elements upgrade. Pages without an SSR fallback should ship the one-line CSS pattern (verified to bring measured CLS to ~0):
  ```css
  sparq-searchbox:not(:defined) { display: block; min-height: 44px; }
  sparq-items:not(:defined)     { display: block; min-height: 544px; /* rows × row height */ }
  sparq-pagination:not(:defined){ display: block; min-height: 46px; }
  ```
  SSR pages need none of this — the `<sparq-ssr>` fallback occupies the space from the first byte.
- **Widgets reserve their own space post-upgrade:** `sparq-pagination` renders an invisible placeholder row until the first results arrive (appearing later would shift content below); `sparq-stats` always occupies its line height.
- **Height retention:** after first render, `sparq-items` pins its height as `min-height` during subsequent loading states, released after commit — kills the collapse-and-re-expand shift.
- Overlay, never push: dropdowns render in an absolute layer; no widget state change moves surrounding content.
- Docs require `width`/`height` (or `aspect-ratio`) on template images; `loading="lazy"` below the fold.

**LCP:** the SSR fallback is the LCP candidate — script `defer`, zero render-blocking CSS, no fonts. With a fallback present, the first search is idle-scheduled after first paint (`rAF` → `requestIdleCallback`, `setTimeout` fallback); without one it fires on upgrade. Document `<link rel="preconnect" href="https://{app-id}.fast.sparq.ai" crossorigin>` (documented, never injected).

**INP:** one scheduled search per keystroke burst; fragment cloning + keyed patching (no per-item HTML parsing); reads batched in rAF before writes.

**CI:** Playwright asserts CLS < 0.05 via `PerformanceObserver('layout-shift')` on takeover + skeleton fixtures; Lighthouse CI budgets per §15.

## 18. Risks & gotchas (Vue 3 custom elements)

- Vue ≥ 3.5 required (`useHost`); Vue is inlined so customers are insulated, but re-run the browser suite on every Vue bump.
- Vue-emitted events are not composed — all public events go through the manual dispatch helper (CI grep for `emit(` in widgets).
- `@vue/reactivity` double-resolution silently kills reactivity — `resolve.dedupe` in every Vite config + a build assertion.
- Any string/DOM template in a component drags the Vue runtime compiler (~14 kB gz) into the bundle — size-limit catches it.
- Properties set before upgrade shadow accessors — bites hook properties especially; mitigated by `configure()`, `sparq:ready`, and `whenDefined` docs.
- Disconnect/reconnect churn: registration must be idempotent, teardown symmetric.
- Boolean `"false"` attribute strings are truthy by default — parsed centrally in `attrs.ts`.
- Double script inclusion: `register.ts` guards and warns instead of throwing.
- SSR takeover: brief duplicate-content window until first response (accepted); server/JS state drift if a backend disagrees with the routing param contract (§13); content parity is the customer's responsibility (progressive enhancement, not cloaking).
- `renderItem` is the one dev-trusted XSS boundary — `{{}}` bindings are always escaped, `renderItem` returns are not.

## 19. Terminology enforcement

The legacy search-engine term for a result record (used by Algolia and others) is **banned** from this codebase: no code identifiers, file names, public API surface, docs, or samples may use it. The vocabulary is **item / items / results** as defined in §9. The single permitted occurrence is inside `sparqClient.ts`, where the Sparq API's raw total-count wire field is read and immediately renamed to `totalItems`. Enforced mechanically: a CI grep over `packages/*/src` and docs fails the build on any new occurrence, with `sparqClient.ts` as the sole allowlisted file.
