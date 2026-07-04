import type { Item } from '../state';
import { isEventHandlerAttribute, isSafeUrl, isUrlAttribute } from './sanitize';

const BINDING_RE = /\{\{\s*([\w$][\w.$-]*)\s*\}\}/g;

export type ItemRenderer = (item: Item) => DocumentFragment;

function resolvePath(item: Item, path: string): string {
  // {{$item}} — the entire record as pretty-printed JSON (wrap in <pre> for
  // readable debugging). Rendered via textContent like every binding: safe.
  if (path === '$item') return JSON.stringify(item, null, 2);
  let current: unknown = item;
  for (const seg of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[seg];
  }
  if (current === null || current === undefined) return '';
  if (typeof current === 'object') return JSON.stringify(current);
  return String(current);
}

function interpolate(text: string, item: Item): string {
  return text.replace(BINDING_RE, (_, path: string) => resolvePath(item, path));
}

/**
 * Compiles a light-DOM <template> into an XSS-safe renderer (ARCHITECTURE §7).
 *
 * - Text bindings are written via `nodeValue` (textContent) — user data is
 *   NEVER parsed as HTML. There is no raw-HTML binding syntax.
 * - `on*` attributes are stripped outright.
 * - URL attributes reject `javascript:` / `data:` / `vbscript:` schemes.
 */
export function compileItemTemplate(template: HTMLTemplateElement): ItemRenderer {
  return (item: Item) => {
    const frag = template.content.cloneNode(true) as DocumentFragment;
    const doc = template.ownerDocument;
    const walker = doc.createTreeWalker(frag, 0x1 /* ELEMENT */ | 0x4 /* TEXT */);

    const textNodes: Text[] = [];
    const elements: Element[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 3) textNodes.push(node as Text);
      else elements.push(node as Element);
    }

    for (const text of textNodes) {
      const raw = text.nodeValue ?? '';
      if (raw.includes('{{')) text.nodeValue = interpolate(raw, item);
    }

    for (const el of elements) {
      for (const attr of [...el.attributes]) {
        if (isEventHandlerAttribute(attr.name)) {
          el.removeAttribute(attr.name);
          continue;
        }
        let value = attr.value;
        if (value.includes('{{')) {
          value = interpolate(value, item);
          el.setAttribute(attr.name, value);
        }
        if (isUrlAttribute(attr.name) && !isSafeUrl(value)) {
          el.removeAttribute(attr.name);
        }
      }
    }

    return frag;
  };
}

/** Skeleton rendering: every binding resolves to '' — real dimensions, blank data. */
export function renderBlank(renderer: ItemRenderer): DocumentFragment {
  return renderer({});
}
