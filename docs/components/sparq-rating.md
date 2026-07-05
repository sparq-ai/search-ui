# `<sparq-rating>` — star-rating facet

"N stars & up" rows filtering a numeric rating attribute (`rating >= N`). One threshold at a time; clicking the selected row clears it.

```html
<sparq-rating attribute="average_rating" header="Rating"></sparq-rating>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `attribute` * | — | Numeric rating attribute on your items |
| `header` | — | Heading above the rows |
| `max` | `5` | Star scale; renders rows from `max-1` & up down to `1` & up |
| `and-up-label` | `& up` | Suffix text |
| `for` | — | Provider `id` |

## Behavior

- Selecting "4 & up" applies the numeric filter `attribute >= 4` — with `routing` it serializes as `?r.average_rating=4-`, shows as a removable chip in [`<sparq-refinements>`](./sparq-refinements.md), and restores from the URL on load.
- Rows behave as a radio group (`role="radiogroup"`, keyboard accessible); re-clicking the active row removes the filter.
- Filled stars use `--sparq-rating-color` (default amber).

## Shadow parts

`root`, `header`, `row` / `row-selected`, `stars`, `label`
