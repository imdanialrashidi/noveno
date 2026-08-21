/**
 * Server-side lead email via Resend (spike D-01, plan 028).
 *
 * - Pure fetch, no new dependency, works in Cloudflare Workers (`nodejs_compat`).
 * - Reuses Persian labels from src/data/audit.ts contract + safeText stripping.
 * - Never logs lead PII (same rule as functions/api/audit.ts).
 */

import type { AuditSubmission, AuditEnv } from "./contract.ts";
// AUDIT_OPTIONS lives client-side (src/data/audit.ts) — replicate labels here to keep functions self-contained
const AUDIT_OPTIONS = {
  industry: [
    { id: "salon_beauty", label: "آرایشگاه و زیبایی" },
    { id: "restaurant_cafe", label: "رستوران و کافه" },
    { id: "clinic_health", label: "کلینیک و سلامت" },
    { id: "education", label: "آموزش" },
    { id: "real_estate", label: "املاک" },
    { id: "consulting_professional", label: "مشاوره و خدمات حرفه‌ای" },
    { id: "retail_shop", label: "فروشگاه" },
    { id: "auto_services", label: "خدمات خودرو" },
    { id: "fitness_sports", label: "تناسب و ورزش" },
    { id: "manufacturing_craft", label: "تولید و صنایع دستی" },
    { id: "other", label: "سایر" },
  ],
  channels: [
    { id: "instagram", label: "اینستاگرام" },
    { id: "google", label: "گوگل" },
    { id: "advertising", label: "تبلیغات" },
    { id: "referral", label: "معرفی" },
    { id: "in_person", label: "حضوری" },
    { id: "website", label: "وب‌سایت" },
    { id: "other", label: "سایر" },
  ],
  problems: [
    { id: "low_requests", label: "درخواست کم" },
    { id: "scattered_lost", label: "درخواست‌ها پراکنده‌اند یا گم می‌شوند" },
    { id: "no_website", label: "وب‌سایت نداریم" },
    { id: "website_unclear", label: "وب‌سایت شفاف نیست" },
    { id: "weak_followup", label: "پیگیری ضعیف" },
    { id: "unknown_channels", label: "کانال‌های نامشخص" },
    { id: "not_sure", label: "نمی‌دانم" },
  ],
  needs: [
    { id: "audit_analysis", label: "تحلیل مسیر جذب" },
    { id: "build_system", label: "ساخت سیستم جذب" },
    { id: "redesign_path", label: "بازطراحی مسیر" },
    { id: "monthly_improvement", label: "بهبود ماهانه" },
    { id: "not_sure_yet", label: "هنوز مطمئن نیستم" },
  ],
  valueRanges: [
    { id: "under_5m", label: "کمتر از ۵ میلیون" },
    { id: "5m_20m", label: "۵ تا ۲۰ میلیون" },
    { id: "20m_50m", label: "۲۰ تا ۵۰ میلیون" },
    { id: "50m_200m", label: "۵۰ تا ۲۰۰ میلیون" },
    { id: "over_200m", label: "بیش از ۲۰۰ میلیون" },
  ],
  preferredContact: [
    { id: "phone", label: "تماس" },
    { id: "whatsapp", label: "واتساپ" },
    { id: "telegram", label: "تلگرام" },
    { id: "email", label: "ایمیل" },
  ],
} as const;

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
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#66716b;">${k}</td><td style="padding:4px 8px;">${v || "—"}</td></tr>`)
    .join("");
  return `<div dir="rtl" style="font-family:Estedad,Vazirmatn,sans-serif;"><h2>درخواست بررسی مسیر جذب</h2><table>${rows}</table></div>`;
}

export async function sendLeadEmail(
  lead: AuditSubmission,
  env: AuditEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean }> {
  const apiKey = (env as AuditEnv & { RESEND_API_KEY?: string }).RESEND_API_KEY;
  const to = (env as AuditEnv & { LEAD_TO_EMAIL?: string }).LEAD_TO_EMAIL ?? "imdanialrashidi@gmail.com";
  const from = (env as AuditEnv & { EMAIL_FROM?: string }).EMAIL_FROM ?? "Noveno <noreply@noveno.ir>";
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
