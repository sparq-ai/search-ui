/** Panel chrome styles for <sparq-autocomplete> (shadow DOM, behind RESET_CSS). */
export const AC_CSS = `
:host {
  display: block;
}
.panel {
  position: fixed;
  z-index: var(--sparq-z-popup, 9999);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--sparq-color-bg-elevated, var(--sparq-color-bg, #fff));
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius, 6px);
  box-shadow: var(--sparq-shadow-popup, 0 8px 24px rgba(0, 0, 0, 0.12));
  padding: calc(var(--sparq-spacing, 8px) * 0.5) 0;
}
.panel[hidden] {
  display: none;
}
section {
  padding: calc(var(--sparq-spacing, 8px) * 0.5) 0;
}
section[hidden] {
  display: none;
}
section + section {
  border-top: 1px solid var(--sparq-color-border, #e5e7eb);
}
.section-title {
  padding: 2px calc(var(--sparq-spacing, 8px) * 1.5) 4px;
  font-size: 0.75em;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sparq-color-text-muted, #6b7280);
}
::slotted([data-sparq-ac-wrapper]) {
  display: block;
  cursor: pointer;
  padding: calc(var(--sparq-spacing, 8px) * 0.75) calc(var(--sparq-spacing, 8px) * 1.5);
}
::slotted([data-sparq-ac-wrapper][data-active]) {
  background: var(--sparq-ac-active-bg, rgba(37, 99, 235, 0.08));
}
::slotted(input[data-sparq-ac-input]) {
  width: 100%;
  padding: calc(var(--sparq-spacing, 8px)) calc(var(--sparq-spacing, 8px) * 1.5);
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius, 6px);
  background: var(--sparq-color-bg, #fff);
  font: inherit;
  color: inherit;
}
.view-all {
  display: block;
  padding: calc(var(--sparq-spacing, 8px)) calc(var(--sparq-spacing, 8px) * 1.5);
  border-top: 1px solid var(--sparq-color-border, #e5e7eb);
  color: var(--sparq-color-primary, #2563eb);
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}
.view-all[hidden] {
  display: none;
}
.sr-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
`;
