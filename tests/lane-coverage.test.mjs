// Guards against unrouted test suites: every tests/*.test.mjs must appear in
// at least one lane of .pi/verification.json, otherwise affected-file
// verification silently skips regressions (regression: work-filter and
// audit-email-spike escaped routing until 2026-08).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, ".pi", "verification.json"), "utf8"));

test("every test suite is routed in .pi/verification.json", () => {
  const routed = new Set(config.routes.flatMap((r) => r.include));
  const suites = fs.readdirSync(path.join(root, "tests")).filter((f) => f.endsWith(".test.mjs"));
  const orphans = suites.filter((f) => !routed.has(`tests/${f}`));
  assert.deepEqual(orphans, [], "unrouted test suites found");
});
