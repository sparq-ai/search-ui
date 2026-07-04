# `<sparq-searchbox>` — query input

Search-as-you-type input (debounced by the provider's `debounce`, default 200 ms), with a clear button and an optional suggestions dropdown.

```html
<sparq-searchbox placeholder="Search products…" autofocus suggestions min-chars="2"></sparq-searchbox>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `placeholder` | `Search…` | Input placeholder |
| `autofocus` | off | Focus the input on load |
| `suggestions` | off | Show the autocomplete dropdown (needs a source — see below) |
| `min-chars` | `1` | Minimum characters before suggestions are fetched |
| `for` | — | Provider `id`, when placed outside the provider (e.g. page header) |

## Suggestions need a source

The Sparq API has no suggestions endpoint yet, so the dropdown stays hidden unless you provide one via the `suggestionsSource` hook:

```html
<script>
  document.addEventListener('sparq:ready', () => {
    document.querySelector('sparq-search').hooks = {
      suggestionsSource: (q) =>
        fetch('/my/autocomplete?q=' + encodeURIComponent(q)).then((r) => r.json()),
    };
  });
</script>
```

Keyboard support: `↑`/`↓` move through suggestions, `Enter` picks (or submits the typed query), `Escape` closes. The dropdown overlays the page — it never pushes content down.

## Behavior notes

- Pressing `Enter` searches immediately, skipping the debounce.
- With `routing` enabled, external state changes (back button, page JS) update the input — but never while you're typing in it.
- Gate or rewrite queries (minimum length, trimming, blocklists) with the [`queryHook`](../javascript-api.md#hooks).

## Shadow parts

`root`, `form`, `input`, `clear-button`, `suggestions`, `suggestion` (active option also carries `suggestion-active`)

```css
sparq-searchbox::part(input) { border-width: 2px; }
sparq-searchbox::part(suggestion-active) { background: #111; }
```
