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

test("canonical gate builds the project before running the test suite", () => {
  const verify = fs.readFileSync(path.join(root, "scripts", "verify.sh"), "utf8");
  const lines = verify.split("\n");
  const buildLine = lines.findIndex((line) => line.includes("run build"));
  const testLine = lines.findIndex((line) => line.includes('run_node_script "test"'));
  assert.notEqual(buildLine, -1, "verify.sh must build the project (npm/pnpm run build)");
  assert.notEqual(testLine, -1, "verify.sh must run the project test suite");
  assert.ok(buildLine < testLine, "verify.sh must build before testing: structural tests need a fresh dist/");
});

test("verify.sh must not re-run the full ci script after building", () => {
  const verify = fs.readFileSync(path.join(root, "scripts", "verify.sh"), "utf8");
  assert.ok(
    !/npm run ci/.test(verify),
    "verify.sh must not re-run `npm run ci` (check+build+test) — the build already happened above",
  );
  const lines = verify.split("\n");
  const contractLine = lines.findIndex((l) => l.includes("scripts/project-verify.sh"));
  const checkLine = lines.findIndex((l) => l.includes('run_node_script "check"'));
  assert.notEqual(contractLine, -1, "verify.sh must run the project contract");
  assert.notEqual(checkLine, -1, "verify.sh must run npm run check");
  assert.ok(contractLine < checkLine, "the project contract must run before the typecheck");
});
