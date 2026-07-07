# Theming

> Looking for the complete catalog — every part on every component, per-component token consumption, light-DOM hooks, and worked recipes? See the **[Styling reference](./styling/README.md)** (CI-verified against source).

Every component renders inside Shadow DOM with a hard isolation boundary — styling flows through exactly **two doors**, both intentional:

1. **Design tokens** (`--sparq-*` custom properties) — set them on any ancestor; they pierce inward.
2. **`::part()` selectors** — structural overrides on exposed elements.

Everything else is sealed, in *both* directions (see [guarantees](#the-isolation-guarantees) below).

## Door 1: design tokens

```html
<style>
  /* site-wide */
  :root {
    --sparq-color-primary: #6d28d9;
    --sparq-radius: 10px;
  }
  /* or scoped to one search instance */
  #header-search { --sparq-color-primary: #059669; }
</style>
```

| Token | Default | Used for |
|---|---|---|
| `--sparq-font-family` | `system-ui, …` | All component text (**not** inherited from your page — set this to match your brand font) |
| `--sparq-font-size` | `0.9375rem` | Base text size |
| `--sparq-color-text` | `#1f2937` | Primary text |
| `--sparq-color-text-muted` | `#6b7280` | Counts, stats, placeholders |
| `--sparq-color-bg` | `#fff` | Inputs, buttons |
| `--sparq-color-bg-elevated` | `#f3f4f6` | Dropdown, chips |
| `--sparq-color-primary` | `#2563eb` | Active states, buttons, checkboxes |
| `--sparq-color-primary-contrast` | `#fff` | Text on primary |
| `--sparq-color-border` | `#d1d5db` | Input/button borders |
| `--sparq-color-focus` | primary | Focus outlines |
| `--sparq-color-error` | `#dc2626` | Error accents |
| `--sparq-radius` / `--sparq-radius-sm` | `6px` / `4px` | Corner rounding |
| `--sparq-spacing` | `8px` | Base spacing unit (paddings/gaps derive from it) |
| `--sparq-shadow-popup` | soft shadow | Suggestions dropdown |

A complete dark theme is just tokens — see the [theming playground page](../playground/pages/theming.html).

## Door 2: `::part()`

Each component's reference page lists its parts. State variants are extra tokens on the same part (`link link-active`), so:

```css
sparq-searchbox::part(input) { border-width: 2px; font-style: italic; }
sparq-pagination::part(link-active) { background: #111; color: #fff; }
sparq-filters::part(count) { font-variant-numeric: tabular-nums; }
```

## Your item markup is a third, fully open area

Result items render in the **light DOM** from your own `<template>` — ordinary elements styled by ordinary page CSS. No tokens or parts needed there; your design system applies directly.

## The isolation guarantees

**Your CSS can't break the widgets.** Page selectors (even `* { } !important` resets) can't match inside shadow roots, and inherited properties (font, text-transform, letter-spacing…) are severed at each component's boundary by an `all: initial` firewall, then rebuilt from tokens. The trade-off: components don't automatically inherit your page font — set `--sparq-font-family` to opt in.

**The widgets can't break your page.** The library never injects a stylesheet into `document.head` and adds no classes or styles to your item markup. Both directions are enforced by automated tests (a hostile-CSS test and a zero-head-mutation test run in CI).

The host elements themselves (`sparq-items` as a box in your layout) are yours to position — grid, flex, width, margin all work normally; only the interiors are sealed.
