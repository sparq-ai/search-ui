import type { NumericRange } from '@sparq/search-core';

/** Pure logic behind <sparq-range>'s dual-thumb slider — unit-tested in isolation. */

export interface Bounds {
  min: number;
  max: number;
}

export interface ResolveBoundsInput {
  /** Fixed overrides from the min=/max= attributes. */
  attrMin?: number;
  attrMax?: number;
  /** facetStats for the attribute from the latest results. */
  stats?: Bounds | null;
  /** Whether this attribute currently has an active numeric filter. */
  hasActiveFilter: boolean;
}

/**
 * Slider bounds policy:
 * - explicit min=/max= attributes always win (fully or per side);
 * - otherwise bounds come from result stats, but are FROZEN while this
 *   attribute has an active filter — stats reflect the filtered result set,
 *   and re-deriving bounds from them would collapse the slider onto its own
 *   selection (feedback loop);
 * - without stats yet, keep whatever we had (null = not ready, slider inert).
 */
export function resolveBounds(prev: Bounds | null, input: ResolveBoundsInput): Bounds | null {
  if (input.attrMin !== undefined && input.attrMax !== undefined) {
    return { min: input.attrMin, max: input.attrMax };
  }
  let next = prev;
  if (!input.hasActiveFilter || prev === null) {
    if (input.stats) next = { ...input.stats };
  }
  if (next === null) return null;
  return {
    min: input.attrMin ?? next.min,
    max: input.attrMax ?? next.max,
  };
}

/** A slider is usable only with a real, non-degenerate span. */
export function isUsableBounds(bounds: Bounds | null): bounds is Bounds {
  return bounds !== null && Number.isFinite(bounds.min) && Number.isFinite(bounds.max) && bounds.max > bounds.min;
}

/**
 * Clamp a thumb value: inside the bounds, and never crossing the other thumb.
 * NaN (e.g. from an emptied number input) resolves to the thumb's own bound.
 */
export function clampThumb(
  which: 'min' | 'max',
  value: number,
  otherValue: number,
  bounds: Bounds,
): number {
  if (Number.isNaN(value)) return which === 'min' ? bounds.min : bounds.max;
  const low = which === 'min' ? bounds.min : Math.max(otherValue, bounds.min);
  const high = which === 'min' ? Math.min(otherValue, bounds.max) : bounds.max;
  return Math.min(Math.max(value, low), high);
}

/** Thumb position as a 0–100 percentage of the bounds span. */
export function toPercent(value: number, bounds: Bounds): number {
  if (bounds.max <= bounds.min) return 0;
  const pct = ((value - bounds.min) / (bounds.max - bounds.min)) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Thumb values → the filter to apply. A side resting on its bound is an open
 * side; both sides open (full span selected) means NO filter at all.
 */
export function rangeFromThumbs(minValue: number, maxValue: number, bounds: Bounds): NumericRange | null {
  const range: NumericRange = {};
  if (minValue > bounds.min) range.min = minValue;
  if (maxValue < bounds.max) range.max = maxValue;
  return range.min === undefined && range.max === undefined ? null : range;
}

/** Thumb values implied by the current filter state (open sides → bounds). */
export function thumbsFromRange(range: NumericRange | undefined, bounds: Bounds): { min: number; max: number } {
  return {
    min: clampThumb('min', range?.min ?? bounds.min, range?.max ?? bounds.max, bounds),
    max: clampThumb('max', range?.max ?? bounds.max, range?.min ?? bounds.min, bounds),
  };
}

/**
 * Pointer x → value on the track, snapped to the step grid and clamped to the
 * bounds. (Pointer interaction lives on the track container, not the native
 * inputs — Firefox does not honor pointer-events on range-thumb pseudos.)
 */
export function valueFromPointer(
  clientX: number,
  rect: { left: number; width: number },
  bounds: Bounds,
  step: number,
): number {
  if (rect.width <= 0) return bounds.min;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const raw = bounds.min + ratio * (bounds.max - bounds.min);
  const snapped = step > 0 ? bounds.min + Math.round((raw - bounds.min) / step) * step : raw;
  return Math.min(bounds.max, Math.max(bounds.min, snapped));
}

/**
 * Which thumb should a track press move? The nearest one; on a tie (including
 * both thumbs stacked at the press point or at either extreme), the side the
 * press approaches from — so a pair stuck at a bound is always recoverable.
 */
export function pickThumb(value: number, minValue: number, maxValue: number): 'min' | 'max' {
  const dMin = Math.abs(value - minValue);
  const dMax = Math.abs(value - maxValue);
  if (dMin < dMax) return 'min';
  if (dMax < dMin) return 'max';
  return value < minValue ? 'min' : 'max';
}
