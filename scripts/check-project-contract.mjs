#!/usr/bin/env node

// Project contract checker: proves this repository is the Noveno production
// website project (not the generic template) and that the durable bootstrap
// documents stay Noveno-specific and free of template placeholders.
//
// Run directly:            node scripts/check-project-contract.mjs
// With explicit root:      node scripts/check-project-contract.mjs --root <dir>
// As a module (for tests): import { checkProjectContract } from this file.

import fs from "node:fs";
import path from "node:path";

const SOURCE_DOCS = ["docs/Noveno_Website_Master_Spec.md", "docs/Noveno Business DNA.md"];

// Per-document identity requirements and template-placeholder forbiddens.
// Keep markers durable: they must survive legitimate design and planning edits.
const DOC_CONTRACTS = {
  "docs/PRODUCT.md": {
    require: ["Noveno", "Persian", "RTL", "audit", "qualified audit requests"],
    forbid: [
      /^- Primary users:\s*$/m,
      /^- Measurable outcome:\s*$/m,
      /^- Must-have user flows\s*$/m,
      /Hero headline selection between the two approved candidates/,
      /Persian font choice[^\n]*deferred to [`\/]?design/,
    ],
  },
  "docs/ARCHITECTURE.md": {
    require: ["Astro", "TypeScript", "Cloudflare Pages", "Web3Forms", "static"],
    forbid: [/^- Runtime\/platform:\s*$/m, /^- Main modules:\s*$/m],
  },
  "docs/PLAN.md": {
    require: ["Noveno", "audit"],
    forbid: [/^- Product outcome:\s*$/m, /^- Measurable success:\s*$/m],
  },
  "docs/DESIGN.md": {
    // Accepted theme anchors (bootstrap override): light primary + dark primary.
    require: ["#679e86", "#619881", "Persian", "RTL"],
    forbid: [/Replace template prompts with accepted decisions/],
  },
  "docs/QUALITY.md": {
    require: ["Noveno", "RTL", "WCAG 2.2 AA"],
    forbid: [/`\/bootstrap` should replace this paragraph/],
  },
  "README.md": {
    require: [
      "Noveno",
      // Directory-map accuracy spot checks (full equality is too brittle):
      "components/brand/",
      "motion.ts",
      "work-filter.ts",
      "data/blog.ts",
    ],
    forbid: [
      /Pi Production Workflow Template/,
      // Pre-2026-10 brand pass contract, inverted vs tests/structural.test.mjs
      /AVIF preload \+ eager hero/,
    ],
  },
};

// Actual asset files present in branding_assests/ (bootstrap delivery names).
// Logo SVG variants + website SVGs + PNG marks: one file per expected asset type.
const BRANDING_ASSETS = [
  "branding_assests/Noveno_Logo_SVG_Outline.svg",
  "branding_assests/Noveno_Logo_SVG_Transprent_background.svg",
  "branding_assests/Logo_Website_SVG.svg",
  "branding_assests/Logo_Wesbsite_SVG_v2.svg",
  "branding_assests/logo_only_outline.svg",
  "branding_assests/n_png_rawpng_Transprent_background.png",
  "branding_assests/noveno_logo_png_raw.png",
  "branding_assests/Logo_Social_Media.png",
];

function readText(root, relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function checkDocContract(root, relative, contract) {
  const errors = [];
  let content;
  try {
    content = readText(root, relative);
  } catch {
    return [`${relative}: missing`];
  }
  for (const marker of contract.require) {
    if (!content.includes(marker)) {
      errors.push(`${relative}: missing required marker "${marker}"`);
    }
  }
  for (const pattern of contract.forbid) {
    if (pattern.test(content)) {
      errors.push(`${relative}: contains template placeholder (${pattern})`);
    }
  }
  return errors;
}

function checkSpecRouteHistory(root, relative) {
  const text = readText(root, relative);
  const offenders = text
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => line.includes("/insights"))
    .filter(({ line }) => !/(renamed|DESIGN §16|301)/.test(line));
  return offenders.map(({ n }) => `${relative}:${n} mentions /insights without the rename annotation`);
}

function checkEnvExample(root) {
  const errors = [];
  let content;
  try {
    content = readText(root, ".env.example");
  } catch {
    return [".env.example: missing"];
  }
  const lines = content.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) {
      errors.push(`.env.example:${index + 1}: not a NAME=value line`);
      continue;
    }
    const [key, value] = [match[1], match[2]];
    if (value !== "" && !/^(development|test|staging|production|local)$/.test(value)) {
      errors.push(`.env.example:${index + 1}: ${key} has a real-looking value`);
    }
    if (/(API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE)/i.test(key) && value !== "") {
      errors.push(`.env.example:${index + 1}: ${key} must not carry a value`);
    }
  }
  return errors;
}

// DSH workflow structure: project skills live in .dsh/skills with valid
// discovery frontmatter, the execution model and delivery helper exist, and
// no legacy omp or Pi workflow paths remain.
const DSH_CORE_SKILLS = ["quick-fix", "spec", "build", "verify", "review", "test-design", "ship"];

function checkDshWorkflow(root) {
  const errors = [];
  const skillRoot = path.join(root, ".dsh", "skills");
  let skills;
  try {
    skills = fs.readdirSync(skillRoot, { withFileTypes: true });
  } catch {
    return [".dsh/skills: missing"];
  }

  const discovered = new Set();
  for (const entry of skills) {
    if (!entry.isDirectory()) continue;
    const skill = entry.name;
    discovered.add(skill);
    const relative = `.dsh/skills/${skill}/SKILL.md`;
    let content;
    try {
      content = readText(root, relative);
    } catch {
      errors.push(`${relative}: missing`);
      continue;
    }
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatter) {
      errors.push(`${relative}: missing YAML frontmatter`);
      continue;
    }
    const name = frontmatter[1].match(/^name:\s*"?([a-z0-9-]+)"?\s*$/m)?.[1];
    if (name !== skill) {
      errors.push(`${relative}: frontmatter name must match the directory`);
    }
    if (!/^description:\s*\S/m.test(frontmatter[1])) {
      errors.push(`${relative}: missing frontmatter description`);
    }
    if (content.slice(frontmatter[0].length).trim().length === 0) {
      errors.push(`${relative}: empty skill body`);
    }
  }
  for (const skill of DSH_CORE_SKILLS) {
    if (!discovered.has(skill)) errors.push(`.dsh/skills/${skill}: missing core workflow skill`);
  }

  try {
    if (readText(root, "docs/WORKFLOW.md").trim().length === 0) {
      errors.push("docs/WORKFLOW.md: empty");
    }
  } catch {
    errors.push("docs/WORKFLOW.md: missing");
  }

  try {
    readText(root, "scripts/deliver-pr.mjs");
  } catch {
    errors.push("scripts/deliver-pr.mjs: missing");
  }

  for (const relative of [".omp", ".pi", "scripts/omp-pr.mjs", "scripts/ai-pr.mjs", "Dockerfile.pi", "p"]) {
    try {
      fs.statSync(path.join(root, relative));
      errors.push(`${relative}: legacy workflow path must be removed`);
    } catch {
      // Absent is the expected state.
    }
  }
  return errors;
}

function checkBranding(root) {
  const errors = [];
  for (const relative of BRANDING_ASSETS) {
    const absolute = path.join(root, relative);
    let stat;
    try {
      stat = fs.statSync(absolute);
    } catch {
      errors.push(`${relative}: missing`);
      continue;
    }
    if (stat.size === 0) errors.push(`${relative}: empty`);
  }
  return errors;
}

export function checkProjectContract(root) {
  const errors = [];
  for (const relative of SOURCE_DOCS) {
    try {
      const content = readText(root, relative);
      if (content.trim().length === 0) errors.push(`${relative}: empty`);
    } catch {
      errors.push(`${relative}: missing`);
    }
  }
  for (const [relative, contract] of Object.entries(DOC_CONTRACTS)) {
    errors.push(...checkDocContract(root, relative, contract));
  }
  errors.push(...checkSpecRouteHistory(root, "docs/Noveno_Website_Master_Spec.md"));
  errors.push(...checkEnvExample(root));
  errors.push(...checkDshWorkflow(root));
  errors.push(...checkBranding(root));
  return errors;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === path.resolve(import.meta.filename)) {
  const args = process.argv.slice(2);
  let root = path.resolve(import.meta.dirname, "..");
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--root") root = path.resolve(args[++index]);
    else {
      process.stderr.write(`Unknown argument: ${args[index]}\n`);
      process.exitCode = 2;
      process.exit();
    }
  }
  const errors = checkProjectContract(root);
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`FAIL  ${error}\n`);
    process.stderr.write(`\n${errors.length} project contract violation(s).\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      "Project contract passed: repository is identified as the Noveno production website.\n",
    );
  }
}
