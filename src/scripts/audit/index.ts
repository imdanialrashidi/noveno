/**
 * Audit journey state machine (plan §5.4, DESIGN §11) — framework-free.
 *
 * - Draft: persisted to sessionStorage (`noveno:audit:draft`) on every
 *   change; restored on load (reload-safe journey); cleared only after a
 *   confirmed Web3Forms delivery success.
 * - submission_id: `crypto.randomUUID()` minted at journey start, stable
 *   across retries; a genuinely new journey gets a new id. The id rides in
 *   the Web3Forms email so duplicate messages can be recognized.
 * - Attribution: read from the session-scoped capture (`noveno:attribution`,
 *   first page of the session) at journey start, falling back to a local
 *   capture — independent of analytics delivery.
 * - Turnstile: explicit render (theme follows the site theme), token
 *   required before submit, reset on retry after a consumed/expired token.
 * - Submit: single in-flight guard; POST /api/audit is the server trust
 *   boundary (validation + anti-abuse) but does NOT complete the journey —
 *   a 200 `validated` only means the server accepted the payload. The
 *   journey completes only when the browser's Web3Forms delivery confirms
 *   success ({ success: true }): then and only then → audit_submitted →
 *   draft cleared → done marker → /audit/thank-you.
 * - Delivery failure (network/timeout/non-2xx/success:false/429): stay on
 *   /audit, keep the draft + submission_id, show a truthful recoverable
 *   banner (with direct-contact fallback), allow retry with a fresh
 *   Turnstile token. Never present a false success.
 * - Client validation is UX-only; the function is authoritative.
 */

import {
  AUDIT_OPTIONS,
  AUDIT_STEPS,
  normalizePhoneClient,
  requiredFieldsForStep,
  validateFieldClient,
} from "../../data/audit.ts";
import { track } from "../analytics.ts";
import { toFaDigits } from "../../data/site.ts";
import {
  DONE_KEY,
  applyDraftToDom,
  captureAttributionNow,
  clearDraft,
  createDraft,
  fillSummary,
  readDraft,
  writeDraft,
} from "./draft.ts";
import type { Draft } from "./draft.ts";
import { TurnstileBridge } from "./turnstile.ts";
import { deliverLead } from "./delivery.ts";

export interface AuditConfig {
  turnstileSiteKey: string;
  web3formsKey: string;
  web3formsUrl: string;
}

/* ------------------------------------------------------------------ */
/* Element handles                                                      */
/* ------------------------------------------------------------------ */

interface Handles {
  form: HTMLFormElement;
  sections: HTMLElement[];
  counter: HTMLElement | null;
  currentLabel: HTMLElement | null;
  bar: HTMLElement | null;
  counterMobile: HTMLElement | null;
  currentMobile: HTMLElement | null;
  barMobile: HTMLElement | null;
  announce: HTMLElement | null;
  banner: HTMLElement | null;
  bannerBlocks: Record<string, HTMLElement>;
  back: HTMLButtonElement | null;
  next: HTMLButtonElement | null;
  turnstileContainer: HTMLElement | null;
  summary: HTMLElement | null;
}

/* ------------------------------------------------------------------ */
/* Validation UX (client-side only — server is authoritative)          */
/* ------------------------------------------------------------------ */

const FIELD_ERROR_COPY: Record<string, Record<string, string>> = {
  name: {
    required: "نام و نام خانوادگی را وارد کنید",
    too_short: "نام کوتاه است",
    too_long: "نام خیلی طولانی است",
  },
  phone: { required: "شماره تماس را وارد کنید", invalid: "شماره تماس را کامل وارد کنید" },
  email: { invalid: "ایمیل معتبر وارد کنید", too_long: "ایمیل خیلی طولانی است" },
  website: { too_long: "نشانی خیلی طولانی است" },
  business_name: { too_long: "نام کسب‌وکار خیلی طولانی است" },
  industry: { required: "یک حوزه فعالیت انتخاب کنید" },
  acquisition_channels: {
    required: "حداقل یک کانال ورود مشتری را انتخاب کنید",
    too_long: "بیشتر از این گزینه انتخاب نشود؛ فقط کانال‌های اصلی را علامت بزنید",
    invalid_enum: "یکی از گزینه‌های فهرست را انتخاب کنید",
  },
  primary_problem: { required: "یک گزینه انتخاب کنید" },
  requested_service: { required: "یک گزینه انتخاب کنید" },
  preferred_contact: { required: "روش دلخواه تماس را انتخاب کنید" },
  customer_value_range: {},
};

// Mirrors functions/lib/contract.ts LIMITS.maxChannels — server is authoritative.
const MAX_CLIENT_CHANNELS = AUDIT_OPTIONS.channels.length;

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
    counter: document.querySelector<HTMLElement>("[data-stepper-counter]"),
    currentLabel: document.querySelector<HTMLElement>("[data-stepper-current]"),
    bar: document.querySelector<HTMLElement>("[data-stepper-bar]"),
    counterMobile: document.querySelector<HTMLElement>("[data-stepper-counter-mobile]"),
    currentMobile: document.querySelector<HTMLElement>("[data-stepper-current-mobile]"),
    barMobile: document.querySelector<HTMLElement>("[data-stepper-bar-mobile]"),
    announce: document.getElementById("step-announce"),
    banner: document.getElementById("audit-banner"),
    bannerBlocks: Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>("[data-banner]")].map((el) => [
        el.getAttribute("data-banner"),
        el,
      ]),
    ),
    back: document.getElementById("audit-back") as HTMLButtonElement | null,
    next: document.getElementById("audit-next") as HTMLButtonElement | null,
    turnstileContainer: document.getElementById("turnstile-container"),
    summary: document.getElementById("audit-summary"),
  };

  const totalSteps = handles.sections.length;
  let draft = readDraft();
  let currentStep = draft?.step ?? 1;
  let renderedStep = currentStep;
  let submitting = false;
  let bridge: TurnstileBridge | null = null;

  function ensureDraft(): Draft {
    if (!draft) {
      draft = createDraft();
      currentStep = draft.step;
      writeDraft(draft);
    }
    return draft;
  }

  function fieldValue(fieldId: string): string {
    const el = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
    return el ? el.value : "";
  }

  function multiselectValue(fieldId: string): string[] {
    return [...root.querySelectorAll<HTMLButtonElement>(`[data-chip][data-group="${fieldId}"]`)]
      .filter((chip) => chip.getAttribute("aria-checked") === "true")
      .map((chip) => chip.getAttribute("data-chip") ?? "");
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

  function stepIndex(): number {
    return Math.min(Math.max(currentStep, 1), totalSteps);
  }

  function renderStep(): void {
    const current = stepIndex();
    if (draft) draft.step = current;

    handles.sections.forEach((section, index) => {
      section.hidden = index + 1 !== current;
    });

    if (handles.counter)
      handles.counter.textContent = `مرحله ${toFaDigits(current)} از ${toFaDigits(totalSteps)}`;
    if (handles.currentLabel) handles.currentLabel.textContent = AUDIT_STEPS[current - 1]?.label ?? "";
    if (handles.bar) handles.bar.style.width = `${((current - 1) / totalSteps) * 100}%`;

    if (handles.counterMobile)
      handles.counterMobile.textContent = `مرحله ${toFaDigits(current)} از ${toFaDigits(totalSteps)}`;
    if (handles.currentMobile) handles.currentMobile.textContent = AUDIT_STEPS[current - 1]?.label ?? "";
    if (handles.barMobile) handles.barMobile.style.width = `${((current - 1) / totalSteps) * 100}%`;

    if (handles.announce) {
      handles.announce.textContent = `مرحله ${toFaDigits(current)} از ${toFaDigits(totalSteps)}: ${
        AUDIT_STEPS[current - 1]?.label ?? ""
      }`;
    }

    if (handles.summary) {
      if (current === totalSteps) {
        fillSummary(draft);
        handles.summary.hidden = false;
      } else {
        handles.summary.hidden = true;
      }
    }

    if (handles.back) handles.back.hidden = current === 1;
    if (handles.next) {
      const last = current === totalSteps;
      handles.next.textContent = last ? "ثبت درخواست بررسی" : "بعدی";
      handles.next.setAttribute("data-last", last ? "true" : "false");
    }

    const onContactStep = current === totalSteps;
    if (handles.turnstileContainer) {
      // The widget lives outside the step sections: hide it whenever the user
      // is not on the contact step (rendered lazily on first arrival; token is
      // still consumed at submit time only).
      handles.turnstileContainer.hidden = !onContactStep;
    }
    if (onContactStep && config.turnstileSiteKey && handles.turnstileContainer) {
      bridge ??= new TurnstileBridge(config.turnstileSiteKey, handles.turnstileContainer);
      void bridge.ensureRendered();
    }

    const heading = document.getElementById(`step-${AUDIT_STEPS[current - 1]?.id}-title`);
    if (heading && renderedStep !== current) {
      (heading as HTMLElement).focus({ preventScroll: true });
    }
    renderedStep = current;
  }

  function showBanner(kind: string | null): void {
    if (!handles.banner) return;
    for (const [key, block] of Object.entries(handles.bannerBlocks)) {
      block.hidden = key !== kind;
    }
    handles.banner.hidden = kind === null;
  }

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
      const filled = fieldId === "acquisition_channels" ? multi.length > 0 : value.trim() !== "";
      if (!filled) {
        showFieldError(fieldId, "required");
        valid = false;
      } else if (fieldId === "acquisition_channels" && multi.length > MAX_CLIENT_CHANNELS) {
        // Mirrors functions/lib/contract.ts LIMITS.maxChannels — server is authoritative.
        showFieldError(fieldId, "too_long");
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

  let started = false;

  function markStarted(): void {
    if (!started) {
      started = true;
      track("audit_started");
    }
  }

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
      acquisition_channels: Array.isArray(values.acquisition_channels) ? values.acquisition_channels : [],
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
    // Double-submit guard: covers the entire validation fetch → Web3Forms
    // delivery window (setSubmitting(true) before fetch, cleared only on
    // failure paths; onSuccess navigates away). A second click while
    // deliverLead is in-flight is a no-op — bounded 2-attempt loop is the retry contract.
    if (submitting) return;
    if (!config.turnstileSiteKey || !config.web3formsKey) {
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
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        showBanner(navigator.onLine === false ? "offline" : "network");
        setSubmitting(false);
        return;
      }

      if (response.ok) {
        let validated = true;
        let receipt: string | null = null;
        let validatedAt: string | null = null;
        try {
          const body = (await response.json()) as {
            status?: string;
            receipt?: string;
            validated_at?: string;
          };
          // D-01 transition (spike §4): accept both statuses while Web3Forms
          // delivery still runs client-side. After cutover this narrows to "sent".
          validated = body.status === "validated" || body.status === "sent";
          if (typeof body.receipt === "string" && body.receipt.length > 0) receipt = body.receipt;
          if (typeof body.validated_at === "string" && body.validated_at.length > 0)
            validatedAt = body.validated_at;
        } catch {
          /* unreadable body — the server contract still holds */
        }
        if (!validated) {
          bridge?.invalidate();
          showBanner(navigator.onLine === false ? "offline" : "network");
          setSubmitting(false);
          return;
        }
        const delivered = await deliverLead(payload, config, receipt, validatedAt);
        if (!delivered.ok) {
          bridge?.invalidate();
          showBanner(delivered.rateLimited ? "rate" : "delivery");
          setSubmitting(false);
          return;
        }
        await onSuccess(payload);
        return;
      }

      let code = "";
      let fields: Record<string, string> = {};
      try {
        const body = (await response.json()) as {
          error?: { code?: string; fields?: Record<string, string> };
        };
        code = body.error?.code ?? "";
        fields = body.error?.fields ?? {};
      } catch {
        /* non-JSON error body — treat as server error */
      }

      if (response.status === 403 || code === "turnstile_failed") {
        bridge?.invalidate();
        showBanner("turnstile");
      } else if (response.status === 429) {
        showBanner("rate");
      } else if (response.status === 400 || code === "validation") {
        let firstInvalid: HTMLElement | null = null;
        for (const [fieldId, key] of Object.entries(fields)) {
          const input = document.getElementById(fieldId) as HTMLElement | null;
          if (!input) continue;
          showFieldError(fieldId, key);
          if (!firstInvalid) firstInvalid = input;
        }
        if (firstInvalid) firstInvalid.focus();
        showBanner("validation");
      } else {
        bridge?.invalidate();
        showBanner(navigator.onLine === false ? "offline" : "network");
      }
      setSubmitting(false);
    } catch {
      showBanner(navigator.onLine === false ? "offline" : "network");
      setSubmitting(false);
    }
  }

  async function onSuccess(payload: Record<string, unknown>): Promise<void> {
    track("audit_submitted");
    clearDraft();
    try {
      sessionStorage.setItem(DONE_KEY, String(payload.submission_id ?? ""));
    } catch {
      /* noop */
    }
    window.location.assign("/audit/thank-you");
  }

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

  for (const retry of document.querySelectorAll<HTMLButtonElement>("[data-retry]")) {
    retry.addEventListener("click", () => {
      bridge?.retry();
      showBanner(null);
      void submit();
    });
  }

  window.addEventListener("offline", () => {
    if (!submitting) showBanner("offline");
  });
  window.addEventListener("online", () => {
    if (handles.bannerBlocks.offline && !handles.bannerBlocks.offline.hidden) showBanner(null);
  });

  const themeObserver = new MutationObserver(() => {
    bridge?.syncTheme();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  if (draft) {
    applyDraftToDom(draft, root);
  }
  renderStep();
  if (handles.next) handles.next.disabled = false;
  showBanner(null);
}
