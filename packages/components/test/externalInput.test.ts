import { describe, expect, it } from 'vitest';
import { applyComboboxAria, restoreAria, setExpanded } from '../src/autocomplete/externalInput';

function makeInput(attrs: Record<string, string> = {}): HTMLInputElement {
  const input = document.createElement('input');
  for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
  document.body.appendChild(input);
  return input;
}

describe('applyComboboxAria', () => {
  it('wires a bare input as a combobox', () => {
    const input = makeInput();
    applyComboboxAria(input, 'sparq-ac-1');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-haspopup')).toBe('listbox');
    expect(input.getAttribute('aria-controls')).toBe('sparq-ac-1');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('respects an author-set role', () => {
    const input = makeInput({ role: 'searchbox' });
    applyComboboxAria(input, 'sparq-ac-1');
    expect(input.getAttribute('role')).toBe('searchbox');
  });
});

describe('setExpanded', () => {
  it('toggles aria-expanded and manages aria-activedescendant', () => {
    const input = makeInput();
    applyComboboxAria(input, 'ac');
    setExpanded(input, true, 'ac-opt-3');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe('ac-opt-3');
    setExpanded(input, true, null);
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    setExpanded(input, false, 'ac-opt-3');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  });
});

describe('restoreAria — exact restoration', () => {
  it('restores previously absent attributes to absent', () => {
    const input = makeInput();
    applyComboboxAria(input, 'ac');
    setExpanded(input, true, 'ac-opt-1');
    restoreAria(input);
    for (const attr of ['role', 'aria-autocomplete', 'aria-haspopup', 'aria-controls', 'aria-expanded', 'aria-activedescendant', 'autocomplete']) {
      expect(input.hasAttribute(attr)).toBe(false);
    }
  });

  it('restores pre-existing values exactly', () => {
    const input = makeInput({ role: 'searchbox', autocomplete: 'on', 'aria-expanded': 'true' });
    applyComboboxAria(input, 'ac');
    setExpanded(input, false, null);
    restoreAria(input);
    expect(input.getAttribute('role')).toBe('searchbox');
    expect(input.getAttribute('autocomplete')).toBe('on');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.hasAttribute('aria-controls')).toBe(false);
  });

  it('is a no-op on inputs that were never wired', () => {
    const input = makeInput({ role: 'searchbox' });
    restoreAria(input);
    expect(input.getAttribute('role')).toBe('searchbox');
  });

  it('re-applying after restore snapshots fresh state (node replacement flow)', () => {
    const input = makeInput();
    applyComboboxAria(input, 'ac');
    restoreAria(input);
    applyComboboxAria(input, 'ac2');
    expect(input.getAttribute('aria-controls')).toBe('ac2');
    restoreAria(input);
    expect(input.hasAttribute('aria-controls')).toBe(false);
  });
});
