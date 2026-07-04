# Sparq Search UI

Build a complete search frontend for [Sparq.ai](https://sparq.ai) on a plain HTML page — no build tooling, no manual REST calls. One CDN script tag gives you search box, filters, sorting, pagination, and results as native Web Components (written in Vue 3, compiled to Custom Elements).

```html
<script src="https://cdn.sparq.ai/search-ui@1/sparq.js" defer></script>

<sparq-search app-id="acme" api-key="pk_search_xxx" collection="products" routing>
  <sparq-searchbox placeholder="Search products…"></sparq-searchbox>
  <sparq-filters attribute="brand" header="Brand"></sparq-filters>
  <sparq-items></sparq-items>
  <sparq-pagination></sparq-pagination>
</sparq-search>
```

- **SEO-friendly:** wrap your server-rendered results in `<sparq-ssr>` — bots index the HTML, browsers get the interactive takeover.
- **Style-safe both ways:** Shadow DOM + an `all: initial` firewall — your CSS can't break the widgets, and the widgets never touch your page's styles. Theme via `--sparq-*` tokens and `::part()`.
- **Extensible:** hooks to transform requests, responses, and items; bring your own autocomplete source; full JS rendering escape hatch.

**Browser support:** Chrome/Edge 79+, Firefox 78+, Safari 13.1+ (iOS 13.4+). **IE11 is not supported and cannot be** (Vue 3 requires native `Proxy`; Shadow DOM has no polyfill) — in unsupported browsers the `<sparq-ssr>` server-rendered fallback remains fully usable.

**[Documentation](./docs/README.md)** — [getting started](./docs/getting-started.md), component reference, [theming](./docs/theming.md), [JavaScript API & hooks](./docs/javascript-api.md), [SEO](./docs/seo.md), and [performance](./docs/performance.md).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design: layer model, headless core, adapter contract, hooks, CSS isolation guarantees, Core Web Vitals playbook, and roadmap.

## Development

```sh
pnpm install
pnpm dev        # playground with mock data
pnpm test       # core unit tests
pnpm build      # CDN + ESM bundles
pnpm e2e        # Playwright against the built bundle
```
