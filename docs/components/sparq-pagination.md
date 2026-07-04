# `<sparq-pagination>` — page navigation

```html
<sparq-pagination padding="2" show-first-last></sparq-pagination>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `padding` | `2` | Number of page buttons on each side of the current page |
| `show-first-last` | off | Adds « first / last » buttons |
| `for` | — | Provider `id` |

## Behavior notes

- Hidden automatically when there's a single page of results.
- Before the first results arrive it occupies its final height invisibly, so appearing never shifts the content below it (see [Performance](../performance.md)).
- Changing any filter or the query resets to page 1 automatically.
- Page numbers are 1-based for people (buttons, URLs); the JS API is 0-based.

## Events

Page changes surface on the provider as `sparq:page-change` — `{ page }` (0-based).

## Shadow parts

`root`, `nav`, `list`, `item`, `link` (current page also carries `link-active`), `prev`, `next`, `first`, `last`

```css
sparq-pagination::part(link-active) { background: #111; color: #fff; }
```
