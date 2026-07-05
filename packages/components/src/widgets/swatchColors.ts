/**
 * Color resolution for swatch/color-list facet modes (store-ui parity):
 * - color map lookup (case-insensitive), then the raw facet value itself
 * - "a/b"  → two-tone diagonal gradient
 * - "*"    → multicolor wheel
 * - "#"    → "clear/none" swatch (styled by the component)
 * - anything the browser accepts as a CSS color (hex, named, rgb(), …)
 */

export interface SwatchStyle {
  kind: 'color' | 'gradient' | 'multi' | 'clear' | 'unknown';
  css: string;
}

export const MULTI_CSS =
  'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)';

export type IsCssColor = (value: string) => boolean;

export function defaultIsCssColor(value: string): boolean {
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value);
  }
  // Non-browser fallback (tests): hex or single-word names.
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) || /^[a-z]+$/i.test(value);
}

function mapLookup(map: Record<string, string> | undefined, value: string): string | undefined {
  if (!map) return undefined;
  if (value in map) return map[value];
  const lower = value.toLowerCase();
  for (const [key, code] of Object.entries(map)) {
    if (key.toLowerCase() === lower) return code;
  }
  return undefined;
}

export function resolveSwatch(
  value: string,
  map?: Record<string, string>,
  isColor: IsCssColor = defaultIsCssColor,
): SwatchStyle {
  const code = (mapLookup(map, value) ?? value).trim();

  if (code === '*') return { kind: 'multi', css: MULTI_CSS };
  if (code === '#') return { kind: 'clear', css: '' };

  if (code.includes('/')) {
    const [a, b] = code.split('/', 2).map((s) => s.trim());
    if (a && b && isColor(a) && isColor(b)) {
      return { kind: 'gradient', css: `linear-gradient(135deg, ${a} 0% 50%, ${b} 50% 100%)` };
    }
    return { kind: 'unknown', css: '' };
  }

  if (isColor(code)) return { kind: 'color', css: code };
  const lower = code.toLowerCase();
  if (lower !== code && isColor(lower)) return { kind: 'color', css: lower };
  return { kind: 'unknown', css: '' };
}
