/** Pure logic behind <sparq-autocomplete> — unit-tested in isolation. */

/** Move the active index with wrapping; -1 = nothing active. */
export function moveActive(current: number, delta: 1 | -1, total: number): number {
  if (total <= 0) return -1;
  if (current === -1) return delta === 1 ? 0 : total - 1;
  return (current + delta + total) % total;
}

export interface PanelPlacement {
  placement: 'below' | 'above';
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxHeight: number;
}

export interface InputRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

const GAP = 4;
const VIEWPORT_MARGIN = 8;
const MIN_PANEL_SPACE = 160;
const MIN_MAX_HEIGHT = 96;

/**
 * Anchor the fixed-position panel under the input; flip above when the space
 * below is cramped and above is roomier. `bottom` is used (instead of `top`)
 * for the above placement so the panel grows upward from the input.
 */
export function computePanelPlacement(
  input: InputRect,
  viewport: { width: number; height: number },
): PanelPlacement {
  const spaceBelow = viewport.height - input.bottom - GAP;
  const spaceAbove = input.top - GAP;
  const placement: 'below' | 'above' =
    spaceBelow < MIN_PANEL_SPACE && spaceAbove > spaceBelow ? 'above' : 'below';

  const minWidth = Math.min(input.width, viewport.width - 2 * VIEWPORT_MARGIN);
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(input.left, viewport.width - minWidth - VIEWPORT_MARGIN),
  );
  const space = placement === 'below' ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(MIN_MAX_HEIGHT, space - VIEWPORT_MARGIN);

  if (placement === 'below') {
    return { placement, top: input.bottom + GAP, left, minWidth, maxHeight };
  }
  return { placement, bottom: viewport.height - input.top + GAP, left, minWidth, maxHeight };
}

/**
 * search-url + query param → destination href. Preserves params already on
 * the search-url; the default (`/search` + `q`) matches the routing contract
 * (ARCHITECTURE §13) so an SSR search page restores the state.
 */
export function buildSearchUrl(searchUrl: string, queryParam: string, query: string, baseHref: string): string {
  const url = new URL(searchUrl, baseHref);
  url.searchParams.set(queryParam, query);
  return url.href;
}

/** "View all {count} results" label substitution. */
export function viewAllLabel(template: string, count: number): string {
  return template.replace(/\{count\}/g, String(count));
}

/**
 * What the panel should do after a render: open, close, or stay put.
 *
 * 'close' on any settled status, not just 'success'. Clearing the input settles
 * to 'empty' mode, where no source runs — the status stays 'idle' and never
 * reaches 'success', so a success-only rule left an open panel showing stale
 * section headers with nothing under them. 'loading' is still excluded so an
 * in-flight request never closes a populated panel mid-keystroke.
 */
export function panelAction(input: {
  open: boolean;
  mode: 'inactive' | 'empty' | 'query';
  hasContent: boolean;
  status: 'idle' | 'loading' | 'success';
  anchorFocused: boolean;
}): 'open' | 'close' | 'reposition' | 'none' {
  if (input.mode === 'inactive') return 'close';
  if (input.hasContent && input.anchorFocused) return 'open';
  if (input.open && !input.hasContent && input.status !== 'loading') return 'close';
  return input.open ? 'reposition' : 'none';
}
