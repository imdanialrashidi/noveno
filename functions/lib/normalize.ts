/**
 * Normalization helpers (plan §5.5, risk R9) — pure and unit-tested.
 * Persian digits (۰–۹), Arabic-Indic digits (٠–٩) and Latin digits are
 * all normalized to Latin before persistence and before the Web3Forms
 * payload. Persian digit rendering in the UI is the brand default; the
 * stored value is normalized Latin.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Map Persian and Arabic-Indic digits to Latin digits; other chars unchanged. */
export function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/**
 * Phone normalization: any digit script → Latin, then keep only digits
 * and a single leading "+". Persian formatting like «۰۹۳۵-۳۵۹ ۸۶۲۰»
 * becomes «09353598620».
 */
export function normalizePhone(input: string): string {
  const digits = normalizeDigits(input).replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? `+${digits.replace(/\+/g, "")}` : digits;
}

/** Trim + collapse internal whitespace runs (names, business names). */
export function normalizeText(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** Trim + lowercase for email (domain case-insensitivity). */
export function normalizeEmail(input: string): string {
  return normalizeText(input).toLowerCase();
}

/** Trim for URLs / attribution strings. */
export function normalizePlain(input: string): string {
  return input.trim();
}
