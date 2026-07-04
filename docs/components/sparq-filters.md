# `<sparq-filters>` — facet checkbox list

Filter on one text facet attribute. Values within one attribute combine as **OR** (Nike or Adidas); different attributes combine as **AND**.

```html
<sparq-filters attribute="system_vendor" header="Vendor" limit="8" show-more searchable></sparq-filters>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `attribute` * | — | The facet attribute (must be configured as a text facet in your collection) |
| `header` | — | Heading above the list |
| `limit` | `10` | Values shown before "Show more" |
| `show-more` | off | Adds the Show more / Show less toggle |
| `searchable` | off | Adds a small search input to filter long value lists |
| `sort-by` | `count` | `count` (descending) or `alpha` |
| `for` | — | Provider `id` |

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

`root`, `header`, `search-input`, `list`, `item`, `label`, `checkbox`, `count`, `show-more-button`

```css
sparq-filters::part(count) { font-variant-numeric: tabular-nums; }
```
