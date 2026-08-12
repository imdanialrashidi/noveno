/**
 * Turnstile server-side verification (plan §5.5, risk R2).
 *
 * Siteverify is mandatory: the client token is single-use and short-lived;
 * verification uses `idempotency_key` (= submission_id) so re-verifying
 * the same token after a network blip is safe. Official test keys
 * (always-pass / always-fail / duplicate) work against the real endpoint
 * and are used in test environments only — never committed.
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
