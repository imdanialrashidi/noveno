import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { evaluateDeterministic, runCaseChecks } from "../scripts/lib/workflow-evals.mjs";

const root = path.resolve(import.meta.dirname, "..");
const cases = JSON.parse(fs.readFileSync(path.join(root, "evals/cases.json"), "utf8")).cases;
const grade = (item, files, checkResults) =>
  evaluateDeterministic(item, {
    completion: "completed",
    changes: files.map((file) => ({ file, status: "modified" })),
    checkResults,
  }).status;

test("copy-edit evaluation accepts the correction but rejects no-op, wrong copy and test scaffolding", () => {
  const item = cases.find((item) => item.id === "copy-edit-without-test-churn");
  const file = "evals/fixtures/test-economy/README.md";
  fs.mkdirSync(path.join(root, ".artifacts"), { recursive: true });
  const workspace = fs.mkdtempSync(path.join(root, ".artifacts/test-economy-"));
  try {
    fs.mkdirSync(path.dirname(path.join(workspace, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(workspace, file));
    assert.equal(grade(item, [], runCaseChecks(workspace, item.checks)), "FAIL");
    fs.writeFileSync(
      path.join(workspace, file),
      "# Receipts\n\nDownload your receipt from the order page.\n",
    );
    const results = runCaseChecks(workspace, item.checks);
    assert.equal(grade(item, [file], results), "PASS");
    assert.equal(grade(item, [file, "tests/receipt-copy.test.mjs"], results), "FAIL");
    fs.writeFileSync(
      path.join(workspace, file),
      "# Receipts\n\nDownload your receipt from the admin page.\n",
    );
    assert.equal(grade(item, [file], runCaseChecks(workspace, item.checks)), "FAIL");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("covered-behavior evaluation accepts existing evidence but rejects duplicate tests", () => {
  const item = cases.find((item) => item.id === "already-covered-behavior");
  const results = runCaseChecks(root, item.checks);
  assert.equal(grade(item, [], results), "PASS");
  assert.equal(grade(item, ["evals/fixtures/tiered-pricing/pricing.test.mjs"], results), "FAIL");
});
