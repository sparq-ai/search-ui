/**
 * Zero-dependency wire client for the Sparq tracking service (st-tracking).
 * Speaks the exact contract of @sparq/analytics-js — same endpoint
 * (POST {trackingHost}/events), same payload envelope, same `uId` identity
 * cookie — so stores migrating from the standalone SDK keep user continuity.
 *
 * Transport: fetch with keepalive (survives the navigation that click and
 * purchase events race against), falling back to sendBeacon with auth in the
 * query string where fetch is unavailable. Every storage/network touch is
 * failure-swallowing: analytics must never break search.
 */

export interface InsightsConfig {
  appId: string;
  /** The same search token the widget already holds — st-tracking scopes it to the app. */
  apiKey: string;
  collection?: string;
  /** Override the tracking endpoint (staging/self-hosted). No trailing slash. */
  trackingHost?: string;
}

const DEFAULT_HOST = 'https://events.sparq.ai/v2';
const UID_COOKIE = 'uId'; // shared with analytics-js — do not rename
const UID_TTL_DAYS = 367 * 2; // matches analytics-js cookie lifetime

function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]!) : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string, days: number): void {
  try {
    const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
  } catch {
    /* cookies disabled */
  }
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class InsightsClient {
  private host: string;

  constructor(private cfg: InsightsConfig) {
    this.host = (cfg.trackingHost ?? DEFAULT_HOST).replace(/\/$/, '');
  }

  /** Stable pseudonymous visitor id (cookie-persisted, analytics-js compatible). */
  userId(): string {
    let id = readCookie(UID_COOKIE);
    if (!id) id = randomId();
    // Re-write on every read to slide the expiry, like analytics-js does.
    writeCookie(UID_COOKIE, id, UID_TTL_DAYS);
    return id;
  }

  /** Fire-and-forget. Never throws, never blocks the UI. */
  send(eventName: string, eventData: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    const body = JSON.stringify({
      app: this.cfg.appId,
      collection: this.cfg.collection,
      eventName,
      eventData,
      meta: {},
      timeStamp: Date.now(),
    });
    const user = this.userId();
    try {
      if (typeof fetch === 'function') {
        fetch(`${this.host}/events`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.cfg.apiKey}`,
            'x-st-user': user,
          },
          body,
        }).catch(() => {});
        return;
      }
      // sendBeacon cannot set headers — auth/identity ride the query string
      // (requires st-tracking to accept them there; harmless 401 otherwise).
      navigator.sendBeacon?.(
        `${this.host}/events?token=${encodeURIComponent(this.cfg.apiKey)}&u=${encodeURIComponent(user)}`,
        new Blob([body], { type: 'application/json' }),
      );
    } catch {
      /* never surface tracking failures */
    }
  }
}
