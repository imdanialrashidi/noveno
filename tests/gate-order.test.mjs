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

test("canonical gate builds the project before running the test suite", async () => {
  const { laneOrder } = await import("../scripts/lib/verify-lane.mjs");
  const order = laneOrder();
  const buildIndex = order.indexOf("build");
  const testIndex = order.indexOf("test");
  assert.notEqual(buildIndex, -1, "lane must declare a build stage");
  assert.notEqual(testIndex, -1, "lane must declare a test stage");
  assert.ok(buildIndex < testIndex, "lane must build before testing: structural tests need a fresh dist/");
});

test("verify.sh is a thin caller over the lane (order lives in one module)", () => {
  const verify = fs.readFileSync(path.join(root, "scripts", "verify.sh"), "utf8");
  assert.ok(
    verify.includes("verify-lane.mjs"),
    "verify.sh must reference the lane module that declares the order",
  );
  assert.ok(!verify.includes("run_node_script"), "verify.sh must not carry the old runner name anymore");
});

test("verify.sh must not re-run the full ci script after building", () => {
  const verify = fs.readFileSync(path.join(root, "scripts", "verify.sh"), "utf8");
  assert.ok(
    !/npm run ci/.test(verify),
    "verify.sh must not re-run `npm run ci` (check+build+test) — the build already happened above",
  );
  const lines = verify.split("\n");
  const contractLine = lines.findIndex((l) => l.includes("scripts/project-verify.sh"));
  const checkLine = lines.findIndex((l) => l.includes('run_lane_script "check"'));
  assert.notEqual(contractLine, -1, "verify.sh must run the project contract");
  assert.notEqual(checkLine, -1, "verify.sh must run the typecheck stage");
  assert.ok(contractLine < checkLine, "the project contract must run before the typecheck");
});
