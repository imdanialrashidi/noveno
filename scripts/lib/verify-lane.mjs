#!/usr/bin/env node
/**
 * Verification lane — the deep module behind the gate seam.
 *
 * One interface declares the ordered gate: an array of lane stages, each
 * with a name and a runner. scripts/verify.sh stays a thin caller over
 * this lane definition; the order lives here, not in a test that pins
 * shell line numbers. Structural stages (build → dist assertions) keep
 * their artifact relationship declared beside them.
 *
 * Usage: node scripts/lib/verify-lane.mjs [--list]
 *   --list  print the lane order without running anything (for the shell
 *           caller and for gate-order tests).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

export const LANE = [
  { name: "template", run: () => run1("template self-checks", ["bash", "scripts/verify-template.sh"]) },
  { name: "secrets", run: () => run1("secret scan", ["bash", "scripts/verify-secrets.sh"]) },
  { name: "build", run: () => run1("build (fresh dist/ for structural tests)", ["npm", "run", "build"]) },
  { name: "contract", run: () => run1("project contract", ["node", "scripts/check-project-contract.mjs"]) },
  { name: "check", run: () => run1("typecheck", ["npm", "run", "check"]) },
  { name: "test", run: () => run1("test suite (asserts fresh dist/)", ["npm", "run", "test"]) },
];

function run1(label, [cmd, ...args]) {
  console.log(`\n=== lane: ${label} ===`);
  execFileSync(cmd, args, { stdio: "inherit" });
}

export function laneOrder() {
  return LANE.map((s) => s.name);
}

const invoked = process.argv[1] ? process.argv[1] : null;
if (invoked && import.meta.url.endsWith(encodeURI(invoked.split("/").pop() ?? ""))) {
  if (process.argv.includes("--list")) {
    console.log(laneOrder().join("\n"));
  } else if (existsSync("package.json")) {
    for (const stage of LANE) stage.run();
  }
}
