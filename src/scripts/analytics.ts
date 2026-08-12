/**
 * Acquisition telemetry (plan §5.8, Spec §36–37) — framework-free,
 * non-blocking, PII-free.
 *
 * - Attribution capture: the FIRST page of a session records
 *   landing_page / referrer / utm_* / first_seen_at into sessionStorage
 *   (`noveno:attribution`). The audit journey reads this record at
 *   journey start; it exists independently of analytics delivery — an
 *   analytics outage never affects the attribution stored with the lead.
 * - Events: declarative `data-event` attributes (with an optional
 *   `data-event-payload` JSON) plus an imperative `track()` for the
 *   audit journey. Payloads carry only event metadata (page, section,
 *   step, service, slug, channel) — never name/phone/email.
 * - Delivery: queued, flushed via sendBeacon (fallback fetch keepalive)
 *   on idle and pagehide; every call is wrapped so analytics can never
 *   throw into UI handlers.
 */

export type EventName =
  | "primary_cta_click"
  | "secondary_cta_click"
  | "audit_started"
  | "audit_step_completed"
  | "audit_submitted"
  | "phone_click"
  | "messaging_click"
  | "service_opened"
  | "case_study_opened"
  | "project_opened";

export interface EventPayload {
  [key: string]: string | number;
}

export interface Attribution {
  landing_page: string;
  referrer: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  first_seen_at: string;
}

const ATTRIBUTION_KEY = "noveno:attribution";
const EVENT_URL = "/api/events";

/* ------------------------------------------------------------------ */
/* Attribution capture (session-scoped, first page wins)               */
/* ------------------------------------------------------------------ */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function captureAttribution(): void {
  try {
    if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
    const params = new URLSearchParams(location.search);
    const attribution: Attribution = {
      landing_page: location.pathname + location.search,
      referrer: document.referrer,
      first_seen_at: new Date().toISOString(),
    };
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) attribution[key] = value;
    }
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    /* storage unavailable — the audit journey falls back to local capture */
  }
}

export function readAttribution(): Attribution | null {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    if (typeof parsed.landing_page !== "string" || typeof parsed.first_seen_at !== "string") {
      return null;
    }
    return parsed as Attribution;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Event queue + delivery (never throws, never blocks)                 */
/* ------------------------------------------------------------------ */

const pending: { name: EventName; payload: EventPayload }[] = [];
let timer: number | undefined;

function send(event: { name: EventName; payload: EventPayload }): void {
  try {
    const body = new Blob([JSON.stringify(event)], { type: "application/json" });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(EVENT_URL, body);
    } else {
      void fetch(EVENT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* analytics must never break the page */
  }
}

function flush(): void {
  timer = undefined;
  const batch = pending.splice(0, pending.length);
  for (const event of batch) send(event);
}

function schedule(): void {
  if (timer !== undefined) return;
  timer = window.setTimeout(flush, 800);
}

export function track(name: EventName, payload: EventPayload = {}): void {
  try {
    pending.push({ name, payload: { ...payload, page: location.pathname } });
    schedule();
  } catch {
    /* never throw into UI handlers */
  }
}

/* ------------------------------------------------------------------ */
/* Declarative wiring                                                   */
/* ------------------------------------------------------------------ */

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  const element = target?.closest?.("[data-event]");
  if (!element) return;
  const name = element.getAttribute("data-event") as EventName | null;
  if (!name) return;
  let payload: EventPayload = {};
  const raw = element.getAttribute("data-event-payload");
  if (raw) {
    try {
      payload = JSON.parse(raw) as EventPayload;
    } catch {
      payload = {};
    }
  }
  track(name, payload);
}

export function initAnalytics(): void {
  captureAttribution();
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
