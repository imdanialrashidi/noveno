/**
 * In-memory sliding-window rate limiter (plan §5.5).
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

export type RateLimiter = (key: string) => boolean;

export function createRateLimiter({ max, windowMs, now = Date.now }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>();

  return (key: string): boolean => {
    const t = now();
    const windowStart = t - windowMs;
    const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    return true;
  };
}
