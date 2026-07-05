# `<sparq-range>` — numeric range slider

Dual-thumb slider plus min/max number inputs for filtering a numeric attribute (price, discount, rating…). The slider bounds come from the live result set's statistics for that attribute.

```html
<sparq-range attribute="price" prefix="$" step="5"></sparq-range>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `attribute` * | — | Numeric attribute to filter |
| `min` / `max` | from stats | Fix the slider bounds instead of deriving them from results |
| `step` | `1` | Slider/keyboard/input step |
| `prefix` | — | Symbol shown before the inputs and in screen-reader value text (`$`, `€`, …) |
| `for` | — | Provider `id` |

## Interaction model

- **Drag a thumb** — or **press anywhere on the track** to jump the *nearest* thumb there and keep dragging. Works with mouse and touch on every supported engine.
- **Keyboard**: `Tab` to a thumb, then arrow keys (steps by `step`), `Home`/`End`. The thumbs are native range inputs, so screen readers announce them with `aria-valuetext` including your `prefix`.
- **Number inputs** remain for precision entry; they clamp into the bounds and sync with the thumbs both ways.
- Changes are **debounced (300 ms)** while sliding/typing and **applied immediately on release** — a drag produces exactly one search.
- Thumbs can touch but never cross.

## Filter semantics

- A thumb resting on its bound is an *open* side: only the narrowed side is sent (`price >= 90`).
- Selecting the full span **clears the filter entirely** — no `r.price` in the URL, no refinement chip.
- With `routing`, ranges serialize as `?r.price=90-150` (open ends: `90-` / `-150`); URL-seeded values position the thumbs on load, clamped into the discovered bounds.
- Active ranges appear in [`<sparq-refinements>`](./sparq-refinements.md) as removable chips; clear-all resets the thumbs to the bounds.

## Bounds policy

Bounds come from the result stats and adapt as the query changes — but they **freeze while this attribute has an active filter** (stats then reflect the filtered set, and following them would collapse the slider onto its own selection). Explicit `min`/`max` attributes always win. Until stats first arrive the slider renders inert at fixed height (no layout shift) and the number inputs still work.

## Shadow parts

`root`, `slider`, `track`, `fill`, `range-min`, `range-max`, `prefix`, `input-min`, `input-max`, `separator`

```css
sparq-range::part(fill) { background: #059669; }
sparq-range::part(track) { height: 6px; }
```
