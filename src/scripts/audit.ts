/**
 * Audit journey state machine (plan §5.4, DESIGN §11) — framework-free.
 *
 * - Draft: persisted to sessionStorage (`noveno:audit:draft`) on every
 *   change; restored on load (reload-safe journey); cleared only after a
 *   confirmed 200 from /api/audit.
 * - submission_id: `crypto.randomUUID()` minted at journey start, stable
 *   across retries; a genuinely new journey gets a new id.
 * - Attribution: read from the session-scoped capture (`noveno:attribution`,
 *   first page of the session) at journey start, falling back to a local
 *   capture — independent of analytics delivery.
 * - Turnstile: explicit render (theme follows the site theme), token
 *   required before submit, reset on retry after a consumed/expired token.
 * - Submit: single in-flight guard; 200 → fire audit_submitted → best-effort
 *   Web3Forms notification (bounded, one retry) → /audit/thank-you.
 *   Recoverable failures → banner + retry with values preserved.
 * - Client validation is UX-only; the function is authoritative.
 */

import {
  AUDIT_OPTIONS,
  AUDIT_STEPS,
  normalizePhoneClient,
  requiredFieldsForStep,
  validateFieldClient,
} from "../data/audit.ts";
import { readAttribution, track, type Attribution } from "./analytics.ts";
import { effectiveTheme } from "./theme.ts";
import { toFaDigits } from "../data/site.ts";

export interface AuditConfig {
  turnstileSiteKey: string;
  web3formsKey: string;
  web3formsUrl: string;
}

interface Draft {
  submission_id: string;
  step: number;
  values: Record<string, string | string[]>;
  attribution: Attribution | null;
}

const DRAFT_KEY = "noveno:audit:draft";
const DONE_KEY = "noveno:audit:done";
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/* ------------------------------------------------------------------ */
/* Element handles                                                      */
/* ------------------------------------------------------------------ */

interface Handles {
  form: HTMLFormElement;
  sections: HTMLElement[];
  stations: HTMLElement[];
  counter: HTMLElement | null;
  currentLabel: HTMLElement | null;
  bar: HTMLElement | null;
  announce: HTMLElement | null;
  banner: HTMLElement | null;
  bannerBlocks: Record<string, HTMLElement>;
  back: HTMLButtonElement | null;
  next: HTMLButtonElement | null;
  turnstileContainer: HTMLElement | null;
}

/* ------------------------------------------------------------------ */
/* Draft persistence                                                    */
/* ------------------------------------------------------------------ */

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (
      typeof parsed.submission_id !== "string" ||
      typeof parsed.step !== "number" ||
      typeof parsed.values !== "object" ||
      parsed.values === null
    ) {
      return null;
    }
    return parsed as Draft;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — in-memory journey still works */
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* noop */
  }
}

function captureAttributionNow(): Attribution {
  const params = new URLSearchParams(location.search);
  const attribution: Attribution = {
    landing_page: location.pathname + location.search,
    referrer: document.referrer,
    first_seen_at: new Date().toISOString(),
  };
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const value = params.get(key);
    if (value) attribution[key] = value;
  }
  return attribution;
}

function createDraft(): Draft {
  return {
    submission_id: crypto.randomUUID(),
    step: 1,
    values: {},
    attribution: readAttribution() ?? captureAttributionNow(),
  };
}

/* ------------------------------------------------------------------ */
/* Turnstile (explicit render, theme-synced, reset on retry)           */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: Record<string, unknown>): string;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}

class TurnstileBridge {
  private widgetId: string | null = null;
  private token: string | null = null;
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

  /** Existing token if fresh, else reset the widget and wait (bounded). */
  async getToken(): Promise<string | null> {
    if (this.token) return this.token;
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
    this.scriptFailed = false;
  }

  syncTheme(): void {
    if (!this.widgetId || !window.turnstile) return;
    const id = this.widgetId;
    window.turnstile.remove(id);
    this.widgetId = null;
    this.token = null;
    void this.ensureRendered();
  }
}

/* ------------------------------------------------------------------ */
/* Validation UX (client-side only — server is authoritative)          */
/* ------------------------------------------------------------------ */

const FIELD_ERROR_COPY: Record<string, Record<string, string>> = {
  name: { required: "نام و نام خانوادگی را وارد کنید", too_short: "نام کوتاه است" },
  phone: { required: "شماره تماس را وارد کنید", invalid: "شماره تماس را کامل وارد کنید" },
  email: { invalid: "ایمیل معتبر وارد کنید", too_long: "ایمیل خیلی طولانی است" },
  website: { too_long: "نشانی خیلی طولانی است" },
  business_name: { too_long: "نام کسب‌وکار خیلی طولانی است" },
  industry: { required: "یک حوزه فعالیت انتخاب کنید" },
  primary_problem: { required: "یک گزینه انتخاب کنید" },
  requested_service: { required: "یک گزینه انتخاب کنید" },
  preferred_contact: { required: "روش دلخواه تماس را انتخاب کنید" },
  customer_value_range: {},
};

/* ------------------------------------------------------------------ */
/* Main controller                                                      */
/* ------------------------------------------------------------------ */

export function initAudit(config: AuditConfig): void {
  const form = document.getElementById("audit-form") as HTMLFormElement | null;
  if (!form) return;
  const root = form;

    const handles: Handles = {
    form: root,
    sections: [...form.querySelectorAll<HTMLElement>("[data-step-section]")],
    stations: [...document.querySelectorAll<HTMLElement>("[data-stepper-station]")],
    counter: document.querySelector<HTMLElement>("[data-stepper-counter]"),
    currentLabel: document.querySelector<HTMLElement>("[data-stepper-current]"),
    bar: document.querySelector<HTMLElement>("[data-stepper-bar]"),
    announce: document.getElementById("step-announce"),
    banner: document.getElementById("audit-banner"),
    bannerBlocks: Object.fromEntries(
      [...(document.querySelectorAll<HTMLElement>("[data-banner]"))].map((el) => [
        el.getAttribute("data-banner"),
        el,
      ]),
    ),
    back: document.getElementById("audit-back") as HTMLButtonElement | null,
    next: document.getElementById("audit-next") as HTMLButtonElement | null,
    turnstileContainer: document.getElementById("turnstile-container"),
  };

  const totalSteps = handles.sections.length;
  let draft = readDraft();
  let currentStep = draft?.step ?? 1;
  let renderedStep = 0;
  let submitting = false;
  let bridge: TurnstileBridge | null = null;

  /* ----- draft lazy creation at journey start (first interaction) ----- */

  function ensureDraft(): Draft {
    if (!draft) {
      draft = createDraft();
      currentStep = draft.step;
      writeDraft(draft);
    }
    return draft;
  }

  /* ----- field value access ----- */

  function fieldValue(fieldId: string): string {
    const el = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
    return el ? el.value : "";
  }

  function multiselectValue(fieldId: string): string[] {
    return [...root.querySelectorAll<HTMLButtonElement>(`[data-chip][data-group="${fieldId}"]`)]
      .filter((chip) => chip.getAttribute("aria-checked") === "true")
      .map((chip) => chip.getAttribute("data-chip") ?? "");
  }

  /* ----- draft ⇄ DOM ----- */

  function applyDraftToDom(): void {
    if (!draft) return;
    const { values } = draft;
    for (const [fieldId, value] of Object.entries(values)) {
      if (Array.isArray(value)) {
        for (const chip of root.querySelectorAll<HTMLButtonElement>(
          `[data-chip][data-group="${fieldId}"]`,
        )) {
          const id = chip.getAttribute("data-chip");
          if (id && value.includes(id)) chip.setAttribute("aria-checked", "true");
        }
      } else {
        const el = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
        if (el && typeof value === "string") el.value = value;
      }
    }
  }

  function saveValues(): void {
    ensureDraft();
    if (!draft) return;
    for (const section of handles.sections) {
      for (const field of section.querySelectorAll<HTMLElement>("[data-save]")) {
        const fieldId = field.getAttribute("data-save");
        if (!fieldId) continue;
        if (field.hasAttribute("data-multiselect")) {
          draft.values[fieldId] = multiselectValue(fieldId);
        } else {
          draft.values[fieldId] = fieldValue(fieldId);
        }
      }
    }
    writeDraft(draft);
  }

  /* ----- step rendering ----- */

  function stepIndex(): number {
    return Math.min(Math.max(currentStep, 1), totalSteps);
  }

  function renderStep(): void {
    const current = stepIndex();
    if (draft) draft.step = current;

    handles.sections.forEach((section, index) => {
      section.hidden = index + 1 !== current;
    });

    // StepperLine state (visual contract lives in StepperLine.astro)
    handles.stations.forEach((station) => {
      const n = Number(station.getAttribute("data-stepper-station"));
      station.setAttribute(
        "data-state",
        n < current ? "complete" : n === current ? "current" : "upcoming",
      );
    });
    if (handles.counter) handles.counter.textContent = `مرحله ${toFaDigits(current)} از ${toFaDigits(totalSteps)}`;
    if (handles.currentLabel) handles.currentLabel.textContent = AUDIT_STEPS[current - 1]?.label ?? "";
    if (handles.bar) handles.bar.style.width = `${((current - 1) / totalSteps) * 100}%`;

    if (handles.announce) {
      handles.announce.textContent = `مرحله ${toFaDigits(current)} از ${toFaDigits(totalSteps)}: ${
        AUDIT_STEPS[current - 1]?.label ?? ""
      }`;
    }

    if (handles.back) handles.back.hidden = current === 1;
    if (handles.next) {
      const last = current === totalSteps;
      handles.next.textContent = last ? "ثبت درخواست بررسی" : "بعدی";
      handles.next.setAttribute("data-last", last ? "true" : "false");
    }

    // Turnstile renders when the contact station becomes current.
    if (current === totalSteps && config.turnstileSiteKey && handles.turnstileContainer) {
      bridge ??= new TurnstileBridge(config.turnstileSiteKey, handles.turnstileContainer);
      void bridge.ensureRendered();
    }

    const heading = document.getElementById(`step-${AUDIT_STEPS[current - 1]?.id}-title`);
    // Focus the step heading only on an actual step change — never on the
    // initial boot of a fresh visit (reviewer finding).
    if (heading && renderedStep !== current) {
      (heading as HTMLElement).focus({ preventScroll: true });
    }
    renderedStep = current;
  }

  /* ----- banner ----- */

  function showBanner(kind: string | null): void {
    if (!handles.banner) return;
    for (const [key, block] of Object.entries(handles.bannerBlocks)) {
      block.hidden = key !== kind;
    }
    handles.banner.hidden = kind === null;
  }

  /* ----- field errors ----- */

  function showFieldError(fieldId: string, key: string): void {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const input = document.getElementById(fieldId) as HTMLElement | null;
    if (!errorEl) return;
    const copy = FIELD_ERROR_COPY[fieldId]?.[key] ?? "";
    const textEl = errorEl.querySelector<HTMLElement>("[data-error-text]");
    if (textEl) textEl.textContent = copy;
    errorEl.hidden = !copy;
    if (input) input.setAttribute("aria-invalid", copy ? "true" : "false");
    if (input && copy) {
      // aria-describedby linkage: error id joins the hint id (DESIGN §11)
      const describedBy = new Set(
        (input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean),
      );
      describedBy.add(`${fieldId}-error`);
      input.setAttribute("aria-describedby", [...describedBy].join(" "));
    }
  }

  function clearFieldError(fieldId: string): void {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const input = document.getElementById(fieldId) as HTMLElement | null;
    if (errorEl) {
      const textEl = errorEl.querySelector<HTMLElement>("[data-error-text]");
      if (textEl) textEl.textContent = "";
      errorEl.hidden = true;
    }
    if (input) {
      input.removeAttribute("aria-invalid");
      const describedBy = (input.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter((id) => id !== `${fieldId}-error`);
      if (describedBy.length > 0) input.setAttribute("aria-describedby", describedBy.join(" "));
      else input.removeAttribute("aria-describedby");
    }
  }

  function validateStep(stepId: string): boolean {
    const required = requiredFieldsForStep(stepId);
    let valid = true;
    for (const fieldId of required) {
      const value = fieldValue(fieldId);
      const multi = multiselectValue(fieldId);
      const filled =
        fieldId === "acquisition_channels" ? multi.length > 0 : value.trim() !== "";
      if (!filled) {
        showFieldError(fieldId, "required");
        valid = false;
      } else {
        const key = validateFieldClient(fieldId, value);
        if (key) {
          showFieldError(fieldId, key);
          valid = false;
        } else {
          clearFieldError(fieldId);
        }
      }
    }
    if (!valid) {
      showBanner("validation");
      const firstInvalid = required.find((id) => {
        const el = document.getElementById(id);
        return el && el.getAttribute("aria-invalid") === "true";
      });
      const target = firstInvalid ? document.getElementById(firstInvalid) : null;
      target?.focus();
    }
    return valid;
  }

  /* ----- analytics events ----- */

  let started = false;

  function markStarted(): void {
    if (!started) {
      started = true;
      track("audit_started");
    }
  }

  /* ----- navigation ----- */

  function goBack(): void {
    if (!draft || draft.step <= 1) return;
    saveValues();
    draft.step -= 1;
    currentStep = draft.step;
    writeDraft(draft);
    showBanner(null);
    renderStep();
  }

  function goNext(): void {
    ensureDraft();
    if (!draft) return;
    const current = AUDIT_STEPS[draft.step - 1];
    if (!current) return;
    saveValues();
    if (!validateStep(current.id)) return;
    if (draft.step >= totalSteps) {
      void submit();
      return;
    }
    markStarted();
    track("audit_step_completed", { step: String(draft.step) });
    draft.step += 1;
    currentStep = draft.step;
    writeDraft(draft);
    showBanner(null);
    renderStep();
  }

  /* ----- submit ----- */

  function buildPayload(token: string): Record<string, unknown> {
    const d = ensureDraft();
    const values = d.values;
    const attribution = d.attribution ?? captureAttributionNow();
    const phoneRaw = String(values.phone ?? "");
    const honeypot = root.querySelector<HTMLInputElement>("[data-honeypot]");
    return {
      submission_id: d.submission_id,
      company_website: honeypot?.value ?? "",
      name: String(values.name ?? "").trim(),
      phone: normalizePhoneClient(phoneRaw),
      email: String(values.email ?? "").trim() || undefined,
      preferred_contact: String(values.preferred_contact ?? ""),
      business_name: String(values.business_name ?? "").trim() || undefined,
      industry: String(values.industry ?? ""),
      website: String(values.website ?? "").trim() || undefined,
      acquisition_channels: Array.isArray(values.acquisition_channels)
        ? values.acquisition_channels
        : [],
      primary_problem: String(values.primary_problem ?? ""),
      requested_service: String(values.requested_service ?? ""),
      customer_value_range: String(values.customer_value_range ?? "") || undefined,
      cf_turnstile_token: token,
      attribution: {
        landing_page: attribution.landing_page,
        referrer: attribution.referrer,
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        utm_content: attribution.utm_content,
        utm_term: attribution.utm_term,
        first_seen_at: attribution.first_seen_at,
      },
    };
  }

  function setSubmitting(active: boolean): void {
    submitting = active;
    if (!handles.next) return;
    handles.next.disabled = active;
    handles.next.setAttribute("aria-busy", String(active));
    if (active) {
      handles.next.innerHTML =
        '<span aria-hidden="true" class="inline-block h-4 w-4 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin"></span>در حال ارسال…';
    } else {
      const last = handles.next.getAttribute("data-last") === "true";
      handles.next.textContent = last ? "ثبت درخواست بررسی" : "بعدی";
    }
  }

  async function submit(): Promise<void> {
    if (submitting) return;
    if (!config.turnstileSiteKey) {
      showBanner("unconfigured");
      return;
    }
    const current = AUDIT_STEPS[stepIndex() - 1];
    if (!current || !validateStep(current.id)) return;

    showBanner(null);
    setSubmitting(true);
    try {
      bridge ??=
        handles.turnstileContainer && config.turnstileSiteKey
          ? new TurnstileBridge(config.turnstileSiteKey, handles.turnstileContainer)
          : null;
      const token = bridge ? await bridge.getToken() : null;
      if (!token) {
        showBanner("turnstile");
        setSubmitting(false);
        return;
      }

      const payload = buildPayload(token);
      let response: Response;
      try {
        response = await fetch("/api/audit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // Network failure — recoverable; values are preserved in the draft.
        showBanner(navigator.onLine === false ? "offline" : "network");
        setSubmitting(false);
        return;
      }

      if (response.ok) {
        await onSuccess(payload);
        return;
      }

      let code = "";
      try {
        const body = (await response.json()) as { error?: { code?: string } };
        code = body.error?.code ?? "";
      } catch {
        /* non-JSON error body — treat as server error */
      }

      if (response.status === 403 || code === "turnstile_failed") {
        bridge?.invalidate();
        showBanner("turnstile");
      } else if (response.status === 429) {
        showBanner("rate");
      } else if (response.status === 400 || code === "validation") {
        // Server-side validation rejection — truthful copy, not "connection".
        showBanner("validation");
      } else {
        showBanner(navigator.onLine === false ? "offline" : "network");
      }
      setSubmitting(false);
    } catch {
      // Never leave the UI stuck submitting (reviewer finding): any
      // unexpected throw lands in the recoverable network banner.
      showBanner(navigator.onLine === false ? "offline" : "network");
      setSubmitting(false);
    }
  }

  /* ----- success: persistence confirmed by the function ----- */

  async function onSuccess(payload: Record<string, unknown>): Promise<void> {
    track("audit_submitted");
    clearDraft();
    try {
      sessionStorage.setItem(DONE_KEY, String(payload.submission_id ?? ""));
    } catch {
      /* noop */
    }
    await notifyWeb3Forms(payload);
    window.location.assign("/audit/thank-you");
  }

  /* ----- Web3Forms notification (best-effort, bounded, after 200) ----- */

  async function notifyWeb3Forms(payload: Record<string, unknown>): Promise<void> {
    if (!config.web3formsKey) return;
    const label = (ids: unknown, group: keyof typeof AUDIT_OPTIONS): string =>
      Array.isArray(ids)
        ? ids.map((id) => labelOf(group, String(id))).join("، ")
        : labelOf(group, String(ids ?? ""));
    const body: Record<string, string> = {
      access_key: config.web3formsKey,
      subject: `درخواست بررسی مسیر جذب — ${safeText(String(payload.business_name ?? payload.name ?? ""))}`,
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
      landing_page: safeText(String((payload.attribution as Record<string, string> | undefined)?.landing_page ?? "")),
      referrer: safeText(String((payload.attribution as Record<string, string> | undefined)?.referrer ?? "")),
      utm_source: safeText(String((payload.attribution as Record<string, string> | undefined)?.utm_source ?? "")),
      utm_medium: safeText(String((payload.attribution as Record<string, string> | undefined)?.utm_medium ?? "")),
      utm_campaign: safeText(String((payload.attribution as Record<string, string> | undefined)?.utm_campaign ?? "")),
      botcheck: "",
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await fetch(config.web3formsUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
          signal: AbortSignal.timeout(2500),
        });
        if (result.ok) return; // delivered — done
        // non-2xx: fall through to the one automatic retry
      } catch {
        // timeout/abort/network: one automatic retry, then move on —
        // the lead is already safe (Supabase is the source of truth)
      }
    }
  }

  /* ----- event binding ----- */

  form.addEventListener("input", () => {
    ensureDraft();
    saveValues();
    showBanner(null);
  });

  form.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    const fieldId = target.getAttribute("data-save") ?? target.id;
    if (fieldId) clearFieldError(fieldId);
    saveValues();
  });

  // Enter in any field advances the journey (implicit form submission).
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    goNext();
  });

  for (const input of root.querySelectorAll<HTMLElement>("[data-save]")) {
    input.addEventListener("blur", () => {
      const fieldId = input.getAttribute("data-save");
      if (!fieldId) return;
      const key = validateFieldClient(fieldId, fieldValue(fieldId));
      if (key) showFieldError(fieldId, key);
      else clearFieldError(fieldId);
      saveValues();
    });
  }

  // MultiSelect chips: click + RTL-aware arrow-key navigation.
  for (const chip of root.querySelectorAll<HTMLButtonElement>("[data-chip]")) {
    chip.addEventListener("click", () => {
      const checked = chip.getAttribute("aria-checked") === "true";
      chip.setAttribute("aria-checked", String(!checked));
      saveValues();
      const group = chip.getAttribute("data-group");
      if (group) clearFieldError(group);
    });
    chip.addEventListener("keydown", (event) => {
      const groupEl = chip.closest<HTMLElement>("[data-chip-group]");
      if (!groupEl) return;
      const chips = [...groupEl.querySelectorAll<HTMLButtonElement>("[data-chip]")];
      const index = chips.indexOf(chip);
      const isRtl = getComputedStyle(chip).direction === "rtl";
      let next = -1;
      switch (event.key) {
        case "ArrowRight":
          next = isRtl ? index - 1 : index + 1;
          break;
        case "ArrowLeft":
          next = isRtl ? index + 1 : index - 1;
          break;
        case "ArrowDown":
          next = index + 1;
          break;
        case "ArrowUp":
          next = index - 1;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = chips.length - 1;
          break;
        default:
          return;
      }
      if (next < 0) next = chips.length - 1;
      if (next >= chips.length) next = 0;
      event.preventDefault();
      chips[next]?.focus();
    });
  }

  handles.back?.addEventListener("click", goBack);
  handles.next?.addEventListener("click", () => {
    goNext();
  });

  // Banner retry button re-submits with the same values (draft intact);
  // the Turnstile bridge also gets a fresh chance after script-load
  // failure or a consumed token (reviewer finding).
  for (const retry of document.querySelectorAll<HTMLButtonElement>("[data-retry]")) {
    retry.addEventListener("click", () => {
      bridge?.retry();
      showBanner(null);
      void submit();
    });
  }

  // Offline → the same banner with the contact fallback emphasized.
  window.addEventListener("offline", () => {
    if (!submitting) showBanner("offline");
  });
  window.addEventListener("online", () => {
    if (handles.bannerBlocks.offline && !handles.bannerBlocks.offline.hidden) showBanner(null);
  });

  // Re-render the Turnstile widget when the site theme changes.
  const themeObserver = new MutationObserver(() => {
    bridge?.syncTheme();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* ----- boot ----- */

  if (draft) {
    applyDraftToDom();
  }
  renderStep();
  if (handles.next) handles.next.disabled = false;
  showBanner(null);
}

  /* label lookup for Web3Forms payload (client label side of the enums) */

function labelOf(group: keyof typeof AUDIT_OPTIONS, id: string): string {
  return (
    (AUDIT_OPTIONS[group] as readonly { id: string; label: string }[]).find(
      (option) => option.id === id,
    )?.label ?? id
  );
}

/**
 * Strip markup from free-text fields before the notification email
 * (security review MINOR-3): lead values are client-controlled and the
 * email renders as HTML — never let a submitted value carry tags.
 */
function safeText(value: string): string {
  return value.replace(/[<>]/g, "");
}
