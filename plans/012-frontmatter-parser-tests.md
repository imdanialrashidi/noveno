# Plan 012: Parse frontmatter with real YAML in the honesty tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- tests/blog.test.mjs tests/content.test.mjs package.json`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: plans/016-sitemap-content-layer.md (already applied — it added the `yaml` dependency to package.json)
- **Category**: tests
- **Planned at**: commit `13ef792`

## Why this matters

`tests/blog.test.mjs` and `tests/content.test.mjs` hand-parse frontmatter
with regex mini-parsers. They cannot represent YAML arrays, quoted values,
or block scalars — `tags:` reads as an opaque single string and quoted
values with colons mis-parse. The authoritative schema is the zod contract
in `src/content.config.ts`; the tests verify a *phantom* parse, so schema
drift (a renamed field, a changed type) can pass the honesty tests while
failing the build, or vice-versa. With the `yaml` dependency now in
`package.json` (added by plan 016), both test files can parse frontmatter
with a real parser, and the honesty assertions operate on the same values
the build sees.

## Current state

- `tests/blog.test.mjs:9-28` — `parseFrontmatter(file)` regex parser
  (line-based `key:\s*value`, strips quotes, no arrays).
- `tests/content.test.mjs:11-70` — a longer regex parser for the work
  collection (handles a few more shapes, still not real YAML).
- `package.json` — after plan 016, `yaml` is a dependency (verify with
  `grep '"yaml"' package.json` before starting; if absent, STOP and report).

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Blog tests | `node --test tests/blog.test.mjs` | all pass |
| Content tests | `node --test tests/content.test.mjs` | all pass |
| Full suite | `npm test`                  | all pass |
| Dep check  | `node -e "console.log(require.resolve('yaml'))"` | resolves (no error) |

## Scope

**In scope**:
- `tests/blog.test.mjs`
- `tests/content.test.mjs`

**Out of scope** (do NOT touch):
- `scripts/validate-og-assets.mjs` and `scripts/generate-sitemap.mjs` (plan 016 owns the sitemap generator; the OG validator keeps its own parser — its fields are simple scalars and it is separately gated)
- `src/content.config.ts`, `src/content/**`
- Any other file.

## Git workflow

- Commit once at the end:
  `test: parse frontmatter with real YAML in content honesty tests`
- Do NOT push or open a PR.

## Steps

### Step 1: Replace the blog-test parser

In `tests/blog.test.mjs`, replace the `parseFrontmatter` function body with:

```js
import YAML from "yaml";

function parseFrontmatter(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  assert.ok(match, `${file}: missing frontmatter`);
  const data = YAML.parse(match[1]);
  assert.ok(data && typeof data === "object", `${file}: frontmatter is not a YAML mapping`);
  return data;
}
```

Keep every downstream assertion unchanged. Watch for behavior differences:
the old parser returned `"true"`/`"false"` strings for booleans only when the
value was literally `true`/`false`; YAML returns real booleans — assertions
like `assert.equal(e.draft, true)` keep working (real `true === true`), and
assertions comparing against `"true"` strings would break — grep the file
for such comparisons and update them to real booleans if found.

**Verify**: `node --test tests/blog.test.mjs` → all pass (including the
draft fixture and the honesty heuristics).

### Step 2: Replace the content-test parser

In `tests/content.test.mjs`, do the same: import YAML, parse the frontmatter
block with `YAML.parse`, keep the honesty assertions (metrics require
`verified` + `source`, concepts never carry metrics, projects carry an
honest `outcome`). The old parser handled arrays (the content tests read
`metrics` arrays) — real YAML handles them naturally. Check for
string-vs-boolean comparisons here too and fix them.

**Verify**: `node --test tests/content.test.mjs` → all pass.

### Step 3: Prove defect sensitivity with a fixture probe

Add ONE small test to `tests/blog.test.mjs` proving the parser is now real
YAML (this test FAILS with the old regex parser — defect sensitivity):

```js
test("frontmatter parser handles YAML arrays and quoted colons", () => {
  const dir = path.join(contentDir); // reuse the existing contentDir const
  // parse a synthetic string through the same function by writing a temp
  // file in a temp dir (fs.mkdtempSync), then deleting it in finally.
  const yaml = "---\ntitle: \"A: quoted title\"\ntags:\n  - one\n  - two\n---\n";
  // ... assert parsed.tags deep-equals ["one","two"] and
  // parsed.title === "A: quoted title"
});
```

(The temp file lives under `os.tmpdir()`, never in the repo — use
`fs.mkdtempSync(path.join(os.tmpdir(), "noveno-blog-"))` and clean up.)

**Verify**: `node --test tests/blog.test.mjs` → all pass, including the new probe.

## Test plan

- Steps 1-2: parser swap, assertions preserved.
- Step 3: YAML-capability probe with temp fixture.

## Done criteria

- [ ] `grep -n "YAML.parse" tests/blog.test.mjs tests/content.test.mjs` → both present
- [ ] No regex frontmatter parser remains in either test file
- [ ] `node --test tests/blog.test.mjs && node --test tests/content.test.mjs` → all pass
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- `yaml` is not resolvable (`require.resolve` fails) — the dependency from
  plan 016 is missing; report instead of adding it yourself.
- An honesty assertion depended on the old parser's string/boolean
  coercion in a way that cannot be cleanly updated (report the specific
  assertion).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The zod schema in `src/content.config.ts` remains authoritative; these
  tests now parse the same YAML the build parses, so drift between the
  honesty tests and the schema is visible again.
- `scripts/validate-og-assets.mjs` still has its own mini-parser — if its
  fields ever grow beyond simple scalars, migrate it the same way.
- Reviewer should scrutinize: the temp-fixture test cleans up in `finally`,
  and no assertion silently weakened (compare the diff of each test file
  assertion-by-assertion).
