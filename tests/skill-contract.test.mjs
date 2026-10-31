import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import {
  domainSkills,
  loadSkillEvalManifest,
  validateSkillEvalManifest,
} from "../scripts/validate-skill-evals.mjs";

const root = path.resolve(import.meta.dirname, "..");
const skillRoot = path.join(root, ".dsh/skills");

test("every project skill has DSH-compatible discovery frontmatter", () => {
  const allowed = new Set([
    "name",
    "description",
    "whenToUse",
    "metadata",
    "disable-model-invocation",
    "user-invocable",
  ]);
  for (const entry of fs.readdirSync(skillRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = fs.readFileSync(path.join(skillRoot, entry.name, "SKILL.md"), "utf8");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert(match, `${entry.name} is missing YAML frontmatter`);

    const meta = parseYaml(match[1]);
    assert.equal(meta.name, entry.name, `${entry.name} frontmatter name must match its directory`);
    assert.match(meta.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${entry.name} is not kebab-case`);
    assert.equal(typeof meta.description, "string", `${entry.name} needs a description`);
    assert(
      meta.description.length > 0 && meta.description.length <= 500,
      `${entry.name} description must fit the DSH catalog cap`,
    );
    if (meta.whenToUse !== undefined) {
      assert.equal(typeof meta.whenToUse, "string", `${entry.name} whenToUse must be a string`);
    }
    for (const key of Object.keys(meta)) {
      assert(allowed.has(key), `${entry.name} has unsupported frontmatter key: ${key}`);
    }
    assert(source.slice(match[0].length).trim().length > 0, `${entry.name} has an empty body`);
  }
});

test("domain skills are discoverable, bounded, and distinct from native wrappers", () => {
  assert.deepEqual(domainSkills, ["accessibility-audit", "web-performance", "technical-seo", "rtl-i18n"]);
  for (const name of domainSkills) {
    const source = fs.readFileSync(path.join(skillRoot, name, "SKILL.md"), "utf8");
    assert.match(source, new RegExp(`^---\\nname: ${name}\\n`));
    assert.match(source, /\ndescription: .+\n/);
    assert(source.split(/\r?\n/).length < 180, `${name} should remain cheap to load`);
    assert.match(
      source,
      /do(?:es)?\s+not\s+(?:install|add) (?:a |an |the )?/i,
      `${name} lacks a duplicate-tool boundary`,
    );
    for (const status of ["PASS", "FAIL", "UNPROVEN", "BLOCKED"])
      assert(source.includes(status), `${name} lacks ${status} evidence vocabulary`);
  }
});

test("skill routing fixtures have positive and negative controls for every domain skill", () => {
  const result = validateSkillEvalManifest(loadSkillEvalManifest());
  assert.equal(result.cases, domainSkills.length * 5);
  for (const skill of domainSkills) {
    assert.equal(result.counts[skill].positive, 3);
    assert.equal(result.counts[skill].negative, 2);
  }
});

test("domain skills preserve native capability boundaries", () => {
  const manifest = loadSkillEvalManifest();
  for (const item of manifest.cases.filter((candidate) => !candidate.shouldTrigger)) {
    assert(!item.prompt.includes(`$${item.skill}`), `Negative control explicitly invokes ${item.skill}`);
  }
  for (const skill of domainSkills) {
    assert.equal(
      manifest.cases.filter((item) => item.prompt.includes(`$${skill}`)).length,
      1,
      `${skill} needs one explicit invocation case`,
    );
  }
});
