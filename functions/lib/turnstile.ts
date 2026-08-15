/**
 * Turnstile server-side verification (plan §5.5, risk R2).
 *
 * Siteverify is mandatory: the client token is single-use and short-lived.
 * The `idempotency_key` is derived from the token itself (see
 * `idempotencyKeyForToken`), so re-verifying the SAME token after a
 * network blip is safe. The client retry path mints a fresh token per
 * attempt with the same `submission_id`, which now yields a fresh
 * idempotency key — a failed first attempt can never lock the retry out.
 * Official test keys (always-pass / always-fail / duplicate) are
 * Cloudflare-published public secrets used against the real endpoint in
 * tests only — they are safe to commit; a production secret never is.
 */

export type TurnstileOutcome =
  | { status: "pass" }
  | { status: "fail"; errorCodes: string[] }
  | { status: "upstream_error" };

export interface VerifyTurnstileParams {
  secret: string;
  token: string;
  /** Client IP (cf-connecting-ip) — passed to siteverify. */
  remoteIp: string | null;
  /** Stable idempotency key for the verification call itself. */
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
}

/**
 * Deterministic idempotency key for a siteverify attempt: the SHA-256 of
 * the token itself. Re-verifying the SAME token (network blip) reuses the
 * key — Cloudflare returns the first verification's result, which is what
 * we want for the same token. A fresh client token (retry path) gets a
 * fresh key, so a failed first attempt can never lock the retry out.
 */
export async function idempotencyKeyForToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile({
  secret,
  token,
  remoteIp,
  idempotencyKey,
  fetchImpl = fetch,
}: VerifyTurnstileParams): Promise<TurnstileOutcome> {
  const endpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  const body: Record<string, string> = {
    secret,
    response: token,
    idempotency_key: idempotencyKey,
  };
  if (remoteIp) body.remoteip = remoteIp;

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "upstream_error" };
  }

  if (!response.ok) return { status: "upstream_error" };

  let data: { success?: boolean; "error-codes"?: string[] };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return { status: "upstream_error" };
  }

  if (data.success === true) return { status: "pass" };
  return { status: "fail", errorCodes: data["error-codes"] ?? [] };
}
