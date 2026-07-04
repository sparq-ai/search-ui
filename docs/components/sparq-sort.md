# `<sparq-sort>` — sort select

```html
<sparq-sort label="Sort by" options="relevance|Relevance, price:asc|Price ↑, price:desc|Price ↓, title|Title A–Z"></sparq-sort>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `options` * | — | Comma list of `sortKey\|Label` entries (or a JSON array) |
| `label` | — | Text label rendered before the select |
| `for` | — | Provider `id` |

## Sort keys

| Key | Meaning |
|---|---|
| `relevance` (or empty) | Ranked by relevance — clears the sort |
| `field` or `field:asc` | Ascending by `field` |
| `field:desc` | Descending by `field` |

The library translates these to the Sparq API's wire syntax for you.

## Shadow parts

`root`, `label`, `select`
