# CLAUDE.md

Sparq Search UI: Web Components search frontend (Vue 3 SFCs → custom elements, Vue bundled). Customers build search pages in plain HTML — zero build step, one CDN script. Full design: `ARCHITECTURE.md` (source of truth). Priorities: `GAP-ANALYSIS.md`.

## Commands

```sh
pnpm dev                # playground (mock data) → localhost:5173
pnpm test               # all unit tests (core + components)
pnpm build              # ESM + IIFE bundles
pnpm size               # bundle budget — HARD LIMIT 70 kB gzip
pnpm exec playwright test -c e2e/playwright.config.ts [spec]   # e2e, 3 engines
pnpm lint:terminology   # banned-word check
pnpm lint:styling-docs  # parts/tokens ↔ docs drift check
cd packages/components && pnpm exec vue-tsc --noEmit --noUnusedLocals --noUnusedParameters  # strict pass
```

Live-store e2e smoke: credentials in gitignored `e2e/.env` (copy `.env.example`); self-skips without them.

## Reuse before you write — canonical utilities

Search these before writing any new helper; duplicating one fails review:

| Need | Use | Where |
|---|---|---|
| Parse attributes (bool/num/list/`value\|Label`/JSON) | `parseBoolAttr` etc. | `components/src/attrs.ts` |
| Dispatch public events | `dispatchSparqEvent` (composed+bubbling) — NEVER Vue `emit` for public events | `components/src/events.ts` |
| Find provider / register widget | `useController`, `findProviderFor` | `components/src/composables/` |
| Resolve API client (element prop > global > `mock:` > real) | `createLazyClient` | `components/src/clientResolution.ts` |
| Render user `<template>` markup | `compileItemTemplate` (XSS-safe; no alternatives) | `core/src/template/` |
| Canonical requests / cache keys | `buildRequest`, `canonicalKey`, `LruCache` | `core/src/controller/` |
| Demo/test search engine | `createMockClient` (multi-collection, array fields, disjunctive) | `core/src/client/mockClient.ts` |
| Shadow-root baseline styles | `RESET_CSS` prepended via `register.ts` `toElement()` | `components/src/styles/reset.ts` |

**Pure-logic pattern (mandatory for non-trivial widgets):** extract decision logic into a DOM-free module + exhaustive unit tests, keep the `.ce.vue` thin. Precedents: `rangeLogic.ts`, `acLogic.ts`, `menuTree.ts`, `swatchColors.ts` — imitate them.

## DX bar — every consumer-facing feature ships ALL of

1. **Zero-build usability**: works from plain HTML attributes; functions/objects are JS properties, never attributes.
2. **Conventions**: kebab-case attrs; boolean = presence (parse `"false"`/`"0"` as false via `attrs.ts`); events named `sparq:*`, observe-only.
3. **Styling surface**: parts on every interactive element (state variants = extra part tokens, e.g. `pill pill-selected`); colors/spacing via `--sparq-*` tokens only. `lint:styling-docs` fails CI if a part/token is missing from `docs/styling/anatomy.md`.
4. **Actionable errors**: misconfiguration → `console.error('[sparq] <tag> needs …')` naming the element and the fix; widget renders inert, never throws.
5. **Docs page** (`docs/components/<tag>.md`: example first, attribute table, events, parts) + **playground page** demoing it + **3-engine e2e spec** + **gap-analysis strikethrough** if it closes a tracked item.

## Hard rules

- The word "hits" is **banned** everywhere except `core/src/client/sparqClient.ts` (wire-field rename). CI greps.
- **One API request per search** — load-bearing contract (server-side disjunctive facets). Never add client-side fan-out to `SearchController`.
- CSS isolation both ways: never inject into `document.head`; never style the consumer's light-DOM markup; every shadow tree starts with `RESET_CSS` (`all: initial` firewall).
- `sparqClient.ts` is the ONLY file that may know REST specifics.
- Everything exported from `packages/*/src/index.ts` + `cdn.ts` is public API — don't remove/rename casually.
- `lib/` is a CI-managed build artifact — never hand-edit.
- Never write the literal skip-ci token in commit messages (it skips CI).
- Cross-engine e2e is not optional: WebKit/Firefox have twice caught bugs Chromium passed (radio activation revert, range-thumb pointer-events).

## Workflow

Feature branch → PR → user merges. Never push to `main`; never merge PRs yourself. Before pushing: `pnpm test`, strict vue-tsc pass, `pnpm build`, `pnpm size`, both lint checks, full e2e. After a `main` merge, CI pushes a `lib/` refresh commit — `git pull --rebase` before branching.
