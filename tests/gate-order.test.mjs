// Gate ordering contract (regression: PR #1 clean-checkout CI failures,
// 2026-08-11). Structural tests assert production output under dist/
// (built HTML, compiled theme tokens, JS budget, links, no source maps,
// no secrets). Every canonical verification path must therefore produce a
// build BEFORE the test suite runs; running tests first fails on a clean
// checkout where no dist/ exists and can silently pass against stale
// local build output. These assertions fail on the pre-fix ordering and
// pin the contract so a future clean-checkout run cannot silently
// reintroduce the same assumption.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("package ci script builds before it tests", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const ci = pkg.scripts && pkg.scripts.ci;
  assert.ok(ci, "package.json must define a ci script");
  const buildIndex = ci.indexOf("npm run build");
  const testIndex = ci.indexOf("npm run test");
  assert.notEqual(buildIndex, -1, "ci script must run the build");
  assert.notEqual(testIndex, -1, "ci script must run the tests");
  assert.ok(
    buildIndex < testIndex,
    "ci script must build before testing (structural tests assert built output under dist/)",
  );
});

test("canonical gate builds the project before running the workflow test suite", () => {
  const verify = fs.readFileSync(path.join(root, "scripts", "verify.sh"), "utf8");
  const lines = verify.split("\n");
  const buildLine = lines.findIndex((line) => line.includes("run build"));
  const doctorLine = lines.findIndex((line) => line.includes("pi-doctor.sh"));
  assert.notEqual(buildLine, -1, "verify.sh must build the project (npm/pnpm run build)");
  assert.notEqual(doctorLine, -1, "verify.sh must run pi-doctor");
  assert.ok(
    buildLine < doctorLine,
    "verify.sh must build before pi-doctor: pi-doctor --ci runs the workflow test suite, and structural tests need dist/",
  );
});

test("verify.sh must not re-run the full ci script after pi-doctor", () => {
  const verify = fs.readFileSync(path.join(root, "scripts", "verify.sh"), "utf8");
  assert.ok(
    !/npm run ci/.test(verify),
    "verify.sh must not re-run `npm run ci` (check+build+test) — pi-doctor already ran the suite and the build happened above",
  );
  const lines = verify.split("\n");
  const doctorLine = lines.findIndex((l) => l.includes("pi-doctor.sh"));
  const checkLine = lines.findIndex(
    (l) => l.includes('run_node_script "check"') || l.includes("npm run check"),
  );
  assert.notEqual(checkLine, -1, "verify.sh must run npm run check");
  assert.ok(doctorLine < checkLine, "the check must come after the doctor suite");
});
