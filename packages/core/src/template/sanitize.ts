/** Attributes whose values are URLs and must pass a scheme check. */
const URL_ATTRS = new Set(['href', 'src', 'srcset', 'action', 'formaction', 'xlink:href', 'poster']);

const SAFE_URL_RE = /^(?:https?:|mailto:|tel:|[./#?]|[\w-]+(?:[/?#]|$))/i;
const DANGEROUS_SCHEME_RE = /^\s*(?:javascript|data|vbscript):/i;

export function isUrlAttribute(name: string): boolean {
  return URL_ATTRS.has(name.toLowerCase());
}

export function isEventHandlerAttribute(name: string): boolean {
  return /^on/i.test(name);
}

export function isSafeUrl(value: string): boolean {
  if (DANGEROUS_SCHEME_RE.test(value)) return false;
  return value === '' || SAFE_URL_RE.test(value.trim());
}
