/**
 * Prepended to every component's shadow styles (ARCHITECTURE §12).
 *
 * `all: initial` on .sq-root severs every inherited page style — host CSS can
 * never break component rendering. Custom properties (--sparq-*) survive `all`
 * by spec, so tokens + ::part() remain the only two styling doors in.
 * The internal reset below rebuilds a known baseline instead of UA defaults.
 */
export const RESET_CSS = `
.sq-root {
  all: initial;
  display: block;
  box-sizing: border-box;
  font-family: var(--sparq-font-family, system-ui, -apple-system, 'Segoe UI', sans-serif);
  font-size: var(--sparq-font-size, 0.9375rem);
  line-height: 1.5;
  color: var(--sparq-color-text, #1f2937);
  -webkit-text-size-adjust: 100%;
}
.sq-root *,
.sq-root *::before,
.sq-root *::after {
  box-sizing: border-box;
  font: inherit;
  color: inherit;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  text-transform: none;
  letter-spacing: normal;
}
.sq-root button { cursor: pointer; }
.sq-root button:disabled { cursor: default; }
.sq-root :focus-visible {
  outline: 2px solid var(--sparq-color-focus, var(--sparq-color-primary, #2563eb));
  outline-offset: 1px;
}
`;
