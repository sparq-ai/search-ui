/**
 * Non-destructive ARIA combobox wiring for an input the theme owns
 * (ARCHITECTURE §9, <sparq-autocomplete>). Every managed attribute is
 * snapshotted before the first change and restored exactly on release —
 * including restore-to-absent.
 */

const MANAGED_ATTRS = [
  'role',
  'aria-autocomplete',
  'aria-haspopup',
  'aria-controls',
  'aria-expanded',
  'aria-activedescendant',
  'autocomplete',
] as const;

type Snapshot = Record<(typeof MANAGED_ATTRS)[number], string | null>;

const snapshots = new WeakMap<Element, Snapshot>();

export function applyComboboxAria(input: HTMLElement, controlsId: string): void {
  if (!snapshots.has(input)) {
    const snap = {} as Snapshot;
    for (const attr of MANAGED_ATTRS) snap[attr] = input.getAttribute(attr);
    snapshots.set(input, snap);
  }
  // Respect an explicit author-set role; add combobox only where none exists.
  if (snapshots.get(input)!.role === null) input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-controls', controlsId);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('autocomplete', 'off');
}

export function setExpanded(input: HTMLElement, expanded: boolean, activeId: string | null): void {
  input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (expanded && activeId) input.setAttribute('aria-activedescendant', activeId);
  else input.removeAttribute('aria-activedescendant');
}

export function restoreAria(input: HTMLElement): void {
  const snap = snapshots.get(input);
  if (!snap) return;
  for (const attr of MANAGED_ATTRS) {
    const original = snap[attr];
    if (original === null) input.removeAttribute(attr);
    else input.setAttribute(attr, original);
  }
  snapshots.delete(input);
}

export function isTextInput(el: unknown): el is HTMLInputElement {
  return el instanceof HTMLInputElement || (el instanceof HTMLElement && el.tagName === 'INPUT');
}
