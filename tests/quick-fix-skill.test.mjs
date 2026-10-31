import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const skillPath = path.join(root, ".dsh/skills/quick-fix/SKILL.md");

test("quick-fix has valid DSH skill metadata", async () => {
  const source = await readFile(skillPath, "utf8");
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const description = frontmatter.match(/^description:\s*"?(.+?)"?\s*$/m)?.[1] ?? "";

  assert.match(frontmatter, /^name: quick-fix$/m);
  assert(description.length > 80 && description.length <= 500);
  assert.match(frontmatter, /^whenToUse: .+$/m);
});

test("quick-fix stays low-ceremony and escalates risky or expanding work", async () => {
  const source = await readFile(skillPath, "utf8");

  assert.match(source, /No acceptance matrix, plan, todo list, or subagent\./);
  assert.match(source, /Do not run broad suites or the full gate unless project policy requires it\./);
  assert.match(source, /run `git diff --check`/);
  assert.match(source, /Escalate to `\/build`/);
  assert.match(source, /`scripts\/deliver-pr\.mjs`/);
  for (const boundary of ["security", "auth/access", "money", "dependencies", "public APIs", "deployment"]) {
    assert(source.includes(boundary), `quick-fix escalation omits ${boundary}`);
  }
});

test("the DSH workflow advertises the quick-fix route", async () => {
  const files = ["AGENTS.md", "README.md", "docs/WORKFLOW.md"];
  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    assert(source.includes("/quick-fix"), file);
  }
});
