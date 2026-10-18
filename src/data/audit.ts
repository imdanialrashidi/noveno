/**
 * Audit form client contract (Spec §31, DESIGN §11, plan §5.4).
 *
 * Field/step shape and UX copy live here. Everything the server must also
 * know — option ids + Persian labels, length caps, normalization, field
 * validation keys, delivery-safe rendering — lives in the shared
 * `lead-contract` module behind its interface; this module re-exports that
 * surface so existing import paths keep working. The authoritative server
 * enums are derived from the same source, so the two cannot drift.
 *
 * Values are Latin ids — labels are the display side.
 */

import {
  AUDIT_OPTIONS as LEAD_OPTIONS,
  CLIENT_PHONE_UX_MAX,
  leadFieldKey,
  normalizePhone as normalizeLeadPhone,
} from "./lead-contract.ts";
import type { AuditOption } from "./lead-contract.ts";

export {
  AUDIT_OPTIONS,
  CLIENT_PHONE_UX_MAX,
  LEAD_HONEYPOT_FIELD,
  LEAD_LIMITS,
  honeypotTriggered,
  labelOf,
  labelsOf,
  leadFieldKey,
  leadRows,
  normalizeDigits,
  normalizeEmail,
  normalizePhone,
  normalizePlain,
  normalizeText,
  requiredFieldsForStep,
  safeText,
} from "./lead-contract.ts";
export type { AuditOption, LeadOptionGroup } from "./lead-contract.ts";

/** Client phone digit normalizer — the shared contract's normalizer. */
export function normalizePhoneClient(value: string): string {
  return normalizeLeadPhone(value);
}

/**
 * Returns a Persian error message key ('' = valid). Keys are mapped to
 * copy in the audit page script. Client validation is UX-only: the shared
 * contract owns the digit floor and shape, and the ≤15-char UX ceiling
 * stays a client-only adapter concern (the server length cap is
 * authoritative).
 */
export function validateFieldClient(fieldId: string, value: string): string {
  if (fieldId === "phone" && leadFieldKey(fieldId, value) === "" && value.trim() !== "") {
    return normalizeLeadPhone(value.trim()).length > CLIENT_PHONE_UX_MAX ? "invalid" : "";
  }
  return leadFieldKey(fieldId, value);
}

export type {
  JourneyFieldKind as FieldKind,
  JourneyField as AuditField,
  JourneyStep as AuditStep,
} from "./audit-journey.ts";
export { JOURNEY_FIELDS, JOURNEY_STATIONS, JOURNEY_STEPS } from "./audit-journey.ts";
import { JOURNEY_STEPS as JOURNEY_STEPS_FOR_ALIAS } from "./audit-journey.ts";
import type { JourneyStep as JourneyStepType } from "./audit-journey.ts";

/** Back-compat alias: the journey module owns the definitions. */
export const AUDIT_STEPS: readonly JourneyStepType[] = JOURNEY_STEPS_FOR_ALIAS;

/**
 * Audit progress stations — DERIVED from AUDIT_STEPS so a progress label
 * can never drift from the form. The first-contact form is a single
 * screen, so this list is one entry; the desktop rail that used to
 * render six of them went away with the multi-step journey
 * (docs/DESIGN.md §3.7).
 */
export { JOURNEY_STATIONS as AUDIT_STATIONS } from "./audit-journey.ts";
