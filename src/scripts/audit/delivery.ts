/**
 * Web3Forms delivery (plan 023) — bounded retry + sanitized payload.
 *
 * - Sanitized payload with readable Persian labels (never Turnstile token).
 * - Validation receipt echo (plan 021) and delivery_attempt marker (plan 025).
 * - Bounded: one initial attempt + one automatic retry; never infinite.
 */

import { AUDIT_OPTIONS } from "../../data/audit.ts";
import type { AuditConfig } from "./index.ts";

export interface DeliveryOutcome {
  ok: boolean;
  rateLimited?: boolean;
}

function labelOf(group: keyof typeof AUDIT_OPTIONS, id: string): string {
  return (
    (AUDIT_OPTIONS[group] as readonly { id: string; label: string }[]).find((option) => option.id === id)
      ?.label ?? id
  );
}

/**
 * Strip markup from free-text fields before the notification email
 * (security review MINOR-3): lead values are client-controlled and the
 * email renders as HTML — never let a submitted value carry tags.
 */
export function safeText(value: string): string {
  return value.replace(/[<>]/g, "");
}

/**
 * Sanitized Web3Forms payload — the full useful audit data with readable
 * Persian labels. Never includes the Turnstile token, secrets, or
 * unnecessary browser/internal state.
 * validated_at comes from the server's 200 body; the fallback clock is only
 * for direct/unconfigured deployments.
 */
export function buildWeb3FormsBody(
  payload: Record<string, unknown>,
  config: AuditConfig,
  receipt: string | null,
  attempt: number,
  validatedAt: string | null = null,
): Record<string, string> {
  const label = (ids: unknown, group: keyof typeof AUDIT_OPTIONS): string =>
    Array.isArray(ids)
      ? ids.map((id) => labelOf(group, String(id))).join("، ")
      : labelOf(group, String(ids ?? ""));
  const attribution = payload.attribution as Record<string, string> | undefined;
  const validatedAtIso =
    validatedAt && !Number.isNaN(Date.parse(validatedAt)) ? validatedAt : new Date().toISOString();
  return {
    access_key: config.web3formsKey,
    subject: `درخواست بررسی مسیر جذب — ${safeText(String(payload.business_name ?? payload.name ?? ""))}`,
    validation_receipt: receipt ?? "none",
    validated_at: validatedAtIso,
    delivery_attempt: String(attempt + 1),
    submission_id: String(payload.submission_id ?? ""),
    name: safeText(String(payload.name ?? "")),
    phone: safeText(String(payload.phone ?? "")),
    email: safeText(String(payload.email ?? "")),
    business_name: safeText(String(payload.business_name ?? "")),
    industry: labelOf("industry", String(payload.industry ?? "")),
    website: safeText(String(payload.website ?? "")),
    acquisition_channels: label(payload.acquisition_channels, "channels"),
    primary_problem: labelOf("problems", String(payload.primary_problem ?? "")),
    requested_service: labelOf("needs", String(payload.requested_service ?? "")),
    customer_value_range: labelOf("valueRanges", String(payload.customer_value_range ?? "")),
    preferred_contact: labelOf("preferredContact", String(payload.preferred_contact ?? "")),
    landing_page: safeText(String(attribution?.landing_page ?? "")),
    referrer: safeText(String(attribution?.referrer ?? "")),
    utm_source: safeText(String(attribution?.utm_source ?? "")),
    utm_medium: safeText(String(attribution?.utm_medium ?? "")),
    utm_campaign: safeText(String(attribution?.utm_campaign ?? "")),
    botcheck: "",
  };
}

/**
 * Inspect the Web3Forms response instead of trusting HTTP completion:
 * success requires a 2xx response whose JSON body is `{ success: true }`
 * (current official API contract — docs.web3forms.com API reference).
 * Bounded: one initial attempt + one automatic retry; never infinite.
 */
export async function deliverLead(
  payload: Record<string, unknown>,
  config: AuditConfig,
  receipt: string | null,
  validatedAt: string | null = null,
): Promise<DeliveryOutcome> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const body = buildWeb3FormsBody(payload, config, receipt, attempt, validatedAt);
    try {
      const result = await fetch(config.web3formsUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      lastStatus = result.status;
      let accepted = false;
      try {
        const parsed = (await result.json()) as { success?: boolean };
        accepted = result.ok && parsed?.success === true;
      } catch {
        accepted = false;
      }
      if (accepted) return { ok: true };
    } catch {
      // network failure / timeout -> one automatic retry
    }
  }
  return { ok: false, rateLimited: lastStatus === 429 };
}
