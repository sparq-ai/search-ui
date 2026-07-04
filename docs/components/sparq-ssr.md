# `<sparq-ssr>` — server-rendered takeover wrapper

Wraps HTML your server rendered for the current URL. Bots (and browsers without JavaScript) see that HTML; in real browsers it is hidden the instant the **first successful search renders**, so the JS widgets take over without a blank gap. If the script fails to load or the first search errors, the fallback simply stays — graceful degradation for free.

```html
<sparq-search app-id="…" api-key="…" collection="…" routing>
  <sparq-ssr>
    <ul><!-- server-rendered results for ?q=…&page=… --></ul>
    <nav>
      <a href="?page=2">2</a>
      <a href="?f.system_vendor=Nike">Nike</a>
    </nav>
  </sparq-ssr>

  <sparq-searchbox></sparq-searchbox>
  <sparq-items>…</sparq-items>
  <sparq-pagination></sparq-pagination>
</sparq-search>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `for` | — | Provider `id`, when not nested inside one |

## Events

| Event | Fires |
|---|---|
| `sparq:takeover` | Once, when the fallback is hidden (analytics hook) |

## Rules for the fallback content

- Render it **for the current URL's state** and pair it with the provider's `routing` attribute — the library parses the same params (`?q=…&page=…&f.attr=…`), so the JS render matches what the server showed. The [URL format](../seo.md#the-url-contract) is a stable contract.
- Filter and pagination links must be plain crawlable `<a href>` links in that same format.
- Keep content parity with the live render — this is progressive enhancement, not cloaking.
- Do **not** use a global `:not(:defined) { visibility: hidden }` FOUC rule on these pages — the fallback must be visible before the script runs. (Widgets render nothing pre-upgrade anyway.)

Full guide: [SEO & server-rendered takeover](../seo.md).
