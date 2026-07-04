# `<sparq-items>` — results list

Renders the current page of results. Item markup is defined by **your** `<template>` child and lives in the light DOM — your page CSS styles it directly, no `::part()` needed for item internals. Without a template, a neutral default card renders so the tag works with zero configuration.

```html
<sparq-items empty-text="No products match your search.">
  <template>
    <article class="card">
      <img src="{{image}}" alt="{{title}}" width="160" height="160" loading="lazy" />
      <h3>{{title}}</h3>
      <p>{{vendor}} — ${{price}}</p>
      <a href="{{url}}">View</a>
    </article>
  </template>
</sparq-items>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| child `<template>` | built-in card | Item markup with `{{field}}` bindings |
| `empty-text` | `No results found.` | Message when a search matches nothing |
| `skeleton` | `true` | Placeholder stamps during the first load (`skeleton="false"` to disable) |
| `for` | — | Provider `id`, when not nested inside one |

## Template bindings

- `{{field}}` works in text and attributes; dot paths reach nested data: `{{specs.color}}`.
- Object/array fields render as JSON: `{{variants}}`.
- `{{$item}}` renders the **entire record** as pretty-printed JSON — handy while building a template to see what fields exist:
  ```html
  <template>
    <details><summary>raw item</summary><pre>{{$item}}</pre></details>
  </template>
  ```
- Missing fields render as empty strings.
- **Text bindings are always HTML-escaped** — data can never inject markup.
- `on*` attributes in the template are stripped; `href`/`src`/`srcset` reject `javascript:`/`data:` URLs.
- There is deliberately no raw-HTML binding syntax. If you need full control, use the `renderItem` property below.

## Events

| Event | `detail` |
|---|---|
| `sparq:item-click` | `{ item, index }` — any click inside an item (analytics-ready) |

## Slots (custom empty/error content)

```html
<sparq-items>
  <template>…</template>
  <div slot="empty">Nothing here — try <a href="?q=comics">comics</a>?</div>
  <div slot="error">Search is having a moment. Please retry.</div>
</sparq-items>
```

## JS property: `renderItem`

Full JavaScript rendering, overriding the `<template>`:

```js
document.querySelector('sparq-items').renderItem = (item, { index }) => {
  const el = document.createElement('article');
  el.textContent = `${index + 1}. ${item.title}`;
  return el; // may also return an HTML string — see warning
};
```

> **Security boundary:** strings returned from `renderItem` are injected as HTML and are **your responsibility** — unlike `{{}}` bindings, which are always escaped.

## Built-in Core Web Vitals behavior

- **Skeletons** are stamped from your own template with blank values, so placeholders have the real item dimensions.
- **Height retention**: during page/filter changes the list keeps its previous height (and the previous items, slightly dimmed) until new results commit — no collapse-and-reflow.
- On JS-only pages, also reserve pre-load space — see [Performance](../performance.md).

## Shadow parts

`root`, `list`, `empty`, `error` (item markup is your own light DOM — style it with normal CSS)
