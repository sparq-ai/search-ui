# Styling reference

Everything you can customize, component by component. This section is verified against the component source in CI — if a part exists in code, it's documented here.

- **[Component anatomy](./anatomy.md)** — every component's parts (part → element → states) and the design tokens it consumes
- **[Light-DOM hooks](./light-dom.md)** — the attributes on elements you style with *plain page CSS* (result items, skeletons, autocomplete rows)
- **[Recipes](./recipes.md)** — worked examples: full brand theme, dark mode, compact density, common overrides

## The three styling surfaces

Components render in Shadow DOM behind an isolation firewall ([why](../theming.md#the-isolation-guarantees)), so ordinary page selectors can't reach inside. Instead there are exactly three surfaces, from broadest to most surgical:

### 1. Design tokens — theme everything at once

CSS custom properties pierce the shadow boundary. Set them on `:root`, on one `sparq-search`, or on any ancestor:

```css
:root {
  --sparq-color-primary: #6d28d9;
  --sparq-radius: 10px;
}
```

| Token | Default | Drives |
|---|---|---|
| `--sparq-font-family` | `system-ui, -apple-system, 'Segoe UI', sans-serif` | All component text (**not** inherited from the page — set it to match your brand font) |
| `--sparq-font-size` | `0.9375rem` | Base text size |
| `--sparq-color-text` | `#1f2937` | Primary text |
| `--sparq-color-text-muted` | `#6b7280` | Counts, stats, placeholders, secondary text |
| `--sparq-color-bg` | `#fff` | Inputs, buttons, thumbs |
| `--sparq-color-bg-elevated` | `#f3f4f6` | Dropdowns, chips, hover/selected row backgrounds |
| `--sparq-color-primary` | `#2563eb` | Active states, buttons, checkboxes, slider fill, links |
| `--sparq-color-primary-contrast` | `#fff` | Text on primary backgrounds |
| `--sparq-color-border` | `#d1d5db` | Input/button borders, tracks, empty stars |
| `--sparq-color-focus` | primary | Focus rings |
| `--sparq-color-error` | `#dc2626` | Error accents (chip remove hover) |
| `--sparq-radius` | `6px` | Inputs, buttons, panels |
| `--sparq-radius-sm` | `4px` | Small controls (checkboxes rows, page links) |
| `--sparq-spacing` | `8px` | Base spacing unit — paddings and gaps derive from it (compact/comfortable density lever) |
| `--sparq-shadow-popup` | soft shadow | Suggestions dropdown, autocomplete panel |
| `--sparq-z-popup` | `9999` | Autocomplete panel z-index |
| `--sparq-ac-active-bg` | `rgba(37, 99, 235, 0.08)` | Active (keyboard-highlighted) autocomplete row |
| `--sparq-rating-color` | `#f59e0b` | Filled stars in `sparq-rating` |

Per-component consumption is listed in [anatomy](./anatomy.md) — so you know exactly what a token change touches.

### 2. `::part()` — restyle specific elements

Every interactive element inside a component exposes a part. Parts accept any CSS, including properties tokens don't cover:

```css
sparq-searchbox::part(input) { border-width: 2px; font-style: italic; }
sparq-pagination::part(link-active) { background: #111; color: #fff; }
```

**State variants** are extra part tokens on the same element (there are no `::part(x):hover`-style combinators for state — but real pseudo-classes like `:hover`/`:focus` do work on parts):

```css
sparq-filters::part(pill) { /* every pill */ }
sparq-filters::part(pill-selected) { /* selected pills only (also matches ::part(pill)) */ }
sparq-pagination::part(link):hover { border-color: currentColor; }
```

The full part catalog per component: [anatomy](./anatomy.md).

### 3. Light DOM — your markup, your CSS

Result items, skeleton placeholders, and autocomplete rows render **outside** the shadow roots, as children of the component tags — deliberately, so your page stylesheet styles them directly with no tokens or parts involved. The hooks (like `[data-sparq-item]`, `[data-active]`) are cataloged in [light-DOM hooks](./light-dom.md).

## What you cannot style (by design)

- Interior layout/structure beyond what parts expose — the isolation firewall guarantees host CSS can never *break* a component, which also means it can't arbitrarily reach inside. If a part you need is missing, request it — adding parts is cheap.
- `<sparq-search>`, `<sparq-ssr>`, `<sparq-ac-source>` have no shadow parts (they render only slots or nothing). The host elements themselves are ordinary elements — position and size them with normal page CSS like any `div`.
