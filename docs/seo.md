# SEO & server-rendered takeover

JavaScript-rendered search pages lose ranking with crawlers that don't execute JS. The fix is progressive enhancement: your server renders the results HTML for the current URL, and in browsers the widgets replace it seamlessly. One element makes this a first-class pattern: [`<sparq-ssr>`](./components/sparq-ssr.md).

## The pattern

```html
<sparq-search app-id="…" api-key="…" collection="…" routing>
  <sparq-ssr>
    <!-- Rendered by YOUR backend for the current URL's query/filters/page -->
    <ul class="results">
      <li><a href="/products/nike-runner">Nike Runner — $60</a></li>
      …
    </ul>
    <nav>
      <a href="?page=2">Page 2</a>
      <a href="?f.system_vendor=Nike">Nike</a>
    </nav>
  </sparq-ssr>

  <sparq-searchbox placeholder="Search…"></sparq-searchbox>
  <sparq-items><template>…</template></sparq-items>
  <sparq-pagination></sparq-pagination>
</sparq-search>
```

How it behaves:

| Situation | What renders |
|---|---|
| Crawler without JS / JS disabled | Your server HTML, fully indexable |
| Normal browser | Server HTML paints instantly → hidden the moment the first live results render (widgets take over in the same frame; `sparq:takeover` fires) |
| Script blocked or first search fails | Server HTML **stays** — the page degrades gracefully |
| Browser older than the [support floor](./getting-started.md#browser-support) | The library never engages; server HTML remains usable |

The takeover search is scheduled after first paint (idle time) so it never competes with your page's LCP.

## The URL contract

`routing` must be on: the library parses the URL your server rendered from, so both sides agree on the state. The parameter format is **stable and versioned with the library major** — safe to implement server-side:

```
?q=<query>&page=<1-based>&sort=<key>&f.<attr>=<value>~<value>&r.<attr>=<min>-<max>
```

| Param | Example | Meaning |
|---|---|---|
| `q` | `q=running shoes` | Query text |
| `page` | `page=3` | 1-based page |
| `sort` | `sort=price:asc` | Sort key ([keys](./components/sparq-sort.md#sort-keys)) |
| `f.<attr>` | `f.system_vendor=Nike~Adidas` | Facet values, `~`-separated (OR) |
| `r.<attr>` | `r.price=10-50` (open ends: `10-`, `-50`) | Numeric range |

Only non-default values appear; parameters the library doesn't own are preserved untouched.

## Rules of the road

1. **Content parity.** The fallback should show the same results the live render will — same data, same URL semantics. That's what makes this progressive enhancement rather than cloaking.
2. **Crawlable navigation.** Pagination/filter links in the fallback must be plain `<a href>` links in the URL format above — that's how bots discover deeper pages.
3. **No blanket FOUC guard.** Never ship `:not(:defined) { visibility: hidden }` on SSR pages — the fallback must be visible before the script runs. Widgets render nothing pre-upgrade, so no guard is needed anyway.
4. **`defer` the script** and add `<link rel="preconnect" href="https://{app-id}.fast.sparq.ai" crossorigin>`.
5. A brief window where the fallback and the loading widgets coexist (until the first response) is expected and harmless.

## Do I need this on every page?

No. It matters for pages you want indexed: category/collection landing pages, curated search URLs. An interactive search behind a user action (e.g. a search overlay) has no SEO surface — skip the fallback there and see [Performance](./performance.md) for the layout-reservation pattern instead.
