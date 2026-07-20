# `<sparq-menu>` — hierarchical category menu

Drill-down tree over a hierarchical facet attribute whose values are delimiter-separated paths (`Men >>> Shoes >>> Trail`). Click to drill in; click the selected node to step back up.

```html
<sparq-menu attribute="categories" header="Browse"></sparq-menu>
```

## Data convention (required)

Each item's facet attribute must carry its **full ancestor chain** as separate values:

```json
{ "name": "Peak Trail", "categories": ["Men", "Men >>> Shoes", "Men >>> Shoes >>> Trail"] }
```

That's what makes both halves work with a single request: selecting any level filters by exact facet value, and the facet response carries counts for every level. (Same convention as store-ui and Algolia's hierarchical facets.)

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `attribute` * | — | The hierarchical facet attribute |
| `header` | — | Heading above the tree |
| `separator` | `>>>` | Path delimiter in your data |
| `max-depth` | `3` | Levels rendered; deeper paths are ignored |
| `collapsible` | off | Makes the header a toggle button that shows/hides the body |
| `collapsed` | off | Start collapsed (only meaningful with `collapsible`) |
| `for` | — | Provider `id` |

## Behavior

- **Drill-down**: roots render collapsed; selecting a node reveals its children and filters results to that subtree. One selected path at a time (menu semantics — switching branches replaces, never ORs).
- **Step back**: clicking the selected node re-selects its parent; clicking a selected root clears the filter.
- Counts are the server's disjunctive counts per path — sibling categories stay visible with correct numbers while you're drilled in. Levels missing from your data are synthesized with the sum of their children.
- With `routing`, the selected path round-trips through the URL (`?f.categories=Men%20%3E%3E%3E%20Shoes`) — reload and back/forward restore both the filter and the expanded lineage. The selection shows in [`<sparq-refinements>`](./sparq-refinements.md) as a chip.
- Proper tree semantics for assistive tech (`role="tree"`, `aria-level`, `aria-expanded`, `aria-selected`).

## JS property

`transformValues` — `(values) => values` over the raw facet values *before* tree-building (hide subtrees, rewrite labels — note it operates on full path strings).

## Shadow parts

`root`, `header`, `list`, `item`, `node` / `node-selected`, `count`, `caret`, `body`

```css
sparq-menu::part(node-selected) { color: #111; }
```
