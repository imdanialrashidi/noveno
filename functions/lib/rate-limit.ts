/**
 * In-memory sliding-window rate limiter (plan §5.5).
 *
 * Isolate-local by design: each Cloudflare isolate keeps its own Map.
 * Distributed floods (many IPs or many isolates) still get per-IP, per-isolate
 * throttling; global throttling requires a durable binding (KV/D1) — see D-04.
 *
 * Isolate-local by design: a Cloudflare isolate keeps this Map alive only
 * for its own lifetime, so this is a coarse secondary gate — Turnstile is
 * the primary abuse control. Documented limitation, not a bug.
 */

export interface RateLimiterOptions {
  /** Max allowed requests inside the window per key. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
  now?: () => number;
}

export type RateLimiter = ((key: string) => boolean) & { readonly size: number };

export function createRateLimiter({ max, windowMs, now = Date.now }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>();
  /** Memory bound: sweep when tracked keys exceed this many. */
  const MAX_TRACKED_KEYS = 10_000;

  const limit = (key: string): boolean => {
    const t = now();
    const windowStart = t - windowMs;

    // Opportunistic sweep: keeps the map bounded under IP-rotation floods.
    if (hits.size > MAX_TRACKED_KEYS) {
      for (const [k, stamps] of hits) {
        const newest = stamps[stamps.length - 1] ?? 0;
        if (newest <= windowStart) hits.delete(k);
      }
    }

    const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    return true;
  };
  Object.defineProperty(limit, "size", {
    get() {
      return hits.size;
    },
    enumerable: true,
  });
  return limit as RateLimiter;
}
