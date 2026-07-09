# `<sparq-filters>` — facet list (5 display modes)

Filter on one text facet attribute. Five rendering modes via the `mode` attribute; in every multi-select mode, values within one attribute combine as **OR** (Nike or Adidas) and different attributes combine as **AND**.

```html
<sparq-filters attribute="system_vendor" header="Vendor" limit="8" show-more searchable></sparq-filters>
<sparq-filters attribute="size" header="Size" mode="pill"></sparq-filters>
<sparq-filters attribute="gender" header="Gender" mode="single"></sparq-filters>
<sparq-filters attribute="color" header="Color" mode="swatch"
               colors='{"Storm":"black/white","Multi":"*","Clear":"#"}'></sparq-filters>
```

## Modes

| `mode` | Rendering | Selection |
|---|---|---|
| `checkbox` (default) | Checkbox rows with counts | multi (OR) |
| `single` | Radio rows | one value; clicking the selected value clears |
| `pill` | Toggle buttons with counts | multi (OR) |
| `swatch` | Color circles (value as tooltip/label) | multi (OR) |
| `color-list` | Checkbox rows with a color dot | multi (OR) |

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `attribute` * | — | The facet attribute (must be configured as a text facet in your collection) |
| `mode` | `checkbox` | Display mode (table above) |
| `colors` | — | JSON map for swatch/color-list: facet value → color code (see below) |
| `header` | — | Heading above the list |
| `limit` | `10` | Values shown before "Show more" |
| `show-more` | off | Adds the Show more / Show less toggle |
| `searchable` | off | Adds a small search input to filter long value lists |
| `sort-by` | `count` | `count` (descending) or `alpha` |
| `for` | — | Provider `id` |

## Color codes (`swatch` / `color-list`)

Values resolve in order: the `colors` map (case-insensitive) → the raw facet value as a CSS color. Codes:

| Code | Renders |
|---|---|
| any CSS color (`#0ea5e9`, `navy`, `rgb(...)`) | solid swatch |
| `"a/b"` (e.g. `black/white`) | two-tone diagonal gradient |
| `"*"` | multicolor wheel |
| `"#"` | "clear/none" swatch |
| unresolvable | neutral hatched swatch (never breaks) |

Large maps fit better as a property: `filtersEl.colors = {...}` (same shape, wins over the attribute).

Related widgets: [`<sparq-rating>`](./sparq-rating.md) for star-rating facets, [`<sparq-toggle>`](./sparq-toggle.md) for a single on/off value like availability.

## Counts that behave correctly

After you check "Nike", the other vendors **stay visible with the counts they'd have** — while every *other* facet reflects the Nike filter. The Sparq backend computes these disjunctive counts server-side in the same single request. A checked value whose count drops to zero stays visible (checked, count 0) so users can always un-check it.

## JS property: `transformValues`

Reorder, relabel (i18n), or hide facet values before render:

```js
document.querySelector('sparq-filters[attribute="system_vendor"]').transformValues = (values) =>
  values.filter((v) => v.value !== 'internal-test');
// values: [{ value: string, count: number, selected: boolean }]
```

## Shadow parts

`root`, `header`, `search-input`, `list`, `item`, `label`, `checkbox`, `count`, `show-more-button`; selected rows also carry `item-selected` / `label-selected`; pill mode adds `pill` / `pill-selected`; swatch modes add `swatch` / `swatch-selected`.

```css
sparq-filters::part(count) { font-variant-numeric: tabular-nums; }
sparq-filters::part(pill-selected) { background: #111; }
```
