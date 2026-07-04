/**
 * All public events go through this helper. Vue-emitted CustomEvents are
 * neither bubbling nor composed, so widgets must NEVER use emit() for
 * public events (ARCHITECTURE §9, §18).
 */
export function dispatchSparqEvent(el: HTMLElement, name: `sparq:${string}`, detail?: unknown): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
