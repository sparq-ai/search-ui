# `<sparq-items-infinite>` — infinite scroll / load more

Like [`<sparq-items>`](./sparq-items.md) (same template system, same events, same `renderItem` property), but pages **append** instead of replacing. Two modes:

```html
<!-- Auto: an IntersectionObserver sentinel loads the next page as you scroll -->
<sparq-items-infinite auto>
  <template>…</template>
</sparq-items-infinite>

<!-- Manual: a button -->
<sparq-items-infinite load-more-text="Show more">
  <template>…</template>
</sparq-items-infinite>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| child `<template>` | built-in card | Same as `<sparq-items>` |
| `auto` | off | Load the next page automatically when the sentinel scrolls into view (200 px early) |
| `load-more-text` | `Load more` | Button label (non-`auto` mode) |
| `empty-text` | `No results found.` | Empty-state message |
| `skeleton` | `true` | First-load placeholders |
| `for` | — | Provider `id` |

## Behavior notes

- Any refinement (new query, filter, sort) resets the accumulated list back to page one — you never see mixed result sets.
- The load-more button hides on the last page; `auto` mode simply stops.
- Don't combine with `<sparq-pagination>` on the same provider — pick one navigation model.

## Events

`sparq:item-click` — `{ item, index }`, same as `<sparq-items>`.

## Shadow parts

`root`, `list`, `empty`, `error`, `load-more-button`, `sentinel`
