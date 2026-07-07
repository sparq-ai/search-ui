# Light-DOM hooks

Some elements deliberately render **outside** the shadow roots — as direct children of the component tags — so your ordinary page stylesheet styles them with full power: no tokens, no `::part()`, just CSS. This page catalogs every attribute hook the library puts on those elements.

The library **never adds styles or classes of its own** to your light-DOM markup (part of the [isolation guarantee](../theming.md#the-isolation-guarantees)) — only these `data-sparq-*` wrapper attributes.

## Result items — `sparq-items` / `sparq-items-infinite`

Each rendered item is wrapped in a `div` that is a direct child of the component tag:

| Hook | On | Meaning |
|---|---|---|
| `[data-sparq-item]` | item wrapper `div` (value = item index) | one per rendered result |
| `[data-sparq-skeleton]` | placeholder wrapper `div` | first-load skeletons stamped from your template |

```css
/* space between results */
sparq-items > [data-sparq-item] { margin-bottom: 12px; }

/* customize the skeleton shimmer (the pulse animation lives in the shadow;
   your rules here style the placeholder CONTENT stamped from your template) */
sparq-items > [data-sparq-skeleton] .card { background: #f3f4f6; color: transparent; }
```

Inside the wrapper is *your own* `<template>` markup — style it exactly like the rest of your page (`.card h3 { … }`).

## Autocomplete rows

`<sparq-autocomplete>` renders each section's rows as direct children of the tag, slotted into the panel:

| Hook | On | Meaning |
|---|---|---|
| `[data-sparq-ac-wrapper]` | row wrapper `div` (role=option) | one per row across all sections |
| `[data-active]` | additional attribute on the wrapper | the keyboard/hover-highlighted row |
| `[data-sparq-ac-input]` | the built-in `input` | own-input mode only (external inputs are your markup already) |

The wrapper gets default padding and an active background from the shadow stylesheet (`--sparq-ac-active-bg`), but as light DOM your page CSS can override anything:

```css
sparq-autocomplete [data-sparq-ac-wrapper] { padding: 10px 16px; }
sparq-autocomplete [data-sparq-ac-wrapper][data-active] { background: #f3f4f6; }
sparq-autocomplete [data-sparq-ac-input] { border-radius: 999px; }
```

## Server-rendered fallback — `sparq-ssr`

Its children are entirely your server-rendered markup; the library only toggles `hidden` on the `<sparq-ssr>` element itself at takeover. Style the content like any page content.

## The default item card

If `sparq-items` has no `<template>`, it renders a minimal built-in card (inline-styled, intentionally plain). It's a zero-config convenience, not a styling surface — provide a template the moment you care about appearance.

## Naming stability

These `data-sparq-*` attributes are **public API**: they version with the library major, same as attributes and events. Classes inside shadow roots (`.sq-*`) are *not* — never target them.
