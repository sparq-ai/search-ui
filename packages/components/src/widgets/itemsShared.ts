/** Styles shared by <sparq-items> and <sparq-items-infinite> — injected once
 * per shadow root via register.ts so the rules aren't duplicated per SFC. */
export const ITEMS_SHARED_CSS = `
.list {
  display: block;
}
.list[data-stalled] {
  opacity: 0.6;
  transition: opacity 0.15s ease;
}
::slotted([data-sparq-skeleton]) {
  animation: sq-pulse 1.2s ease-in-out infinite;
}
@keyframes sq-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.85; }
}
.state {
  padding: calc(var(--sparq-spacing, 8px) * 2);
  color: var(--sparq-color-text-muted, #6b7280);
  text-align: center;
}
`;
