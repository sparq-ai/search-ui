# `<sparq-toggle>` — single-value switch

An on/off switch applying one facet value — the classic "In stock only" control, usable for any attribute/value pair.

```html
<sparq-toggle attribute="system_availability" value="in stock" label="In stock only"></sparq-toggle>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `attribute` * | — | Facet attribute to filter |
| `value` * | — | The facet value the switch applies |
| `label` | the `value` | Text next to the switch |
| `for` | — | Provider `id` |

## Behavior

- On = the value is applied as a facet filter (`f.system_availability=in stock` with `routing`); off removes it. Combines with every other widget as usual (AND across attributes).
- Shows the live match count for the value next to the label.
- Proper `role="switch"` semantics with `aria-checked`; state restores from the URL on load and clears via [`<sparq-refinements>`](./sparq-refinements.md) chips/clear-all.

## Shadow parts

`root`, `toggle`, `track`, `knob`, `label`, `count`
