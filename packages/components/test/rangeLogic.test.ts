import { describe, expect, it } from 'vitest';
import {
  clampThumb,
  isUsableBounds,
  pickThumb,
  rangeFromThumbs,
  resolveBounds,
  thumbsFromRange,
  toPercent,
  valueFromPointer,
} from '../src/widgets/rangeLogic';

const B = { min: 50, max: 210 };

describe('resolveBounds — bounds policy', () => {
  it('starts null until stats arrive (slider inert)', () => {
    expect(resolveBounds(null, { hasActiveFilter: false, stats: null })).toBeNull();
  });

  it('adopts stats when no filter is active', () => {
    expect(resolveBounds(null, { hasActiveFilter: false, stats: { min: 1, max: 9 } })).toEqual({ min: 1, max: 9 });
  });

  it('updates from newer stats while unfiltered (query changed)', () => {
    expect(resolveBounds({ min: 1, max: 9 }, { hasActiveFilter: false, stats: { min: 3, max: 7 } })).toEqual({
      min: 3,
      max: 7,
    });
  });

  it('FREEZES bounds while own filter is active — stats reflect the filtered set', () => {
    // stats collapsed onto the selection; bounds must not follow
    expect(resolveBounds(B, { hasActiveFilter: true, stats: { min: 90, max: 120 } })).toEqual(B);
  });

  it('adopts stats even under an active filter when there were no bounds yet (URL-seeded load)', () => {
    expect(resolveBounds(null, { hasActiveFilter: true, stats: { min: 1, max: 9 } })).toEqual({ min: 1, max: 9 });
  });

  it('explicit attribute bounds always win, fully or per side', () => {
    expect(resolveBounds(B, { attrMin: 0, attrMax: 500, hasActiveFilter: true, stats: { min: 90, max: 120 } })).toEqual(
      { min: 0, max: 500 },
    );
    expect(resolveBounds(null, { attrMin: 0, hasActiveFilter: false, stats: { min: 5, max: 9 } })).toEqual({
      min: 0,
      max: 9,
    });
    expect(resolveBounds(null, { attrMax: 999, hasActiveFilter: false, stats: { min: 5, max: 9 } })).toEqual({
      min: 5,
      max: 999,
    });
  });

  it('keeps previous bounds when stats disappear (error/empty response)', () => {
    expect(resolveBounds(B, { hasActiveFilter: false, stats: null })).toEqual(B);
  });
});

describe('isUsableBounds', () => {
  it('rejects null, degenerate, and non-finite spans', () => {
    expect(isUsableBounds(null)).toBe(false);
    expect(isUsableBounds({ min: 5, max: 5 })).toBe(false);
    expect(isUsableBounds({ min: 9, max: 5 })).toBe(false);
    expect(isUsableBounds({ min: Number.NaN, max: 5 })).toBe(false);
    expect(isUsableBounds({ min: 0, max: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isUsableBounds({ min: 5, max: 9 })).toBe(true);
    expect(isUsableBounds({ min: -10, max: -5 })).toBe(true);
  });
});

describe('clampThumb — bounds and crossing', () => {
  it('keeps values inside the bounds', () => {
    expect(clampThumb('min', -100, 210, B)).toBe(50);
    expect(clampThumb('max', 9999, 50, B)).toBe(210);
  });

  it('never lets thumbs cross', () => {
    expect(clampThumb('min', 180, 120, B)).toBe(120); // min pushed into max → stops at max
    expect(clampThumb('max', 80, 120, B)).toBe(120); // max pushed into min → stops at min
  });

  it('allows thumbs to touch (equal values)', () => {
    expect(clampThumb('min', 120, 120, B)).toBe(120);
    expect(clampThumb('max', 120, 120, B)).toBe(120);
  });

  it('resolves NaN (emptied input) to the thumb’s own bound', () => {
    expect(clampThumb('min', Number.NaN, 120, B)).toBe(50);
    expect(clampThumb('max', Number.NaN, 120, B)).toBe(210);
  });

  it('handles the other thumb being out of bounds defensively', () => {
    expect(clampThumb('max', 100, -500, B)).toBe(100); // other clamped up to bounds.min
  });
});

describe('toPercent', () => {
  it('maps values across the span', () => {
    expect(toPercent(50, B)).toBe(0);
    expect(toPercent(210, B)).toBe(100);
    expect(toPercent(130, B)).toBe(50);
  });

  it('clamps out-of-bounds values and survives degenerate spans', () => {
    expect(toPercent(0, B)).toBe(0);
    expect(toPercent(999, B)).toBe(100);
    expect(toPercent(7, { min: 5, max: 5 })).toBe(0);
  });
});

describe('rangeFromThumbs — filter semantics', () => {
  it('full span selected → NO filter (null)', () => {
    expect(rangeFromThumbs(50, 210, B)).toBeNull();
  });

  it('narrowed sides become filter sides; bound-resting sides stay open', () => {
    expect(rangeFromThumbs(90, 210, B)).toEqual({ min: 90 });
    expect(rangeFromThumbs(50, 150, B)).toEqual({ max: 150 });
    expect(rangeFromThumbs(90, 150, B)).toEqual({ min: 90, max: 150 });
  });

  it('thumbs touching produce an exact-value range', () => {
    expect(rangeFromThumbs(120, 120, B)).toEqual({ min: 120, max: 120 });
  });
});

describe('thumbsFromRange — state → thumb positions', () => {
  it('open sides rest on the bounds', () => {
    expect(thumbsFromRange(undefined, B)).toEqual({ min: 50, max: 210 });
    expect(thumbsFromRange({ min: 90 }, B)).toEqual({ min: 90, max: 210 });
    expect(thumbsFromRange({ max: 150 }, B)).toEqual({ min: 50, max: 150 });
  });

  it('clamps URL-seeded filters that exceed the discovered bounds', () => {
    expect(thumbsFromRange({ min: -100, max: 9999 }, B)).toEqual({ min: 50, max: 210 });
    expect(thumbsFromRange({ min: 300 }, B)).toEqual({ min: 210, max: 210 });
  });

  it('round-trips with rangeFromThumbs', () => {
    for (const range of [{ min: 90 }, { max: 150 }, { min: 90, max: 150 }, undefined]) {
      const thumbs = thumbsFromRange(range, B);
      expect(rangeFromThumbs(thumbs.min, thumbs.max, B)).toEqual(range ?? null);
    }
  });
});

describe('valueFromPointer — track coordinates → snapped value', () => {
  const rect = { left: 100, width: 400 };

  it('maps positions across the track', () => {
    expect(valueFromPointer(100, rect, B, 1)).toBe(50);
    expect(valueFromPointer(300, rect, B, 1)).toBe(130);
    expect(valueFromPointer(500, rect, B, 1)).toBe(210);
  });

  it('snaps to the step grid anchored at the min bound', () => {
    // value 132.5 (the 130↔135 snap boundary) sits at x=306.25
    expect(valueFromPointer(301, rect, B, 5)).toBe(130);
    expect(valueFromPointer(306, rect, B, 5)).toBe(130);
    expect(valueFromPointer(307, rect, B, 5)).toBe(135);
  });

  it('clamps pointer positions outside the track', () => {
    expect(valueFromPointer(-999, rect, B, 1)).toBe(50);
    expect(valueFromPointer(9999, rect, B, 1)).toBe(210);
  });

  it('survives a zero-width rect and step 0', () => {
    expect(valueFromPointer(300, { left: 100, width: 0 }, B, 1)).toBe(50);
    expect(valueFromPointer(300, rect, B, 0)).toBe(130); // no snapping
  });
});

describe('pickThumb — which thumb does a track press move?', () => {
  it('picks the nearer thumb', () => {
    expect(pickThumb(60, 50, 210)).toBe('min');
    expect(pickThumb(200, 50, 210)).toBe('max');
  });

  it('stacked thumbs are recoverable from both extremes', () => {
    expect(pickThumb(100, 50, 50)).toBe('max'); // both at min end, press to the right → max moves
    expect(pickThumb(100, 210, 210)).toBe('min'); // both at max end, press to the left → min moves
  });

  it('press exactly on a stacked pair approaches from the side pressed', () => {
    expect(pickThumb(120, 120, 120)).toBe('max'); // not below min → max
    expect(pickThumb(119, 120, 120)).toBe('min');
  });

  it('exact midpoint tie between separated thumbs goes to max', () => {
    expect(pickThumb(130, 50, 210)).toBe('max');
  });
});
