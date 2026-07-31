# Component anatomy

For each component: every shadow part (what element it is, when it appears), followed by the design tokens the component consumes. State-variant parts (e.g. `pill-selected`) are *additional* tokens on the same element — `::part(pill)` matches selected pills too; `::part(pill-selected)` matches only selected ones.

All components also expose `part="root"` on their outermost wrapper (the element carrying the style firewall).

Verified against source by `scripts/check-styling-docs.mjs` in CI.

---

## `<sparq-searchbox>`

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `form` | `form` (role=search) | always |
| `input` | the `input type="search"` | always |
| `clear-button` | × `button` | while the input has text |
| `suggestions` | dropdown `ul` (absolute overlay) | suggestions open |
| `suggestion` | suggestion `li` | per suggestion |
| `suggestion-active` | state variant on the active `li` | keyboard/hover highlight |

Tokens: `--sparq-color-bg`, `--sparq-color-bg-elevated`, `--sparq-color-border`, `--sparq-color-primary`, `--sparq-color-primary-contrast`, `--sparq-color-text-muted`, `--sparq-radius`, `--sparq-shadow-popup`, `--sparq-spacing`

```css
sparq-searchbox::part(input) { border-width: 2px; }
sparq-searchbox::part(suggestion-active) { background: #111; color: #fff; }
```

## `<sparq-items>`

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `list` | `div` hosting the item slot | always |
| `empty` | empty-state `div` | zero results |
| `error` | error-state `div` (role=alert) | search failed |

Tokens: `--sparq-color-text-muted`, `--sparq-spacing`

Item markup itself is **light DOM** — see [light-DOM hooks](./light-dom.md).

## `<sparq-items-infinite>`

Everything from `<sparq-items>`, plus:

| Part | Element | Appears |
|---|---|---|
| `sentinel` | 1px `div` observed for auto-load | `auto` mode |
| `load-more-button` | `button` | manual mode, more pages exist |

Tokens: as `<sparq-items>` plus `--sparq-color-primary`, `--sparq-color-primary-contrast`, `--sparq-radius`

## `<sparq-filters>`

Parts vary by `mode`. Common:

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `header` | heading `div` | `header` attribute set |
| `caret` | caret `span` inside the header | `collapsible` |
| `body` | wrapper `div` around everything below the header | `collapsible` |
| `search-input` | `input type="search"` | `searchable` |
| `list` | `ul` (checkbox/single/color-list) or `div` (pill/swatch grids) | always |
| `count` | count `span` | per value (not in swatch mode — count lives in the tooltip/aria-label) |
| `show-more-button` | `button` | `show-more` with overflow |

Checkbox / single / color-list rows:

| Part | Element | Appears |
|---|---|---|
| `item` | `li` | per value |
| `label` | `label` wrapping the row | per value |
| `checkbox` | the `input` (checkbox or radio) | per value |
| `swatch` | color dot `span` | `color-list` mode |

Pill mode:

| Part | Element | Appears |
|---|---|---|
| `pill` | toggle `button` | per value |
| `pill-selected` | state variant | selected pills |

Swatch mode:

| Part | Element | Appears |
|---|---|---|
| `swatch` | color circle `button` | per value |
| `swatch-selected` | state variant | selected swatches |

Tokens: `--sparq-color-bg`, `--sparq-color-border`, `--sparq-color-primary`, `--sparq-color-primary-contrast`, `--sparq-color-text-muted`, `--sparq-radius-sm`, `--sparq-spacing`

```css
sparq-filters::part(count) { font-variant-numeric: tabular-nums; }
sparq-filters::part(swatch-selected) { outline: 2px solid #111; }
```

## `<sparq-menu>`

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `header` | heading `div` | `header` attribute set |
| `caret` | caret `span` inside the header | `collapsible` |
| `list` | `ul` (role=tree) | always |
| `item` | `li` | per visible node |
| `node` | node `button` (indented by depth) | per visible node |
| `node-selected` | state variant | the selected path |
| `count` | count `span` | per node |

Tokens: `--sparq-color-bg-elevated`, `--sparq-color-primary`, `--sparq-color-text-muted`, `--sparq-radius-sm`, `--sparq-spacing`

## `<sparq-sort>`

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `label` | label `span` | `label` attribute set |
| `select` | the `select` | always |

Tokens: `--sparq-color-bg`, `--sparq-color-border`, `--sparq-color-text-muted`, `--sparq-radius`, `--sparq-spacing`

## `<sparq-pagination>`

| Part | Element | Appears |
|---|---|---|
| `root`, `nav` | the `nav` (both tokens on one element) | >1 page |
| `list` | `ul` | always |
| `item` | `li` | per control |
| `link` | every page/arrow `button` | per control |
| `link-active` | state variant | current page |
| `first` / `prev` / `next` / `last` | additional tokens on the arrow buttons | (`first`/`last` need `show-first-last`) |

Tokens: `--sparq-color-bg`, `--sparq-color-border`, `--sparq-color-primary`, `--sparq-color-primary-contrast`, `--sparq-radius-sm`, `--sparq-spacing`

```css
sparq-pagination::part(link) { border-radius: 999px; }
sparq-pagination::part(link-active) { box-shadow: 0 0 0 3px rgba(37, 99, 235, .3); }
```

## `<sparq-range>`

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `header` | heading `div` | `header` attribute set |
| `caret` | caret `span` inside the header | `collapsible` |
| `body` | wrapper `div` around the slider and inputs | `collapsible` |
| `slider` | slider container `div` (pointer surface) | always |
| `track` | background rail `div` | always |
| `fill` | selected-span `div` | always |
| `range-min` / `range-max` | the two native `input type="range"` (keyboard/AT layer; style thumbs via their pseudo-elements only from inside — prefer tokens) | always |
| `prefix` | currency `span`(s) | `prefix` attribute set |
| `input-min` / `input-max` | the two `input type="number"` | always |
| `separator` | – `span` between inputs | always |

Tokens: `--sparq-color-bg`, `--sparq-color-border`, `--sparq-color-focus`, `--sparq-color-primary`, `--sparq-color-text-muted`, `--sparq-radius-sm`, `--sparq-spacing`

```css
sparq-range::part(fill) { background: #059669; }
sparq-range::part(track) { height: 6px; }
```

## `<sparq-rating>`

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `header` | heading `div` | `header` attribute set |
| `row` | threshold `button` | per "N & up" row |
| `row-selected` | state variant | active threshold |
| `stars` | star-glyphs `span` | per row |
| `label` | "& up" `span` | per row |

Tokens: `--sparq-color-bg-elevated`, `--sparq-color-border`, `--sparq-color-primary`, `--sparq-color-text-muted`, `--sparq-radius-sm`, `--sparq-rating-color`, `--sparq-spacing`

## `<sparq-toggle>`

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `toggle` | the `button` (role=switch) | always |
| `track` | switch pill `span` | always |
| `knob` | sliding dot `span` | always |
| `label` | text `span` | always |
| `count` | live match count `span` | when the value has a count |

Tokens: `--sparq-color-bg`, `--sparq-color-border`, `--sparq-color-primary`, `--sparq-color-text-muted`, `--sparq-spacing`

## `<sparq-refinements>`

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | any refinement active |
| `list` | `ul` | always |
| `chip` | refinement `li` | per active filter |
| `chip-label` | text `span` | per chip |
| `chip-remove` | × `button` | per chip |
| `clear-all` | clear-all `button` | always |

Tokens: `--sparq-color-bg-elevated`, `--sparq-color-border`, `--sparq-color-error`, `--sparq-color-primary`, `--sparq-color-text-muted`

## `<sparq-stats>`

| Part | Element | Appears |
|---|---|---|
| `root` | the text `div` (reserves one line height even before results) | always |

Tokens: `--sparq-color-text-muted`

## `<sparq-autocomplete>`

Panel chrome only — the rows are light DOM ([hooks](./light-dom.md#autocomplete-rows)):

| Part | Element | Appears |
|---|---|---|
| `root` | wrapper `div` | always |
| `panel` | the floating panel `div` (fixed-position overlay) | open |
| `section` | per-source `section` | per source with results |
| `section-title` | heading `div` | source has a `title` |
| `view-all` | footer `a` | query mode with results |

Tokens: `--sparq-ac-active-bg`, `--sparq-color-bg`, `--sparq-color-bg-elevated`, `--sparq-color-border`, `--sparq-color-primary`, `--sparq-color-text-muted`, `--sparq-radius`, `--sparq-shadow-popup`, `--sparq-spacing`, `--sparq-z-popup`

## `<sparq-search>`, `<sparq-ssr>`, `<sparq-ac-source>`

No shadow parts: `sparq-search` and `sparq-ssr` render only a `<slot>` (their children are your own markup); `sparq-ac-source` renders nothing. Style the host elements with normal page CSS (they're `display: block`).
