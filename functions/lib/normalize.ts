/**
 * Normalization helpers — thin re-export of the shared lead-contract
 * module's implementation. Callers cross the same interface; the single
 * implementation behind the seam is the only copy.
 */

export {
  normalizeDigits,
  normalizeEmail,
  normalizePhone,
  normalizePlain,
  normalizeText,
} from "../../src/data/lead-contract.ts";
