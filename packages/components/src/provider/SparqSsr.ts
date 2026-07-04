import { dispatchSparqEvent } from '../events';
import { findProviderFor } from '../composables/findProvider';

/**
 * <sparq-ssr> — wraps the customer's server-rendered HTML (ARCHITECTURE §8).
 *
 * Pre-upgrade / no-JS / bots: children render normally and are crawlable.
 * Takeover: hidden on the provider's FIRST SUCCESSFUL search — synchronously in
 * the controller's search event, which lands in the same render frame as the
 * widgets' own commit, so the swap is atomic (no frame shows both or neither).
 * If JS fails or the first search errors, the fallback simply stays visible.
 */
export class SparqSsrElement extends HTMLElement {
  private unsubscribe: (() => void) | null = null;
  private takenOver = false;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const sr = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ':host { display: block; } :host([hidden]) { display: none; }';
      sr.append(style, document.createElement('slot'));
    }
    if (this.takenOver || this.unsubscribe) return;

    void findProviderFor(this).then((provider) => {
      if (!provider?.controller || this.takenOver) return;
      this.unsubscribe = provider.controller.on('search', () => {
        if (this.takenOver) return;
        this.takenOver = true;
        this.hidden = true; // display:none — also removes it from the a11y tree
        dispatchSparqEvent(this, 'sparq:takeover');
        this.unsubscribe?.();
        this.unsubscribe = null;
      });
    });
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
