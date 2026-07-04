# Manual testing guide

Two setups cover everything: the **playground** (mock data, instant, no credentials) and the **live fixture** (your real store through the built CDN bundle).

## Setup A — Playground (mock data)

```sh
pnpm dev        # → http://localhost:5173
```

Work through the pages in order; each covers one feature area.

### `/pages/basic.html` — core search loop

- [ ] Type "nike" slowly → results update per keystroke burst (debounced), stats line updates
- [ ] DevTools → Network: **exactly one request per pause** — never a burst of requests
- [ ] Search "nike", clear, search "nike" again → the repeat is served from cache (no new network request)
- [ ] Pagination: page buttons, first/last arrows; changing the query resets to page 1
- [ ] Clear button (×) empties the query and restores all results
- [ ] Empty state: search gibberish → the empty-text message appears

### `/pages/facets.html` — filters, sort, range, routing

- [ ] Check **Nike** → other brands stay listed with correct counts (disjunctive counts); category counts change to reflect the Nike filter; a chip appears
- [ ] Check a second brand → OR within the attribute; check a category → AND across attributes
- [ ] A checked value never disappears from the list, even at count 0
- [ ] Price range: set min/max, blur → results filter, chip appears
- [ ] "Reset all" clears filters but keeps the query text
- [ ] Sort dropdown visibly reorders results
- [ ] **URL sync**: URL updates as you refine (`?q=…&f.brand=…&r.price=…`); Back/Forward steps through your actions; reload restores everything (checkboxes, page, range); the URL pasted into a new tab reproduces the state
- [ ] Suggestions: 2+ chars → dropdown; ↑/↓ navigate, Enter picks, Esc closes; the dropdown **overlays** results (never pushes them down)
- [ ] Facet search box (Brand) filters long value lists; Show more / Show less toggles

### `/pages/templates.html` — customer item markup

- [ ] Items render with the page's own markup and CSS
- [ ] Inspect an item: it's plain light-DOM HTML (no shadow root) — your CSS applies directly

### `/pages/theming.html` — tokens and parts

- [ ] The dark theme is built purely from `--sparq-*` tokens and `::part()` rules
- [ ] In DevTools, change a token live on `sparq-search` (e.g. `--sparq-color-primary: red`) → widgets update

### `/pages/ssr.html` — SEO takeover

- [ ] DevTools → Network → throttle **Slow 3G**, reload: the "server-rendered fallback" badge stays visible during load, then the JS render replaces it in one clean swap (console logs the `sparq:takeover` event)
- [ ] Disable JavaScript (DevTools ⌘⇧P → "Disable JavaScript"), reload: the fallback stays permanently and its links work

### `/pages/infinite.html` — infinite scroll

- [ ] Scrolling to the bottom appends the next page (repeat to the end — it stops on the last page)
- [ ] Changing the query mid-list resets to a fresh page one

### `/pages/hooks.html` — extension hooks

- [ ] A 1-character query does **not** search (queryHook gate); 2+ characters do
- [ ] Results show the computed green "DEAL" field (`transformResponse`)
- [ ] Clicking a result fills the analytics log (`sparq:item-click`)
- [ ] Suggestions come from the custom `suggestionsSource` function

## Setup B — Your real store (live API)

```sh
pnpm build && node e2e/serve.mjs 4517
```

Open the live fixture with your credentials **in the URL** (they never live in files):

```
http://127.0.0.1:4517/e2e/fixtures/live.html?appId=YOUR_APP_ID&apiKey=YOUR_SEARCH_KEY&collection=YOUR_COLLECTION
```

- [ ] Real products render; stats shows real totals and server timing
- [ ] Search real titles from your catalog
- [ ] Vendor facet counts match your catalog; refining keeps other vendors listed
- [ ] DevTools → Network: inspect the actual `/v2` request/response payloads the adapter sends
- [ ] Mangle the `apiKey` param → the error state renders ("Invalid API key")

## Cross-cutting checks (any page)

- [ ] **CSS isolation**: open `http://127.0.0.1:4517/e2e/fixtures/isolation.html` — the page CSS demands cursive/uppercase/7px-letter-spacing on everything with `!important`; widget interiors must look completely normal
- [ ] **Events**: in the console — `document.addEventListener('sparq:search', e => console.log(e.detail))` — every search's payload flows by
- [ ] **Programmatic control**: `document.querySelector('sparq-search').controller.setQuery('batman')` from the console drives the UI
- [ ] **CWV**: run Lighthouse on `http://127.0.0.1:4517/e2e/fixtures/cls.html` — CLS ≈ 0; on Slow 3G you should see skeleton placeholders sized like real items, and no layout jump when results land
- [ ] **Other browsers**: repeat a quick pass in Safari and Firefox (support floor: Safari 13.1+, Firefox 78+)

## When something looks wrong

- Widget renders nothing → check the console: a widget outside a provider logs a clear error (fix nesting or add `for="id"`)
- No results & no error → confirm `collection` and that `search-on-load` isn't set to `"false"`
- Mock pages blank → `window.__SPARQ_MOCK__` must be set *before* the library script tag
- Every automated equivalent of this checklist also runs in CI (`pnpm test`, `pnpm e2e`)
