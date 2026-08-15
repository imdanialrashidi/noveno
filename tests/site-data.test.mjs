/**
 * Jalali-year regression for src/data/site.ts (plan 007).
 *
 * The old `jalaliYear` used a hand-rolled month approximation
 * (`getMonth() + 1 >= 3`) that treated the whole month of March as the
 * new year — wrong for March 1-20, when the correct Jalali year is still
 * the previous one (the Nowruz cutover is 21 March). The fix delegates to
 * `Intl.DateTimeFormat("fa-IR-u-nu-latn", ...)`, which computes the year
 * from CLDR data.
 *
 * Defect sensitivity: the first two tests fail on the old implementation
 * (March 1-20 would return "1405" instead of "1404").
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

test("jalaliYear: Nowruz boundary (2026-03-21 onward is 1405)", () => {
  assert.equal(jalaliYear(new Date(2026, 2, 21)), "1405");
  assert.equal(jalaliYear(new Date(2026, 2, 31)), "1405");
});

test("jalaliYear: March 1-20 is still the previous year (1404)", () => {
  assert.equal(jalaliYear(new Date(2026, 2, 1)), "1404");
  assert.equal(jalaliYear(new Date(2026, 2, 20, 23, 59, 59)), "1404");
});

test("jalaliYear: early year and year end", () => {
  assert.equal(jalaliYear(new Date(2026, 0, 1)), "1404");
  assert.equal(jalaliYear(new Date(2026, 11, 31)), "1405");
  assert.equal(jalaliYear(new Date(2027, 2, 20)), "1405");
});
