# Research Basis and Optimization Record

Reviewed: **2026-08-23**. Test-quality amendment reviewed: **2026-08-24**. This record connects current primary evidence to concrete workflow controls. It does not claim that a prompt- or tool-level change improves every model or repository; deterministic tests protect invariants, and repeated matched-model evals remain the promotion standard.

## 2026-10-07 — DeepWiki MCP replaces Context7

Per request, `@upstash/context7-mcp@4.1.2` (stdio, key-optional) is replaced by the official [DeepWiki MCP](https://docs.devin.ai/work-with-devin/deepwiki-mcp): remote streamable HTTP at `https://mcp.deepwiki.com/mcp`, free with no authentication for public repositories. Live `initialize` + `tools/list` on 2026-10-07 returned server `DeepWiki 2.14.3` with public tools `read_wiki_structure` (`repoName`), `read_wiki_contents` (`repoName`), `ask_wiki_question` (`repoName`, `question`) — note the docs page calls it `ask_question`, the wire name is `ask_wiki_question`, and the config pins the wire names. It stays `hidden` with exactly those three `deferred`, loaded via `tool_search` as `mcp__deepwiki__*`; no `harness_tools` docs group, no npm pin or integrity record (remote servers have none), no API key. Tradeoffs vs Context7: DeepWiki answers from a generated wiki index over `owner/repo` (can lag HEAD — local source stays authoritative for bleeding-edge APIs) instead of version-pinned library IDs, and private repos need a Devin account, so they stay out of scope. The docs secret/path guard and the eval contract move to `repoName`/`question` inputs; legacy Context7 names remain guarded and rejected by doctor if re-added.

| Primary source / inspection | Decision | Evidence limit |
|---|---|---|
| [DeepWiki MCP docs](https://docs.devin.ai/work-with-devin/deepwiki-mcp) + live endpoint probe (initialize OK, 3 public tools listed) | Pin the official `https://mcp.deepwiki.com/mcp` URL in `.pi/mcp.json`; reject stale `context7` servers, non-official URLs, stdio commands, and key material in doctor | Private-mode tools advertised in server instructions are not exposed or tested; latency/quota under load remain operator smoke checks |

Validation: 102 deterministic tests pass (incl. retargeted DeepWiki secret/path guard with legacy Context7 coverage, `mcp__deepwiki__*` branch persistence); `pi-doctor --ci --static` passes with the DeepWiki-endpoint checks; `verify-package-integrity` passes offline and `--online` 6/6 (no npm record for remote servers); eval `--dry-run` passes including `docs-deepwiki-workflow`. No paid model trials or cross-model quality gains are claimed.

## 2026-10-07 — Official Context7 MCP, Pi 1.0.4, and hardening fixes

Third-party `@dreki-gg/pi-doc-search@0.3.2` is replaced by official `@upstash/context7-mcp@4.1.2` as a native hidden/deferred MCP server (`resolve-library-id`, `query-docs` via `tool_search`). Docs leaves `harness_tools` and follows the Playwright MCP pattern; legacy `doc_search_*` schemas are cleared on reset/resume, unknown capabilities (e.g. stale `docs`) are ignored without crashing, and `CONTEXT7_API_KEY` is forwarded via `${CONTEXT7_API_KEY}` without entering Git. Tradeoff: no persistent local docs cache, so guidance now requires local-first lookup plus one resolve and one focused single-concept query; tool rename `get_library_docs` → `query-docs` is covered in setup, HARNESS, and the new `docs-mcp-workflow` eval case.

| Primary source / inspection | Decision | Evidence limit |
|---|---|---|
| [@upstash/context7](https://github.com/upstash/context7) README (62k★, MIT), `packages/mcp` tool names (`resolve-library-id`, `query-docs`), live stdio `tools/list` on `4.1.2` | Pin `@upstash/context7-mcp@4.1.2` in `.pi/mcp.json` with `hidden` + two deferred tools, `${CONTEXT7_API_KEY}` env mapping, 60s timeout | Tool catalog and unauthenticated listing verified; authenticated quota and p95 docs latency remain operator smoke checks |
| Pi [MCP docs](https://github.com/earendil-works/pi/blob/v1.0.4/packages/coding-agent/docs/mcp.md) (`mcp__<server>__<tool>` naming, `${VAR}` env substitution, `hidden`/`deferred` + `tool_search`, 408/429/5xx retried twice) | Same native docs pattern as Playwright; document retry/rate-limit behavior and direct `/org/project` IDs | Pi-version-specific behavior re-validated structurally, not by a full upstream audit of every 1.0.x delta |
| Local `safety-guard.js` + Context7 `query-docs` schema (`query`, `libraryId` strings; server warns against sensitive input) | Block secret-like (`KEY=`/`Bearer`/`sk-`/private-key) and sensitive-path (`.env`, `playwright/.auth`, keystores) content in Context7 queries; ordinary questions pass | Pattern guard is defense in depth, not a parser; proprietary-code leakage beyond secret patterns still relies on agent discipline |
| `npm view --json` returning an array for pinned specs | Unwrap array/singleton in `verify-package-integrity.mjs --online` | Offline pin check unchanged; online re-check now passes all 7 records |
| Registry metadata 2026-10-07 | Re-pin reviewed runtime `1.0.0` → `1.0.4` (integrity `sha512-+956n…`), update launcher/README/setup/doctor/theme-schema references | Installed `1.0.4` passes 101 tests, static doctor, and eval dry-run; per-version upstream changelog review 1.0.1–1.0.4 was blocked (raw fetch failed), so this is a structural re-validation, not a line-by-line upstream audit |

Validation: 101 deterministic tests pass (incl. new legacy-`docs` ignore, Context7 secret/path guard, native `mcp__context7__*` branch persistence); `pi-doctor --ci --static` passes with new Context7-MCP and legacy-package checks; `verify-package-integrity --online` passes 7/7 after the array fix; eval `--dry-run` passes 21 cases including `docs-mcp-workflow`. No paid model trials or cross-model quality gains are claimed.

## 2026-10-03 — LSP packaging compatibility

The latest published [pi-lsp-adapter manifest](https://github.com/nikmmd/pi-lsp-adapter/blob/main/package.json) is still `0.1.3`: it incorrectly declares `@earendil-works/pi-tui` and `typebox` as dependencies. Pi [resource loading](https://github.com/earendil-works/pi/blob/v1.0.1/packages/coding-agent/src/core/resource-loader.ts) detects this risk; its [extension loader](https://github.com/earendil-works/pi/blob/v1.0.1/packages/coding-agent/src/core/extensions/loader.ts) supplies host modules through aliases/virtual modules. Changing the reviewed installed manifest to optional wildcard peers follows that contract without replacing LSP or hiding warnings. The source/tarball integrity record remains unchanged. Remove this narrowly versioned workaround when a corrected upstream release is reviewed.

Validation on installed Pi **1.0.1**: all project extensions loaded with zero errors and zero package warnings; CLI RPC returned state and commands with no host-dependency warning. A separate empty-cache project exercised the real native installer, a subsequent package install, clean JSONL output and unchanged project settings. Existing launcher/compatibility checks and the full workflow gate passed (100 tests); seven registry integrity records passed online. The real VTSLS `0.3.0`/TypeScript `6.0.3` server detected deliberate error `TS2322` and returned no diagnostics for valid code through the native Pi tool pipeline; only model responses selecting the audit tools were synthetic. Home-based LSP state was isolated in a disposable fixture.

The LSP smoke check also exposed cold-start latency: the adapter waits only 350 ms, so its first empty diagnostic response is not evidence of a valid file. A later query returned the expected error. Setup guidance now requires rechecking or the project's compiler gate; this packaging fix does not change upstream diagnostic scheduling or claim a performance improvement.

The first GitHub run exposed a launcher-test fixture gap: the fake CLI could not install the newly prepared package, while the local cache masked that missing precondition. Launcher argument tests now copy the launcher/config/helper into their own disposable project with an installed-manifest fixture. They neither depend on nor mutate the checkout's package cache. The real empty-cache installation remains covered by the separate native RPC smoke check.

## 2026-10-01 — Pi 1.0 compatibility review

This amendment supersedes the earlier runtime/MCP package and tool-loading decisions below; those remain an audit history. Reviewed Pi tag `v1.0.0` resolves to `a13d35a742c6ef8462812a28fbe1d8c8b7431c32`. Registry metadata and tarball integrities were checked on this date.

| Primary source | Change and reason |
|---|---|
| Pi [v1.0.0 changelog](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/CHANGELOG.md), [MCP](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/mcp.md), [tool exposure](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/extensions.md#tool-exposure) | Replace `pi-mcp-adapter` with native project MCP. Declare selected browser tools as deferred, hide the rest, and use native `tool_search`. Direct and codemode-nested calls emit the guard hooks; validate actual names/arguments rather than trusting the old proxy contract. |
| Pi [default tools](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/settings.md#tools), [SDK](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/sdk.md) | Use `defaultTools` instead of launcher `--tools`, whose allowlist hides omitted MCP tools from the registry. Keep nine initial schemas, remove three package helpers that actual loading revealed were unintentionally active, and let Pi retain discovered MCP tools on its own branches. Five non-MCP capability groups stay conditional. |
| Pi [CLI](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/cli.md), [theme/events](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/extensions.md) | Preserve leading CLI subcommands, provider/model overrides and native fullscreen default. Do not force experimental setup. Validate slate and elapsed/weighted-output/tool-time/cost metrics against the new loader and event contract. Codemode remains optional: no token-saving claim is made for the default workflow. |
| [Playwright MCP 0.0.83](https://github.com/microsoft/playwright-mcp/releases/tag/v0.0.83), published CLI/schema | Upgrade selected browser tools and retain native image responses. Correct setup guidance: default Chrome is not installed by the generic Chromium install command. Keep server/browser versions compatible. |
| Published [rpiv-todo](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-todo) `2.12.0`, [pi-web-search](https://github.com/ByteTrue/pi-package-mono/tree/main/packages/pi-web-search) `0.5.1` tarballs | Review actual published code and load both in Pi 1.0. Todo retains its native tool/history contract and defers overlay loading. Web search adds guarded redirect/DNS/body handling and preserves legacy config while moving personal settings to the agent directory. Keep sub-agent, LSP and docs at their latest published pins; do not add a new package or skill. |

Validation: 96 deterministic behavior tests, full doctor on installed Pi 1.0.0, eval dry-run and seven online registry integrity records passed. The actual SDK loaded all project extensions and slate, accepted wizard-generated custom models, exposed all five specialist groups, connected the real Playwright MCP catalog, discovered native tools, and enforced the guard on a genuine nested call. CLI RPC `get_state` and `get_commands` also passed without provider requests.

Limits: actual page rendering/screenshot capture was **BLOCKED**. The server reported missing default Chrome, and this environment returned truncated archives when downloading Chromium. No visual result or model-backed quality/latency improvement is claimed. LSP's latest package still emits an upstream warning about host packages declared as dependencies; loading succeeded, but project language-server diagnostics, real delegation, authenticated search/Context7 and live-provider performance remain operator smoke checks. Node engine compatibility is unchanged (`>=22.19.0`); the reviewed existing CI Actions pins are still their latest releases.

## Result in one page

The optimized workflow keeps a small model-neutral core and loads specialization only when the task needs it:

1. **No provider/model/thinking pin.** Pi uses the operator's active selection. Rules route by capability and provide fallbacks when image input, subagents, extended thinking, or a large context window is absent.
2. **Less always-loaded policy.** `AGENTS.md` is the repository map; detailed procedure stays in on-demand docs, prompts, and skills.
3. **Adaptive tool surface.** The launcher starts with eight schemas instead of 19: seven core repository tools plus `harness_tools`. Planning, delegation, browser, LSP, docs, and web groups remain installed and activate additively only when required.
4. **Conditional orchestration.** One primary writer handles normal work. Scout/reviewer/security roles are used only for a named ambiguity or risk; a separate self-review is the universal fallback.
5. **Schema prevention before repair.** On the exact reviewed Pi pin, capability-gated strict-prefer JSON-schema sampling is enabled for supported built-ins, while Pi's existing pre-validation argument preparation and the MCP proxy's object/JSON-string handling remain authoritative. The workflow does not guess-repair schema-invalid calls after validation.
6. **Implementation autonomy, scoped PR delivery.** Owner-adopted policy on 2026-08-26 adds verified commit/push/PR handoff through a fixed `ai-changes` helper. Main integration and other external actions remain owner-controlled. This is a user authority choice, not a claim of improved model quality.
7. **Cheap smoke, rigorous promotion.** Eval defaults to one trial for routine regression feedback; promotion still requires repeated, isolated baseline/candidate trials with identical settings and qualitative review.
8. **Bounded context and recovery.** Implicit large-file reads are focused, a third identical call is stopped after two errors, and only compact mechanical continuity state—not raw tool input/output—is recovered after resume or compaction.

## Primary evidence and resulting decisions

| Primary source | Evidence used | Decision here | Limitation |
|---|---|---|---|
| Pi, [settings](https://pi.dev/docs/latest/settings) | Provider/model/thinking, compaction, retry, and timeout settings are optional; Pi supplies documented defaults. | Remove repository model/thinking pins and unmeasured timeout/compaction overrides. Keep only reproducibility/security controls plus the exact-pin schema-sampling and bounded runtime toggles, all operator-overridable. | A real project may later justify a measured override; it should be evaluated before becoming global policy. |
| Pi, [usage and context files](https://pi.dev/docs/latest/usage) and [compaction](https://pi.dev/docs/latest/compaction) | Project context is loaded into every task; built-in compaction already summarizes goals, state, decisions, next steps, critical context, and files. | Keep `AGENTS.md` plus the system append concise. Recover only complementary mechanical state (recognized checks, hashed open failures, active capabilities), once, instead of replacing the built-in summary. | Exact attention effects vary by model and task; a compact capsule can still be redundant on some turns. |
| Pi, [extensions and dynamic tool loading](https://pi.dev/docs/latest/extensions) | Extensions can inspect the configured tool catalog, change active tools, mutate already-valid calls, patch results, persist custom entries outside LLM context, and inject context. Pi documents a loader pattern that works across models. | Start with eight schemas and use `harness_tools` to activate six named capability groups. Use the read-call/result hooks for deterministic focusing and custom entries for bounded continuity. | Specialist tasks pay one loader call; dynamic selection must be compared against the 19-tool baseline on representative tasks. |
| Pi, [skills](https://pi.dev/docs/latest/skills) | Pi initially exposes skill name/description, loads the full skill only when selected, and registers `/skill:name` commands by default. | Retain focused skills because they do not all consume every turn; add an explicit `/skill:quick-fix` route for tiny changes and keep test, verification, browser, design, and risk contracts distinct. | Poor descriptions can still cause incorrect selection, so trigger and escalation tests remain necessary. |
| Agent Skills, [specification](https://agentskills.io/specification) and [best practices](https://agentskills.io/skill-creation/best-practices) | Progressive disclosure and concise metadata are part of the interoperable skill model. | Use model-neutral, task-specific descriptions and keep procedural depth in skill bodies/references. | Support and selection behavior differ between hosts. |
| Pi, [custom models](https://pi.dev/docs/latest/models) | Pi supports multiple providers/models and project selection can be overridden at launch. | Treat models as replaceable capabilities; never embed a vendor-specific route in workflow policy. | Model-specific quirks can still require a local, measured adapter. |
| Pi, [0.84.2 release notes](https://pi.dev/news) | The reviewed release adds capability-aware strict JSON-schema constrained sampling for built-in `read`, `bash`, `edit`, and `write` under `PI_EXPERIMENTAL=1`, with strict-prefer fallback behavior. | Enable it by default only because the Pi version is exact-pinned; retain `PI_EXPERIMENTAL=0` for matched diagnostics and re-review the flag before upgrading. | The feature is explicitly experimental and provider/model support varies; structural correctness is not evidence of outcome improvement. |
| Google, [function calling](https://ai.google.dev/gemini-api/docs/function-calling) | Google recommends keeping the active tool set small—roughly 10–20 relevant functions—and using clear schemas. | Start below that bound at eight unique schemas; add only task-relevant groups rather than sending all 19 on every request. | The useful count depends on task/tool similarity; this is a design bound, not proof of quality, and loader overhead can outweigh savings. |
| OpenAI, [function calling](https://developers.openai.com/api/docs/guides/function-calling) | Clear purpose, constrained parameters, and minimized model-side argument work improve tool use. | Use an enum-constrained capability loader with strict-prefer sampling, direct core tools, argv-array checks, explicit scope, and one lazy MCP proxy. | Guidance does not replace repository-specific tool-use evals. |
| Google, [prompt design](https://ai.google.dev/gemini-api/docs/prompting-strategies) | Direct instructions, clear structure, and relevant context are more reliable than diffuse prose. | Put only critical invariants in the always-on core; make acceptance and evidence explicit; remove duplicate narrative. | Prompt behavior remains stochastic and model-dependent. |
| OpenAI Codex, [customization](https://developers.openai.com/codex/customization/overview) | Repository guidance should stay scoped and concise, with deeper instructions near the relevant work. | Use `AGENTS.md` as a map and docs/skills as progressive disclosure. | This source describes Codex, so it is supporting cross-agent evidence rather than a Pi contract. |
| Anthropic, [context windows](https://docs.anthropic.com/en/docs/build-with-claude/context-windows) and Stanford/UC Berkeley, [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/) | More context is not automatically better; long inputs can reduce retrieval of relevant evidence. | Enforce byte/line budgets and remove repeated policy. | Neither source is a controlled ablation of this exact Pi repository. |
| Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | Start with the simplest composable workflow and add agentic complexity only where it pays. | One writer by default; conditional specialists; at most two evidence-driven evaluator/repair rounds. | Long-horizon or unusually risky work may benefit from more orchestration. |
| OpenAI, [subagents](https://developers.openai.com/codex/subagents) | Subagents add independent context and parallelism but also model/tool/token work. | Preserve the capability but do not invoke it automatically for localized work; use self-review when unavailable or unjustified. | This is cross-agent guidance; Pi package behavior must be tested separately. |
| OpenAI, [Harness engineering](https://openai.com/index/harness-engineering/) | Agent-legible repository maps, mechanical invariants, and executable feedback matter alongside model capability. | Convert recurring rules into guard/tests/doctor checks instead of adding prompt prose. | Experience report, not an isolated causal study of each control. |
| UIUC, [Agentless](https://arxiv.org/abs/2407.01489) | A simple localization → repair → validation pipeline can be competitive and cost-effective. | Make that the default coding path; plans and reviewers must earn their cost. | SWE-bench results do not cover every greenfield/UI/high-risk task. |
| Princeton, [SWE-agent](https://arxiv.org/abs/2405.15793) | Purpose-built navigation/edit/execution interfaces materially affect repository performance. | Keep semantic lookup, exact search/edit, and executable verification, while removing only overlapping schemas. | Results reflect the paper's benchmark/model snapshot. |
| Microsoft Research, [CodePlan](https://arxiv.org/abs/2309.12499) | Cross-file work benefits from dependency-aware planning that adapts as evidence changes. | Use affected-file routing and durable plans only for genuinely cross-module/multi-session work. | Static/manual dependency maps can miss runtime wiring. |
| Meta, [TestGen-LLM](https://arxiv.org/abs/2402.09171) and UMass, [CoverUp](https://arxiv.org/abs/2403.16218) | Generated tests need execution, usefulness, and iterative error/coverage signals; passing alone is insufficient. | Keep separate `test-design` and verification-routing skills; require green plus pre-fix red/mutation/equivalent sensitivity when practical. | Coverage is not equivalent to defect detection or maintainability. |
| Google, [test behavior](https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html), [prefer public APIs](https://testing.googleblog.com/2015/01/testing-on-toilet-prefer-testing-public.html), and [avoid overusing mocks](https://testing.googleblog.com/2013/05/testing-on-toilet-dont-overuse-mocks.html) | Stable behavior boundaries resist refactors better than private calls; mock-heavy tests can validate their own setup instead of the product. | Require public/authoritative boundaries and reserve mocks for owned expensive, nondeterministic, or unsafe seams. | Some internal invariants are legitimate contracts; the rule is not a ban on unit tests or mocks. |
| Microsoft, [Playwright best practices](https://playwright.dev/docs/best-practices) | Browser tests should verify user-visible behavior, use resilient user-facing locators, and remain isolated. | Use roles/labels and real interaction for browser-only risk; keep journeys narrow and independent. | Browser evidence is costlier and should not replace lower-layer business-rule tests. |
| MuTAP, [mutation-guided test generation](https://arxiv.org/abs/2308.16557), and Meta, [industrial mutation-guided LLM testing](https://arxiv.org/html/2501.12862v1) | Plausible mutations provide concrete feedback about whether generated tests distinguish faulty behavior. | Use a safe focused mutation or isolated pre-fix revision when ordinary red-before-green evidence is unavailable. | Mutation score is a proxy; equivalent/unrealistic mutants and mutation cost require judgment. |
| Siddiq et al., [design choices in LLM-based test generators](https://arxiv.org/abs/2412.14137) | Oracles inferred from current program behavior can produce passing tests that preserve a bug. | Require an independently derived oracle, a named evidence gap, and a distinct failure model before retaining a test. | Independent contracts may be unavailable for legacy behavior; report that limitation instead of inventing certainty. |
| OpenAI, [evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) | Use representative task distributions, automated scoring, logs, and predeclared thresholds rather than vibe checks. | Preserve raw traces/artifacts, deterministic graders, matched baseline comparison, and explicit qualitative review. | A useful task distribution must be maintained with real failures. |
| Pi, [RPC mode](https://pi.dev/docs/latest/rpc) | RPC emits structured tool events and session statistics. | Measure tool/error/duplicate/verification/repair/retry/compaction behavior from events, and deterministically reject Git mutation attempts. | Event schemas are version-sensitive. |
| Pi, [security](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md) | Project trust is not sandboxing; real containment is an OS/container/VM concern. | Give trusted implementation broad workspace access, keep secret/destructive/external guards, and use strict container scope for untrusted work. | Regex guards are defense in depth, not a security boundary. |

## Keep / simplify / remove audit

| Surface | Decision | Reason |
|---|---|---|
| `AGENTS.md` + system append | **Simplify** | Always loaded; duplicated routing had ongoing token/attention cost. Critical invariants remain mechanical and concise. |
| Model/provider/thinking defaults | **Remove** | They made the template vendor-specific and could silently override the operator's better/current choice. |
| Compaction/timeout overrides | **Remove** | They duplicated official defaults without repository evidence of a failure mode. The continuity capsule complements compaction rather than changing it. |
| Blind identical-call retry | **Add bounded guard** | Two identical errors are evidence to change the hypothesis. The runtime stores only a short signature/count and clears it after a different successful evidence/action step. |
| `docs/PI_WORKFLOW.md` | **Remove** | Duplicated README/HARNESS and created drift; unique Git authority moved to `docs/GIT_POLICY.md`. |
| 16 slash-command prompts | **Keep on demand** | They cover distinct deliverables and are not all loaded per turn; merging would make selection less precise. |
| 6 specialist skills | **Keep on demand** | Each has a distinct trigger/evidence contract; Pi progressive disclosure avoids constant context cost. `quick-fix` replaces ceremony for genuinely Localized work rather than adding another review stage. |
| Subagent package | **Keep, conditional** | Independent context helps ambiguity/risk, but default invocation adds cost and can dilute ownership. |
| Todo package | **Keep, conditional** | One compact tool helps genuinely multi-step state; localized tasks explicitly avoid it. |
| LSP/docs/web | **Keep deferred** | Semantic/local/current evidence improves correctness when needed, but twelve specialist schemas do not need to accompany every localized task. |
| Playwright MCP | **Keep deferred + lazy** | The single `mcp` schema activates only for browser work. With valid cached metadata the server starts lazily; missing/stale metadata may require a startup catalog connection. |
| Smart Read | **Add bounded focus** | Pi already truncates at 2,000 lines/50 KiB; the extension adds an earlier 400-line bound only for large implicit reads and preserves explicit ranges. |
| Continuity capsule | **Add bounded state** | Exact recent check status and hashed open failures can be lost across resume/compaction. Custom entries persist that state outside normal LLM context and inject it once. |
| Vision-routing security section | **Remove** | The delegated vision tooling had already been removed, so the section was stale and misleading. |
| Git delivery automation | **Scoped, owner-adopted** | A reviewed helper creates a missing `ai-changes` from `main` during clean preparation and delivers only to that fixed lane and a matching PR; raw Git/main/merge remain protected and evals force delivery off. Automatic creation is an owner-requested policy change, not a model-quality claim. |
| Three default eval trials | **Reduce to one smoke trial** | Cuts routine model calls by 66.7%; repeated trials remain explicitly required for promotion-quality comparisons. |

## Dependency review

Exact versions and registry integrity values are recorded in `.pi/package-integrity.json`.

| Package | Reviewed pin | Decision |
|---|---:|---|
| `@earendil-works/pi-coding-agent` | `0.84.2` | Upgrade from `0.84.1`; current reviewed Pi release. |
| `pi-sub-agent` | `0.1.5` | Keep; already current in the audit. |
| `pi-mcp-adapter` | `2.26.1` | Upgrade from `2.20.1`; reviewed fixes include approval correctness, hang/catalog fixes, and lower startup catalog work. |
| `@juicesharp/rpiv-todo` | `2.6.2` | Upgrade from `2.1.0`; keep conditional use. |
| `pi-lsp-adapter` | `0.1.3` | Keep. |
| `@dreki-gg/pi-doc-search` | `0.3.2` | Keep. |
| `@bytetrue/pi-web-search` | `0.2.1` | Upgrade from `0.1.3`; retain one explicit search provider and safe public fetch behavior. |
| `@playwright/mcp` | `0.0.79` | Keep exact lazy pin and restricted browser tool set. |

## Mechanical changes measured in this audit

| Signal | Original | Previous optimized | V3 | Net change |
|---|---:|---:|---:|---:|
| Always-loaded `AGENTS.md` + append | 11,747 bytes / 179 lines | 8,170 bytes / 95 lines | 8,170 bytes / 95 lines | −3,577 bytes (−30.5%), −84 lines |
| Initial launcher tool schemas | 22 | 19 | 8 | −14 (−63.6%) original; −11 (−57.9%) previous |
| On-demand specialist groups | 0 | 0 | 6 groups / 12 schemas | Installed capabilities retained without initial exposure |
| Default eval trials per case | 3 | 1 | 1 | −66.7% routine model calls; promotion trials remain opt-in |
| Project model/thinking pins | 2 | 0 | 0 | Operator/model neutral |
| Duplicate workflow documents | 2 | 1 canonical playbook | 1 canonical playbook | `PI_WORKFLOW.md` removed; `HARNESS.md` retained |
| Runtime behavior tests | 0 | 0 | 7 | Loader, Smart Read, retry, continuity, session reset, redaction, and opt-out invariants |

These are structural efficiency and resilience gains, not an empirical claim that output quality improved for every model. A paid/provider-backed 19-tool-versus-dynamic before/after evaluation was not executed during this audit; deterministic tests, dry-run validation, package integrity checks, runtime startup compatibility, and measured context/tool reductions are the available evidence. Run repeated matched baseline/candidate trials before claiming model-output superiority.

## Optimized universal loop

1. Classify the task; avoid ceremony for a localized change.
2. For non-trivial work, state 3–7 observable acceptance criteria and expected proof.
3. Search/localize on the eight-tool core; activate every required specialist capability together only when core evidence is insufficient.
4. Expose the gap with reproduction, test, or explicit `UNPROVEN` status.
5. Implement one coherent slice with one primary writer.
6. Run the cheapest faithful targeted proof first, then affected routes.
7. Use a specialist/evaluator only for a named ambiguity or material risk; otherwise self-review independently.
8. Run the final/full gate once when scope/risk requires it.
9. Inspect the diff and report criterion → evidence/status.
10. Complete the scoped fixed-branch PR handoff for implementation; keep main integration and other external actions owner-controlled. Never publish from read-only/local-only work or evals.

## Promotion protocol

For an actual workflow comparison:

- use the same case set, suite fingerprint, model, thinking level, timeout, credentials, and starting files;
- run repeated isolated trials (three is a practical minimum, more when variance is high);
- require 100% deterministic pass rate and zero workflow-safety violations;
- reject new Git/GitHub mutation attempts or protected workflow-file edits;
- reject per-case median regression above the declared thresholds for duration, tool calls, tokens, duplicate calls, repair rounds, or repeated full gates;
- compare localized cases and specialist-required cases separately so loader-call overhead and schema savings are both visible;
- keep qualitative product/design/architecture rubrics `UNSCORED` until a blinded evidence review;
- never weaken thresholds after seeing the candidate result.

Passing deterministic gates yields `QUALITATIVE_REVIEW_REQUIRED`, not automatic promotion.

## Native Vision amendment — reviewed 2026-08-26

The previous Playwright configuration used `--image-responses omit`: screenshots could be saved without sending pixels to the model. The amended configuration uses `allow`, retaining the same pinned server, MCP proxy, eight-tool core, and selected provider. The runtime reads `ctx.model.input`, reports image-block counts without claiming perception, and adds guidance only on browser/image paths. Pi remains responsible for image resizing, provider serialization, and the `images.blockImages` opt-out; no image bytes are copied into the harness continuity capsule.

| Primary source | Applied decision | Limit |
|---|---|---|
| [Pi extensions](https://pi.dev/docs/latest/extensions) and reviewed `0.84.2` source (`core/tools/read`, `core/sdk`, `utils/tool-result-images`) | Use live model metadata and native tool image blocks; preserve built-in normalization/filtering. | Metadata and hook output cannot prove downstream provider acceptance or correct perception. |
| [Playwright MCP 0.0.79](https://github.com/microsoft/playwright-mcp/blob/4c5077651542f68525a0b51e97bab2a32abc9290/README.md) and [screenshots](https://playwright.dev/docs/screenshots) | Return native screenshots with `allow`; use viewport composition plus targeted element crops while retaining accessibility-based interaction. | The pinned schema supports `target` element captures and `scale`; screenshot capture is not visual review. |
| [OpenAI images and vision](https://developers.openai.com/api/docs/guides/images-vision) | Require actual image inputs; zoom/crop unreadable detail and label reference/before/current evidence explicitly. Confirm non-Latin text and precise geometry with DOM. | Images can be resized; small text, exact localization, and interpretations can be wrong. Do not hard-code provider-specific detail parameters into Pi. |
| [Anthropic Vision](https://platform.claude.com/docs/en/build-with-claude/vision) | Prefer readable, appropriately sized images; avoid repeated lossy compression and excessive images. Ground findings in visible evidence and verify exact claims independently. | Resolution limits vary by model/provider; no universal pixel/token threshold or guaranteed visual accuracy. |
| [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) | Keep fixtures, environment, viewport, theme, locale, and readiness stable; re-capture affected states after repair. | Pixel differences detect change, not design excellence; never blind-update a baseline. |

The resulting skill loop is reference/baseline inspection → small readable evidence set → evidence-backed critique → bounded repair → final re-capture. Fresh reviewers must inspect the images themselves. Exact accessibility/behavior/performance proof still comes from deterministic tools. Synthetic/masked captures protect privacy; images add provider cost. Structural tests and transport checks do not establish better design outcomes: repeated matched visual evals are still required, and no provider-backed quality comparison is claimed by this amendment.

## Project-specific work that remains

`/bootstrap` should replace template examples with evidence from the real repository:

- canonical commands and actual dependency/workspace boundaries;
- recent production bugs, rejected patches, and realistic fixtures;
- current runtime, flake, cost, and task-variance distributions;
- product-specific security, accessibility, performance, data, and recovery gates;
- affected-file routes with conservative full fallback for unmatched paths.

Optimization must not rely on silent omission. If route/capability evidence is uncertain, widen the check or mark the criterion `UNPROVEN`.

## Evidence-integrity amendment — reviewed 2026-09-05

Scope: Pi `40d1c630fdea3acbd29dbb1c7a68e3bd2efb0477`; OMP comparison at `80d6e6173c610354351999d7bf59e8b9205fc279`. This is a failure-driven correction, not a wholesale rewrite. Low-resource and low-cost operation remains a priority.

### Current primary evidence

| Source and date | Finding used | Concrete decision and limitation |
|---|---|---|
| [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), 2024-12-19 | Start with simple compositions; add complexity for a demonstrated need. | Keep one writer, conditional specialists, native tools and existing gates. Do not import an OMP role/skill framework. This is engineering guidance, not a measured result for this template. |
| [SWE-agent](https://arxiv.org/abs/2405.15793), 2024-05 | The agent-computer interface affects coding performance. | Fix the correctness of tool feedback before adding prompting layers. Benchmark results do not imply guaranteed production quality. |
| [Anthropic: Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents), 2025-09-11 | Focused tool contracts and evaluated outputs matter. | Preserve the eight-tool core; improve evidence labels without another schema. No tool-count reduction is itself proof of quality. |
| [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), 2025-11-26 | Incremental implementation, explicit feature status and end-to-end checks address premature completion. | Keep the existing acceptance/vertical-slice/browser workflow; repair continuity so another branch's history cannot become current evidence. No extra progress-file format is needed. |
| [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01-09 | Environment outcomes differ from an agent's claim; repeated trials and distinct graders are needed. | Process success is not test acceptance. Fingerprint inputs; reject missing measurement; retain qualitative review. Deterministic tests below prove specific harness behavior, not better client products. |
| [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/), 2026-02-11 | A concise map plus mechanical invariants is preferable to a large instruction manual. | Shorten always-loaded instructions while retaining links to detailed procedures and exact delivery policy. This is an experience report, not an isolated causal experiment. |
| [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988), 2026-02 | In its tested settings, unnecessary context requirements reduced success and increased cost. | Remove repeated ceremony rather than delete useful repository knowledge. The result is task/model dependent. |
| [On the Impact of AGENTS.md](https://arxiv.org/abs/2601.20404), 2026-01; revised 2026-03 | A different study associated context files with lower runtime and output-token use. | Do not generalize “all AGENTS files are harmful.” Keep commands, boundaries and a retrieval map. Efficiency is not the same measure as correctness. |
| [Do Context Files Help Coding Agents?](https://arxiv.org/abs/2607.27250), 2026-07-28 | A small two-agent ablation found no measurable correctness change from context strategy; implementation skill remained a failure source. | Treat smaller context as a measured size saving and an unproven quality hypothesis. Its 17 tasks/3 repositories cannot justify a universal conclusion. |
| [Anthropic: Managed Agents](https://www.anthropic.com/engineering/managed-agents), 2026-04-08 | Model-specific harness workarounds can become obsolete. | Keep model choice operator-owned and do not add automatic model switching or forced context resets. Re-evaluate controls with matched trials. |
| [Pi extensions](https://pi.dev/docs/latest/extensions) and exact npm `0.84.2` declarations | `getEntries()` covers all entries; `getBranch()` follows the active branch; `session_tree` reports navigation. | Restore from the branch, clear pending tracking on navigation and preserve Pi-native APIs. Confirmed in the pinned package's `dist/core/session-manager.d.ts` and `dist/core/extensions/types.d.ts`, not just floating docs. |
| [Git environment variables](https://git-scm.com/docs/git#_environment_variables) | Git can discover parent repositories and accept explicit environment redirects. | Scrub inherited `GIT_*` and set a discovery ceiling for eval subprocesses. This prevents accidental discovery; it is explicitly not containment against arbitrary code. |

### Repository findings and changes

| Finding | Smallest correction | Observable proof |
|---|---|---|
| `node --test missing.test.mjs || true` could be stored as a passed check; a skipped command and a pipe had the same problem. | Retain bounded check labels; classify shell ambiguity as `unproven`, direct success as `process-ok`; downgrade old `passed` snapshots. | Three masked/skipped/pipe regressions plus direct invocation and migration; the new regression failed on the original code. |
| Resume selected the latest snapshot from all branches; `/tree` did not rebuild state. | Use the active branch and share restore logic across start/navigation. | A later sibling snapshot must not activate its tools or inject its paths; navigation to an empty branch clears state. Failed before the fix. |
| Disposable eval copies live beneath the source checkout and inherited Git redirects. | Adapt OMP's small isolation helper for both agent and post-check processes. | Real Git subprocesses demonstrate parent discovery before isolation and rejection afterwards, including explicit inherited redirects. |
| Suite metadata matched even when product/fixture/grader bytes differed; absent tokens skipped regression checks. | Declare harness treatment paths inside the existing suite, fingerprint all other input and reject absent required medians. | Changed fixture/grader/contract rejects; changed declared harness content remains comparable. Regression failed before the fix. |
| File-only manifests omitted changed symlink targets and permissions. | Hash entry type, link target and mode along with bytes. | Real filesystem mode/link changes appear in the diff without following the link. |
| Two always-loaded documents repeated the detailed workflow. | Reduce combined bytes from 8,689 to 5,355 (38.37%); preserve the fixed-lane delivery paragraph unchanged. | Exact UTF-8 byte counts and existing contract tests. Token savings and quality gains are not measured. |

### What was deliberately not imported or removed

OMP's isolation/manifest logic was adapted; its native task/agent layer, extra UI skills, readiness framework and OMP configuration were not copied. Pi already has design, RTL, browser, risk, test and verification guidance loaded on demand. Duplicating these would add maintenance and routing ambiguity without new evidence.

Keep LSP/docs/web/browser and conditional review: they provide distinct evidence. Keep safety controls and real tests. Remove duplicate always-on explanation and the unsafe assumption that shell exit status proves a test. Do not remove useful capabilities solely to reduce repository file count.

No extra dependency, model provider, tool schema, automatic self-improvement loop, vector database, mandatory agent team or forced reset was added. Existing pins are preserved; this amendment validates their relevant API, not a claim that every package is the latest release.

### Promotion and honest limits

The 17-case starter suite is not a production certification benchmark. Structural dry-run, deterministic regression tests and a Pi startup smoke cannot establish AAA UI, security, maintainability or weak-model reliability. Most starter cases still need independent qualitative grading. No paid model trials or cross-model quality gains are claimed in this amendment.

For the first real client task, keep acceptance constant and compare old/new harness using the revised evaluator in both copies. Use the same approved model, prompt, fixtures, timeouts and thinking setting; three trials are a starting point, not statistical certainty. Measure acceptance, failures, repairs, latency and cost, then inspect actual rendered/persistence/access-control evidence. A cheaper model earns its role by passing those task-specific checks. If it cannot prove required behavior, reduce the slice or use an explicitly approved capable model; never lower the quality bar or promise universal AAA output.

## Writing and terminal UX amendment — 2026-09-23

| Source / inspection | Decision | Evidence limit |
|---|---|---|
| [Peter Yang, no-ai-slop](https://github.com/petergyang/no-ai-slop/tree/000650b156983f5159695b441477f4e63b25dc85), SKILL.md, eval.md, MIT license | Vendor a compact attributed Pi adaptation, triggered only for substantive prose. Preserve edit/detect behavior and pattern checks; allow technical terms, required formats, multilingual punctuation, and existing task context. | Editorial heuristics, not an AI detector or measured universal quality gain. No claims invented to make copy specific. |
| [Anthropic: Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) | Keep short discoverable descriptions and on-demand procedures. Audit unique tasks rather than remove skills based on guesswork about usage frequency. | Progressive disclosure reduces always-loaded content; it does not prove a particular skill improves output. |
| Local skill/prompt/QUALITY audit | Remove the separate generic `risk-review` checklist and retain its method, severity definitions, and finding format in QUALITY, already required by `/review`. Update `/incident`. Keep quick-fix, verification-routing, test-design, browser-qa, and frontend-design for their distinct contracts. | Structural overlap was observed; no usage telemetry or matched-model A/B measurement was collected. Six skills remain after adding writing and removing the redundant review skill. This supersedes the earlier six-skill keep-all audit for risk-review. |
| Pi [v0.84.2 themes](https://github.com/earendil-works/pi/blob/v0.84.2/packages/coding-agent/docs/themes.md), theme schema and loader | Use one project JSON theme, native settings/CLI selection, and no dependency. | Dark palette; light-terminal users should select light. Terminal background/font remain operator-controlled. |
| Pi [v0.84.2 extension events](https://github.com/earendil-works/pi/blob/v0.84.2/packages/coding-agent/docs/extensions.md), agent-loop.ts and agent-session.ts | Add only `setStatus`, a monotonic clock, and native lifecycle handlers. Start timing before request preparation via turn_start; finalize at agent_settled rather than agent_end, which may precede automatic recovery. | Effective foreground response rate, not decoding-only TPS. Includes first-token wait; excludes tool/backoff time and delegated usage. Missing usage is unavailable, not estimated. Busy runs can include queued prompts. |

Validation uses deterministic event timelines with independent token/time examples and the actual pinned Pi loader/theme parser. Tests cover weighted rates, tool-time exclusion, automatic continuation, missing usage, cancellation, timer cleanup, and UI absence. Live provider performance and improvement in writing quality require separate representative runs; fixture timings are not model benchmarks.

## Custom provider setup — 2026-09-23

Pi `0.84.2` documents user-level `models.json` entries for custom endpoints speaking OpenAI Completions, OpenAI Responses, Anthropic Messages, or Google Generative AI. `auth.json` is Pi's private credential store; provider-specific API keys use the `api_key` record and `0600` file permissions. The launcher adds one small interactive wizard that writes these native formats, preserves existing entries, and keeps credentials out of project files. It does not claim support for arbitrary transports or OAuth: those still require a Pi extension or manual configuration. Sources: [Pi v0.84.2 custom models](https://github.com/earendil-works/pi-mono/blob/v0.84.2/packages/coding-agent/docs/models.md), [Pi v0.84.2 providers and credentials](https://github.com/earendil-works/pi-mono/blob/v0.84.2/packages/coding-agent/docs/providers.md).

## Test economy and outcome grading — 2026-09-26

- [Anthropic, Demystifying evals for AI agents (2026-01-09)](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents): evaluate the resulting environment as well as traces; exact string graders have limits. Replace test-design prose-presence assertions with task outcomes and calibrated positive/negative controls. Add copy-only and already-covered cases alongside the existing regression fixture; require declared post-check results before accepting an evaluation record.
- [Google, Code Coverage Best Practices (2020-08-07)](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html): coverage helps locate risk but does not establish assertion quality; chasing a number can create low-value maintenance. Keep evidence-gap and independent-oracle requirements, make no-new-test decisions visible before loading a skill, and choose the layer by the failure mechanism. Existing product coverage gates still apply.

These are workflow design decisions, not measured model-quality gains. Local grader controls verify acceptance/rejection of known outcomes; dry runs verify suite structure. Repeated matched-model trials and rubric review are still needed to establish better agent behavior. No live-model result is inferred from instruction wording, green unit tests, or fewer tests.

## Durable design direction and run cost — 2026-09-26

- [DTCG Format 2025.10](https://www.designtokens.org/tr/2025.10/format/) describes named values, aliases, and shared token sources. Use semantic roles mapped to the project's existing token format; no extra token framework or claim of DTCG conformance is needed. Keep user intent in DESIGN and resolved values in its mapped code source.
- [W3C WCAG 2.2 contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) evaluates foreground/background combinations. Store role and theme with a color, measure the rendered pairs, and explain conflicts without silently replacing the requested brand identity.
- [Anthropic, Harness design for long-running application development (2026-03-24)](https://www.anthropic.com/engineering/harness-design-long-running-apps) calibrates a visual evaluator with scored examples. Adapt this economically: optional owner-liked/disliked references with concrete reasons and inspection status, reused in the existing design/review flow; no mandatory extra evaluator or iteration loop. This does not establish a measured design-quality gain.
- Pi v0.84.2 [extension events](https://github.com/earendil-works/pi/blob/v0.84.2/packages/coding-agent/src/core/extensions/types.ts), [session event forwarding](https://github.com/earendil-works/pi/blob/v0.84.2/packages/coding-agent/src/core/agent-session.ts), and [cost calculation](https://github.com/earendil-works/pi/blob/v0.84.2/packages/ai/src/models.ts) were inspected locally. Sum native cost components rather than recreate pricing, count the union of tool intervals, and label post-error model continuations accurately: auto_retry_start is a session event, not a public extension hook in this version. Cost is a partial foreground estimate, not a bill; unknown/zero prices remain unavailable.

Validation uses independent event timelines for concurrency/recovery/cost, the real pinned extension loader, and the existing full gate. A design-capture benchmark checks persisted preferences and scope; its qualitative rubric requires model trials and inspection. Static success is not evidence that every model will follow the design contract.
