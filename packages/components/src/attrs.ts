/**
 * Attribute parsing conventions (ARCHITECTURE §9):
 * - boolean: presence = true, but `="false"` / `="0"` / `="off"` / `="no"` = false
 * - lists: comma-separated; items may carry labels via `value|Label`
 * - a value starting with `[` or `{` is parsed as JSON (universal escape hatch)
 */

export function parseBoolAttr(value: string | null, defaultValue = false): boolean {
  if (value === null) return defaultValue;
  const v = value.trim().toLowerCase();
  return !(v === 'false' || v === '0' || v === 'off' || v === 'no');
}

export function parseNumAttr(value: string | null, defaultValue: number): number {
  if (value === null || value.trim() === '') return defaultValue;
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

export function parseListAttr(value: string | null): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through to comma parsing */
    }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

export interface SelectOption {
  value: string;
  label: string;
}

export function parseOptionsAttr(value: string | null): SelectOption[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((entry) =>
          typeof entry === 'string'
            ? { value: entry, label: entry }
            : { value: String((entry as SelectOption).value), label: String((entry as SelectOption).label ?? (entry as SelectOption).value) },
        );
      }
    } catch {
      /* fall through */
    }
  }
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const sep = part.indexOf('|');
      if (sep === -1) return { value: part, label: part };
      return { value: part.slice(0, sep).trim(), label: part.slice(sep + 1).trim() };
    });
}
