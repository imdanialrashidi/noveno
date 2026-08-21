/**
 * Turnstile bridge (plan 023) — explicit render, theme-synced, reset on retry.
 *
 * Handles script load, widget lifecycle, token waiting (bounded), and
 * retry/theme sync. Theme follows the site theme.
 */

import { effectiveTheme } from "../theme.ts";

export const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: Record<string, unknown>): string;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}

export class TurnstileBridge {
  private widgetId: string | null = null;
  private token: string | null = null;
  private tokenAt = 0;
  /** Cloudflare tokens live ~5 minutes; refresh margin keeps siteverify safe. */
  private static readonly TOKEN_TTL_MS = 4 * 60_000;
  private scriptLoaded = false;
  private scriptFailed = false;
  private waiters: ((token: string | null) => void)[] = [];
  private readonly siteKey: string;
  private readonly container: HTMLElement;

  constructor(siteKey: string, container: HTMLElement) {
    this.siteKey = siteKey;
    this.container = container;
  }

  private async ensureScript(): Promise<void> {
    if (this.scriptLoaded || this.scriptFailed) return;
    if (window.turnstile) {
      this.scriptLoaded = true;
      return;
    }
    await new Promise<void>((resolve) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };
      script.onerror = () => {
        this.scriptFailed = true;
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  private onToken(value: string | null): void {
    this.token = value;
    if (value !== null) this.tokenAt = Date.now();
    else this.tokenAt = 0;
    for (const waiter of this.waiters.splice(0)) waiter(value);
  }

  async ensureRendered(): Promise<boolean> {
    if (this.widgetId) return true;
    await this.ensureScript();
    if (this.scriptFailed || !window.turnstile) return false;
    this.widgetId = window.turnstile.render(this.container, {
      sitekey: this.siteKey,
      theme: effectiveTheme() === "dark" ? "dark" : "light",
      callback: (value: string) => this.onToken(value),
      "expired-callback": () => this.onToken(null),
      "error-callback": () => this.onToken(null),
    });
    return true;
  }

  /** Existing token if fresh (TTL 4 min), else reset the widget and wait (bounded). */
  async getToken(): Promise<string | null> {
    if (this.token && Date.now() - this.tokenAt < TurnstileBridge.TOKEN_TTL_MS) return this.token;
    if (!(await this.ensureRendered())) return null;
    if (!this.widgetId || !window.turnstile) return null;
    this.token = null;
    window.turnstile.reset(this.widgetId);
    return new Promise<string | null>((resolve) => {
      const onToken = (value: string | null) => {
        window.clearTimeout(timeout);
        resolve(value);
      };
      const timeout = window.setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== onToken);
        resolve(null);
      }, 20_000);
      this.waiters.push(onToken);
    });
  }

  /** A token was rejected server-side: clear it and force a fresh challenge. */
  invalidate(): void {
    this.token = null;
    this.tokenAt = 0;
  }

  /**
   * Retry recovery (banner «تلاش دوباره»): a token that was already sent
   * may be consumed server-side regardless of the response, so drop it and
   * force a fresh challenge; also let a previously failed script load be
   * retried. The next getToken() then resets the widget and waits for a
   * brand-new token.
   */
  retry(): void {
    this.token = null;
    this.tokenAt = 0;
    this.scriptFailed = false;
  }

  syncTheme(): void {
    if (!this.widgetId || !window.turnstile) return;
    const id = this.widgetId;
    window.turnstile.remove(id);
    this.widgetId = null;
    this.token = null;
    this.tokenAt = 0;
    void this.ensureRendered();
  }
}
