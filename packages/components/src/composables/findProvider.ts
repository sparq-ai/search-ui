import type { SparqSearchElement } from '../provider/SparqSearch';

function walkUp(node: Node): SparqSearchElement | null {
  let cur: Node | null = node.parentNode;
  while (cur) {
    if (cur instanceof Element && cur.tagName === 'SPARQ-SEARCH') return cur as SparqSearchElement;
    // Jump shadow boundaries — closest() cannot cross them.
    cur = cur instanceof ShadowRoot ? cur.host : cur.parentNode;
  }
  return null;
}

function locate(el: HTMLElement): SparqSearchElement | null {
  const forId = el.getAttribute('for');
  if (forId) {
    const target = el.ownerDocument.getElementById(forId);
    return target && target.tagName === 'SPARQ-SEARCH' ? (target as SparqSearchElement) : null;
  }
  return walkUp(el);
}

/**
 * Resolve the governing <sparq-search> for a widget (ARCHITECTURE §6):
 * nearest DOM ancestor (crossing shadow boundaries), or explicit for="id".
 * Retries once after whenDefined + a microtask for late/dynamic insertion.
 * Returns null (after logging) when there is genuinely no provider.
 */
export async function findProviderFor(el: HTMLElement): Promise<SparqSearchElement | null> {
  let provider = locate(el);
  if (!provider?.controller) {
    await customElements.whenDefined('sparq-search');
    await Promise.resolve();
    provider = locate(el);
  }
  if (!provider) {
    const tag = el.tagName.toLowerCase();
    console.error(
      `[sparq] <${tag}> must be placed inside a <sparq-search> element (or reference one via for="id"). The widget is inactive.`,
    );
    return null;
  }
  return provider;
}
