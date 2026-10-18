/**
 * Verification lane (candidate 8): order is declared in
 * scripts/lib/verify-lane.mjs — the shell stays a thin caller and the
 * build→test artifact relationship is pinned to the module, not to shell
 * line numbers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { LANE, laneOrder } from "../scripts/lib/verify-lane.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("lane declares the full gate order (template → secrets → build → contract → check → test)", () => {
  assert.deepEqual(laneOrder(), ["template", "secrets", "build", "contract", "check", "test"]);
});

test("build precedes test in the lane (structural tests need fresh dist/)", () => {
  const order = laneOrder();
  assert.ok(order.indexOf("build") < order.indexOf("test"));
});

test("contract precedes check in the lane (fast static gate first)", () => {
  const order = laneOrder();
  assert.ok(order.indexOf("contract") < order.indexOf("check"));
});

test("every lane stage has a name and a runner", () => {
  for (const stage of LANE) {
    assert.ok(typeof stage.name === "string" && stage.name.length > 0);
    assert.equal(typeof stage.run, "function");
  }
});

test("verify.sh follows the lane order (thin caller)", () => {
  const verify = fs.readFileSync(path.join(root, "scripts", "verify.sh"), "utf8");
  const order = laneOrder();
  let cursor = -1;
  for (const name of ["template", "secrets", "build", "contract"]) {
    const marker =
      name === "template"
        ? "verify-template.sh"
        : name === "secrets"
          ? "verify-secrets.sh"
          : name === "build"
            ? "run build"
            : "project-verify.sh";
    const idx = verify.indexOf(marker);
    assert.notEqual(idx, -1, `verify.sh must contain the ${name} stage`);
    assert.ok(idx > cursor, `verify.sh stages out of lane order at ${name}`);
    cursor = idx;
  }
});
