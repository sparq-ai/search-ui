# `<sparq-perpage>` — results-per-page selector

```html
<sparq-perpage label="Per page" options="12,24,48"></sparq-perpage>
```

A dropdown that lets the shopper choose how many items load per page. Changing it resets to page 1.

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `options` * | — | Comma list of page sizes (or a JSON array), e.g. `12,24,48` |
| `label` | — | Text label rendered before the select |
| `for` | — | Provider `id` |

## Behavior notes

- The active page size is the source of truth. Set the initial value with `items-per-page` on `<sparq-search>`; if that value isn't one of your `options` it's still shown as the selected entry, so the control never contradicts the results.
- Changing the page size resets to page 1 and re-runs the search.
- The JS API is `controller.setItemsPerPage(n)` — read the current value from `controller.state.itemsPerPage`.

## Shadow parts

`root`, `label`, `select`
