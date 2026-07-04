# `<sparq-stats>` — result count line

```html
<sparq-stats></sparq-stats>
<!-- → "1,204 results in 12ms" (default template) -->

<sparq-stats template="Page {page} of {totalPages} — {totalItems} matches for “{query}”"></sparq-stats>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `template` | `{totalItems} results in {processingTimeMs}ms` | Text with placeholders |
| `for` | — | Provider `id` |

## Placeholders

| Placeholder | Value |
|---|---|
| `{totalItems}` | Total matching items |
| `{processingTimeMs}` | Server processing time |
| `{page}` | Current page (1-based) |
| `{totalPages}` | Total pages |
| `{query}` | Current query text |

## Behavior notes

Always occupies one line of height (even before the first results) so its appearance never shifts surrounding content.

## Shadow parts

`root`
