// Contract tests for scripts/check-project-contract.mjs.
//
// Defect sensitivity: the checker must fail (red) when a bootstrap document
// reverts to the template placeholder, loses a Noveno identity marker,
// carries a real value in .env.example, breaks the omp workflow structure,
// or reintroduces legacy Pi workflow remnants — and pass (green) on the
// real migrated tree. Fixtures are hermetic copies under a temp directory
// so the tests never mutate repository files.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { checkProjectContract } from "../scripts/check-project-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "noveno-contract-"));

const TEMPLATE_PRODUCT_MD = `# Product Contract

Keep this document short.

- Primary users:
- Measurable outcome:
- Must-have user flows
1.
2.
3.
`;

function buildFixture() {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(fixtureRoot, "docs"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "branding_assests"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, ".omp"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "scripts"), { recursive: true });

  fs.cpSync(path.join(repositoryRoot, "docs"), path.join(fixtureRoot, "docs"), { recursive: true });
  fs.copyFileSync(path.join(repositoryRoot, ".env.example"), path.join(fixtureRoot, ".env.example"));
  fs.copyFileSync(path.join(repositoryRoot, "README.md"), path.join(fixtureRoot, "README.md"));
  fs.cpSync(path.join(repositoryRoot, ".omp"), path.join(fixtureRoot, ".omp"), { recursive: true });
  fs.copyFileSync(
    path.join(repositoryRoot, "scripts", "omp-pr.mjs"),
    path.join(fixtureRoot, "scripts", "omp-pr.mjs"),
  );
  // Mirror the actual asset files in branding_assests/ (see check-project-contract.mjs).
  const assetFiles = [
    "Noveno_Logo_SVG_Outline.svg",
    "Noveno_Logo_SVG_Transprent_background.svg",
    "Logo_Website_SVG.svg",
    "Logo_Wesbsite_SVG_v2.svg",
    "logo_only_outline.svg",
    "n_png_rawpng_Transprent_background.png",
    "noveno_logo_png_raw.png",
    "Logo_Social_Media.png",
  ];
  for (const name of assetFiles) {
    const content = name.endsWith(".png")
      ? "dummy-png-bytes"
      : '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>';
    fs.writeFileSync(path.join(fixtureRoot, "branding_assests", name), content);
  }
}

function writeFixtureFile(relative, content) {
  fs.writeFileSync(path.join(fixtureRoot, relative), content);
}

before(() => buildFixture());
after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

test("green: the real bootstrap tree satisfies the project contract", () => {
  assert.deepEqual(checkProjectContract(fixtureRoot), []);
});

test("green: the checker CLI exits 0 on the real bootstrap tree", () => {
  const checker = path.join(repositoryRoot, "scripts", "check-project-contract.mjs");
  const output = execFileSync(process.execPath, [checker, "--root", fixtureRoot], {
    encoding: "utf8",
  });
  assert.match(output, /Project contract passed/);
});

test("red: a template-reverted PRODUCT.md is rejected", () => {
  writeFixtureFile("docs/PRODUCT.md", TEMPLATE_PRODUCT_MD);
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((error) => error.includes("docs/PRODUCT.md") && error.includes("template placeholder")),
    `expected template-placeholder failure, got: ${JSON.stringify(errors)}`,
  );
  assert.ok(
    errors.some((error) => error.includes('docs/PRODUCT.md: missing required marker "Noveno"')),
    `expected missing-marker failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});

test("red: a contract doc losing an identity marker is rejected", () => {
  const design = fs.readFileSync(path.join(fixtureRoot, "docs", "DESIGN.md"), "utf8");
  writeFixtureFile("docs/DESIGN.md", design.replaceAll("#679e86", "#679e87"));
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((error) => error.includes('docs/DESIGN.md: missing required marker "#679e86"')),
    `expected missing theme-anchor failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});

test("red: .env.example carrying a real-looking value is rejected", () => {
  writeFixtureFile(".env.example", "PUBLIC_APP_URL=https://noveno.example.com\n");
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((error) => error.includes(".env.example:1") && error.includes("PUBLIC_APP_URL")),
    `expected env-value failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});

test("red: an omp command with missing description is rejected", () => {
  const ship = fs.readFileSync(path.join(fixtureRoot, ".omp", "commands", "ship.md"), "utf8");
  assert.match(ship, /^description: .+/m);
  writeFixtureFile(".omp/commands/ship.md", ship.replace("description:", "x-description:"));
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((error) => error.includes(".omp/commands/ship.md") && error.includes("description")),
    `expected missing-description failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});

test("red: legacy Pi workflow remnants are rejected", () => {
  fs.mkdirSync(path.join(fixtureRoot, ".pi"), { recursive: true });
  writeFixtureFile(".pi/verification.json", "{}");
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((error) => error.includes(".pi") && error.includes("legacy Pi workflow")),
    `expected legacy-remnant failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});

test("red: README with forbidden AVIF preload + eager hero is rejected", () => {
  const readme = fs.readFileSync(path.join(fixtureRoot, "README.md"), "utf8");
  writeFixtureFile("README.md", readme + "\nAVIF preload + eager hero\n");
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((e) => e.includes("README.md") && e.includes("AVIF preload")),
    `expected README forbid failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});

test("red: README missing required map markers is rejected", () => {
  let readme = fs.readFileSync(path.join(fixtureRoot, "README.md"), "utf8");
  readme = readme.replaceAll("components/brand/", "components/band/");
  writeFixtureFile("README.md", readme);
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((e) => e.includes('missing required marker "components/brand/"')),
    `expected missing marker failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});

test("red: spec with unannotated /insights is rejected (route history)", () => {
  const spec = fs.readFileSync(path.join(fixtureRoot, "docs", "Noveno_Website_Master_Spec.md"), "utf8");
  writeFixtureFile("docs/Noveno_Website_Master_Spec.md", spec + "\n/insights-unannotated\n");
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((e) => e.includes("mentions /insights without the rename annotation")),
    `expected route-history failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});

test("red: PRODUCT reintroducing settled decisions is rejected", () => {
  const product = fs.readFileSync(path.join(fixtureRoot, "docs", "PRODUCT.md"), "utf8");
  writeFixtureFile(
    "docs/PRODUCT.md",
    product + "\nHero headline selection between the two approved candidates\n",
  );
  const errors = checkProjectContract(fixtureRoot);
  assert.ok(
    errors.some((e) => e.includes("Hero headline selection")),
    `expected PRODUCT forbid failure, got: ${JSON.stringify(errors)}`,
  );
  buildFixture();
});
