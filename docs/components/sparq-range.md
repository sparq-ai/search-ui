# `<sparq-range>` — numeric min/max filter

Filter a numeric attribute (price, discount, rating…) with min/max inputs. The placeholder bounds come from the live result set's statistics for that attribute.

```html
<sparq-range attribute="price" prefix="$" step="1"></sparq-range>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `attribute` * | — | Numeric attribute to filter |
| `min` / `max` | from stats | Override the placeholder bounds |
| `step` | `1` | Input step |
| `prefix` | — | Symbol shown before each input (`$`, `€`, …) |
| `for` | — | Provider `id` |

## Behavior notes

- Applies on `change` (blur / Enter), not on every keystroke.
- Either side may be left open: only-min means "at least", only-max means "at most". Clearing both removes the filter.
- Under the hood the range is sent as part of the request's filter expression (`price >= 10 AND price <= 50`) — combined with any provider-level `filter` attribute.
- With `routing`, ranges serialize as `?r.price=10-50` (open ends: `10-` / `-50`).
- Active ranges appear in [`<sparq-refinements>`](./sparq-refinements.md) as removable chips.

## Shadow parts

`root`, `prefix`, `input-min`, `input-max`, `separator`
