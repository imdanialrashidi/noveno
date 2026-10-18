/**
 * Server-side lead email via Resend (spike D-01, plan 028).
 *
 * - Pure fetch, no new dependency, works in Cloudflare Workers (`nodejs_compat`).
 * - Reuses Persian labels from src/data/audit.ts contract + safeText stripping.
 * - Never logs lead PII (same rule as functions/api/audit.ts).
 */

import type { AuditSubmission, AuditEnv } from "./contract.ts";
import { leadRows } from "../../src/data/lead-contract.ts";

function renderRows(lead: AuditSubmission): Record<string, string> {
  return leadRows(
    lead as unknown as Record<string, unknown>,
    (lead.attribution ?? {}) as unknown as Record<string, unknown>,
  );
}

function renderLeadHtml(lead: AuditSubmission): string {
  const labels = renderRows(lead);
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
  const rows = renderRows(lead);
  const subject = `درخواست بررسی مسیر جذب — ${rows.business_name || rows.name}`;
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
