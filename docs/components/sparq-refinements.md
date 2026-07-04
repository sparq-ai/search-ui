# `<sparq-refinements>` — active filter chips

Shows every active refinement (facet values and numeric ranges) as removable chips, plus a clear-all button. Renders nothing when no filters are active.

```html
<sparq-refinements clear-label="Reset all"></sparq-refinements>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `clear-label` | `Clear all` | Clear-all button label |
| `for` | — | Provider `id` |

## JS property: `transformValues`

Relabel or reorder the chips (e.g. i18n, prettifying attribute names):

```js
document.querySelector('sparq-refinements').transformValues = (refinements) =>
  refinements.map((r) => ({
    ...r,
    label: r.attr === 'system_vendor' ? `Brand: ${r.value}` : r.label,
  }));
// refinements: [{ attr, value, label, type: 'facet' | 'numeric' }]
```

## Behavior notes

- Removing a chip un-checks the matching facet value (or clears the numeric range) — the same as toggling it in its own widget.
- Clear-all removes every filter but keeps the query text.

## Shadow parts

`root`, `list`, `chip`, `chip-label`, `chip-remove`, `clear-all`
