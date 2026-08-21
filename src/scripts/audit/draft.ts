/**
 * Audit draft persistence (plan 023) — sessionStorage + attribution.
 *
 * - Draft: persisted to `noveno:audit:draft` on every change, restored on
 *   load (reload-safe journey), cleared only after confirmed Web3Forms delivery.
 * - submission_id: `crypto.randomUUID()` minted at journey start, stable across retries.
 * - Attribution: read from session-scoped capture (`noveno:attribution`) at
 *   journey start, falling back to a local capture — independent of analytics delivery.
 */

import { AUDIT_OPTIONS } from "../../data/audit.ts";
import { LIMITS } from "../../../functions/lib/contract.ts";
import { readAttribution, type Attribution } from "../analytics.ts";

function clampAttr(value: string | undefined, max: number): string {
  return typeof value === "string" && value.length > max ? value.slice(0, max) : (value ?? "");
}

export interface Draft {
  submission_id: string;
  step: number;
  values: Record<string, string | string[]>;
  attribution: Attribution | null;
}

export const DRAFT_KEY = "noveno:audit:draft";
export const DONE_KEY = "noveno:audit:done";

export function readDraft(): Draft | null {
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

export function writeDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — in-memory journey still works */
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* noop */
  }
}

export function captureAttributionNow(): Attribution {
  const params = new URLSearchParams(location.search);
  const attribution: Attribution = {
    landing_page: clampAttr(location.pathname + location.search, LIMITS.landingPage),
    referrer: clampAttr(document.referrer, LIMITS.referrer),
    first_seen_at: new Date().toISOString(),
  };
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const value = params.get(key);
    if (value) attribution[key] = clampAttr(value, LIMITS.utm);
  }
  return attribution;
}

/**
 * Fallback UUID v4: prefer crypto.randomUUID, then crypto.getRandomValues, then Math.random.
 * Output matches functions/lib/contract.ts UUID_PATTERN (lowercase hex).
 * The server lowers submission_id (.toLowerCase()) at validate time anyway, but we emit lowercase.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort — not crypto-strong but better than throwing (journey still completes)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createDraft(): Draft {
  return {
    submission_id: randomId(),
    step: 1,
    values: {},
    attribution: readAttribution() ?? captureAttributionNow(),
  };
}

export function applyDraftToDom(draft: Draft | null, root: HTMLElement): void {
  if (!draft) return;
  const { values } = draft;
  for (const [fieldId, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const chip of root.querySelectorAll<HTMLButtonElement>(`[data-chip][data-group="${fieldId}"]`)) {
        const id = chip.getAttribute("data-chip");
        if (id && value.includes(id)) chip.setAttribute("aria-checked", "true");
      }
    } else {
      const el = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
      if (el && typeof value === "string") el.value = value;
    }
  }
}

export function saveValues(
  root: HTMLElement,
  draft: Draft,
  multiselectValue: (fieldId: string) => string[],
  fieldValue: (fieldId: string) => string,
): void {
  for (const section of root.querySelectorAll<HTMLElement>("[data-step-section]")) {
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

function labelOf(group: keyof typeof AUDIT_OPTIONS, id: string): string {
  return (
    (AUDIT_OPTIONS[group] as readonly { id: string; label: string }[]).find((option) => option.id === id)
      ?.label ?? id
  );
}

/**
 * Fill the last-step review summary from the draft. Rows with no
 * answer stay hidden; labels are the display side of the client enums.
 */
export function fillSummary(draft: Draft | null): void {
  const container = document.getElementById("audit-summary");
  if (!container) return;
  const values = draft?.values ?? {};
  const set = (row: string, value: string): void => {
    const rowEl = container.querySelector<HTMLElement>(`[data-summary-row="${row}"]`);
    const textEl = container.querySelector<HTMLElement>(`[data-summary-${row}]`);
    if (!rowEl || !textEl) return;
    const has = value.trim() !== "";
    rowEl.hidden = !has;
    if (has) textEl.textContent = value;
  };
  set("industry", labelOf("industry", String(values.industry ?? "")));
  set(
    "channels",
    Array.isArray(values.acquisition_channels)
      ? values.acquisition_channels.map((id) => labelOf("channels", String(id))).join("، ")
      : "",
  );
  set("problem", labelOf("problems", String(values.primary_problem ?? "")));
  set("need", labelOf("needs", String(values.requested_service ?? "")));
}
