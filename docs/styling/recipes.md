# Styling recipes

Worked examples, copy-paste ready. Every selector here uses only the three public surfaces ([tokens](./README.md#1-design-tokens--theme-everything-at-once), [parts](./anatomy.md), [light-DOM hooks](./light-dom.md)) — nothing that can break on library updates.

## Full brand theme (one block)

The 80% case: set tokens once on `:root`, style your item templates with your existing design system, add a couple of part overrides for signature details.

```css
:root {
  --sparq-font-family: 'Inter', system-ui, sans-serif;
  --sparq-color-primary: #0f766e;        /* your brand color */
  --sparq-color-primary-contrast: #fff;
  --sparq-color-focus: #0f766e;
  --sparq-radius: 10px;
  --sparq-radius-sm: 6px;
}

/* signature details via parts */
sparq-searchbox::part(input) { border-width: 2px; }
sparq-pagination::part(link) { border: none; }
sparq-pagination::part(link-active) { background: #0f766e; }
```

## Dark mode

All surface/text colors are tokens, so dark mode is a token swap — scope it to a media query or your `.dark` class:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --sparq-color-text: #e2e8f0;
    --sparq-color-text-muted: #94a3b8;
    --sparq-color-bg: #1e293b;
    --sparq-color-bg-elevated: #334155;
    --sparq-color-border: #475569;
    --sparq-color-primary: #a78bfa;
    --sparq-color-primary-contrast: #1e1b4b;
    --sparq-shadow-popup: 0 8px 24px rgba(0, 0, 0, 0.5);
    --sparq-ac-active-bg: rgba(167, 139, 250, 0.15);
  }
}
```

Live demo: the [theming playground page](../../playground/pages/theming.html) (`pnpm dev` → `/pages/theming.html`).

## Compact density

Almost every padding/gap derives from `--sparq-spacing` — one token makes the whole widget set denser:

```css
sparq-search { --sparq-spacing: 5px; --sparq-font-size: 0.875rem; }
```

## Pills that match your chip design system

```css
sparq-filters::part(pill) {
  border: none;
  background: #f1f5f9;
  padding: 8px 16px;
  font-weight: 500;
}
sparq-filters::part(pill-selected) { background: #0f172a; color: #fff; }
```

## Bigger swatches with square corners

```css
sparq-filters::part(swatch) { width: 34px; height: 34px; border-radius: 8px; }
sparq-filters::part(swatch-selected) {
  box-shadow: none;
  outline: 3px solid #0f172a;
  outline-offset: 2px;
}
```

## Price slider in a different accent

```css
sparq-range { --sparq-color-primary: #059669; }  /* fill + thumbs + focus, scoped */
sparq-range::part(track) { height: 6px; }
```

## Autocomplete panel: width, z-index, active row

```css
sparq-autocomplete::part(panel) { border-radius: 14px; }
sparq-autocomplete { --sparq-z-popup: 100000; }            /* out-z-index a stubborn header */
sparq-autocomplete [data-sparq-ac-wrapper][data-active] {  /* light DOM: full CSS power */
  background: #0f172a;
  color: #fff;
}
```

If the panel clips under a `transform`ed sticky header, move the `<sparq-autocomplete>` element to be a direct child of `<body>` — it finds its input anywhere via the selector ([why](../components/sparq-autocomplete.md#styling)).

## Results as a product grid

The list container is a part; the items are your light DOM:

```css
sparq-items::part(list) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
sparq-items > [data-sparq-item] { display: contents; } /* let your card be the grid cell */
```

## Custom skeleton look

Skeletons are stamped from *your* template into light DOM, so style them like your cards:

```css
sparq-items > [data-sparq-skeleton] .card {
  background: linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9);
  color: transparent;
  border-color: transparent;
}
sparq-items > [data-sparq-skeleton] img { visibility: hidden; }
```

(The pulse animation itself lives in the shadow root and respects your overrides.)

## Hide a piece you don't want

Any part can be hidden — e.g. drop the stats timing or pagination arrows:

```css
sparq-pagination::part(first), sparq-pagination::part(last) { display: none; }
```

(For stats, prefer the `template` attribute: `<sparq-stats template="{totalItems} results">`.)

## Scope a theme to ONE search instance

Tokens inherit down the DOM, so set them on the instance instead of `:root`:

```css
#header-search { --sparq-color-primary: #dc2626; }
#page-search   { --sparq-color-primary: #2563eb; }
```
