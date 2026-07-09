# `<sparq-pagination>` — page navigation

```html
<sparq-pagination padding="2" show-first-last></sparq-pagination>

<!-- minimal two-button pager -->
<sparq-pagination mode="prevnext"></sparq-pagination>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `mode` | `numbered` | `numbered` for the full page-number list, or `prevnext` for a minimal Prev / Next pager with a "Page X of Y" status |
| `padding` | `2` | Number of page buttons on each side of the current page (`numbered` mode) |
| `show-first-last` | off | Adds « first / last » buttons (`numbered` mode) |
| `prev-label` | `‹ Prev` | Button text for the previous-page button (`prevnext` mode) |
| `next-label` | `Next ›` | Button text for the next-page button (`prevnext` mode) |
| `for` | — | Provider `id` |

## Behavior notes

- Hidden automatically when there's a single page of results.
- Before the first results arrive it occupies its final height invisibly, so appearing never shifts the content below it (see [Performance](../performance.md)).
- Changing any filter or the query resets to page 1 automatically.
- Page numbers are 1-based for people (buttons, URLs); the JS API is 0-based.

## Events

Page changes surface on the provider as `sparq:page-change` — `{ page }` (0-based).

## Shadow parts

`root`, `nav`, `list`, `item`, `link` (current page also carries `link-active`), `prev`, `next`, `first`, `last`, `status` (the "Page X of Y" text in `prevnext` mode)

```css
sparq-pagination::part(link-active) { background: #111; color: #fff; }
```
