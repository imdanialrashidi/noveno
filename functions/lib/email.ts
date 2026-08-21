/**
 * Server-side lead email via Resend (spike D-01, plan 028).
 *
 * - Pure fetch, no new dependency, works in Cloudflare Workers (`nodejs_compat`).
 * - Reuses Persian labels from src/data/audit.ts contract + safeText stripping.
 * - Never logs lead PII (same rule as functions/api/audit.ts).
 */

import type { AuditSubmission, AuditEnv } from "./contract.ts";
import { AUDIT_OPTIONS } from "../../src/data/audit.ts";
export { AUDIT_OPTIONS };

function labelOf(group: keyof typeof AUDIT_OPTIONS, id: string): string {
  return (
    (AUDIT_OPTIONS[group] as readonly { id: string; label: string }[]).find((o) => o.id === id)?.label ?? id
  );
}

function safeText(value: string): string {
  return value.replace(/[<>]/g, "");
}

function renderLeadHtml(lead: AuditSubmission): string {
  const attribution = lead.attribution ?? {};
  const labels: Record<string, string> = {
    submission_id: safeText(lead.submission_id),
    name: safeText(lead.name),
    phone: safeText(lead.phone),
    email: safeText(lead.email ?? ""),
    business_name: safeText(lead.business_name ?? ""),
    industry: safeText(labelOf("industry", lead.industry)),
    website: safeText(lead.website ?? ""),
    acquisition_channels: Array.isArray(lead.acquisition_channels)
      ? lead.acquisition_channels.map((id) => labelOf("channels", String(id))).join("، ")
      : "",
    primary_problem: safeText(labelOf("problems", lead.primary_problem)),
    requested_service: safeText(labelOf("needs", lead.requested_service)),
    customer_value_range: safeText(labelOf("valueRanges", String(lead.customer_value_range ?? ""))),
    preferred_contact: safeText(labelOf("preferredContact", String(lead.preferred_contact))),
    landing_page: safeText(String(attribution.landing_page ?? "")),
    referrer: safeText(String(attribution.referrer ?? "")),
    utm_source: safeText(String(attribution.utm_source ?? "")),
    utm_medium: safeText(String(attribution.utm_medium ?? "")),
    utm_campaign: safeText(String(attribution.utm_campaign ?? "")),
  };
  const rows = Object.entries(labels)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;color:#66716b;">${k}</td><td style="padding:4px 8px;">${v || "—"}</td></tr>`,
    )
    .join("");
  return `<div dir="rtl" style="font-family:Estedad,Vazirmatn,sans-serif;"><h2>درخواست بررسی مسیر جذب</h2><table>${rows}</table></div>`;
}

export async function sendLeadEmail(
  lead: AuditSubmission,
  env: AuditEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean }> {
  const apiKey = env.RESEND_API_KEY;
  const to = env.LEAD_TO_EMAIL ?? "imdanialrashidi@gmail.com";
  const from = env.EMAIL_FROM ?? "Noveno <noreply@noveno.ir>";
  if (!apiKey) return { ok: false };
  const subject = `درخواست بررسی مسیر جذب — ${safeText(lead.business_name ?? lead.name ?? "")}`;
  const html = renderLeadHtml(lead);
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false };
    try {
      const data = (await res.json()) as { id?: string };
      return { ok: typeof data.id === "string" && data.id.length > 0 };
    } catch {
      return { ok: true };
    }
  } catch {
    return { ok: false };
  }
}
