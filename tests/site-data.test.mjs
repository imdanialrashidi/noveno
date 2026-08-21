/**
 * Jalali-year regression for src/data/site.ts (plan 007).
 *
 * The old `jalaliYear` used a hand-rolled month approximation
 * (`getMonth() + 1 >= 3`) that treated the whole month of March as the
 * new year — wrong for March 1-20, when the correct Jalali year is still
 * the previous one (the Nowruz cutover is 21 March). The fix delegates to
 * `Intl.DateTimeFormat("fa-IR-u-nu-latn", ...)`, which computes the year
 * from CLDR data, then converts the result back to Persian digits via
 * `toFaDigits` — Persian digits are the brand default (the pre-fix
 * implementation also returned Persian digits, and `Footer.astro` renders
 * the value directly without conversion).
 *
 * Defect sensitivity: the first two tests fail on the old implementation
 * (March 1-20 would return "۱۴۰۵" for the wrong year, and the pre-fix
 * Intl-only variant would return Latin "1405"/"1404").
 *
 * Timezone note: the assertions use LOCAL-time constructors
 * (`new Date(2026, 2, 21)` etc.) rather than UTC date strings because
 * `Intl.DateTimeFormat` formats in the machine's local timezone. On this
 * machine (Asia/Tehran, UTC+03:30) a UTC date like `2026-03-20T23:59:59Z`
 * would shift into 21 March local time and produce the wrong year.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { jalaliYear } from "../src/data/site.ts";
import { AUDIT_STATIONS, AUDIT_STEPS } from "../src/data/audit.ts";

test("jalaliYear: Nowruz boundary (2026-03-21 onward is ۱۴۰۵)", () => {
  assert.equal(jalaliYear(new Date(2026, 2, 21)), "۱۴۰۵");
  assert.equal(jalaliYear(new Date(2026, 2, 31)), "۱۴۰۵");
});

test("jalaliYear: March 1-20 is still the previous year (۱۴۰۴)", () => {
  assert.equal(jalaliYear(new Date(2026, 2, 1)), "۱۴۰۴");
  assert.equal(jalaliYear(new Date(2026, 2, 20, 23, 59, 59)), "۱۴۰۴");
});

test("jalaliYear: early year and year end", () => {
  assert.equal(jalaliYear(new Date(2026, 0, 1)), "۱۴۰۴");
  assert.equal(jalaliYear(new Date(2026, 11, 31)), "۱۴۰۵");
  assert.equal(jalaliYear(new Date(2027, 2, 20)), "۱۴۰۵");
});

test("jalaliYear resolves the date in Asia/Tehran", () => {
  // 2026-03-20T22:30:00Z is 2026-03-21T02:00 in Tehran → Jalali year must be 1405.
  // Proves the function is timezone-pinned, not host-dependent.
  assert.equal(jalaliYear(new Date("2026-03-20T22:30:00Z")), "۱۴۰۵");
  // Same instant 6 hours earlier is still March 20 in Tehran → 1404
  assert.equal(jalaliYear(new Date("2026-03-20T18:00:00Z")), "۱۴۰۴");
});

test("audit stations are derived from audit steps (ids + labels)", () => {
  assert.equal(AUDIT_STATIONS.length, AUDIT_STEPS.length);
  for (const step of AUDIT_STEPS) {
    const station = AUDIT_STATIONS.find((s) => s.id === step.id);
    assert.ok(station, `missing station for step ${step.id}`);
    assert.equal(station.label, step.label);
  }
  assert.equal(
    new Set(AUDIT_STATIONS.map((s) => s.id)).size,
    AUDIT_STATIONS.length,
    "station ids must be unique",
  );
});
