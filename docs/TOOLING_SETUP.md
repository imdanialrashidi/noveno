# Production Tooling Setup

This repository pins a small production-oriented Pi tool stack. Pi installs the project packages after the repository is trusted.

The reviewed Pi pin requires Node.js 22.19.0 or newer. The included CI pins Node 22.23.2; the container pins Node 24.19.0 on Debian Bookworm slim.

## Included packages

- `pi-sub-agent@0.1.5`
- `@juicesharp/rpiv-todo@2.12.0`
- `pi-lsp-adapter@0.1.3`
- `@bytetrue/pi-web-search@0.5.1`

Pi `1.0.4` loads `.pi/mcp.json` natively. It pins `@playwright/mcp@0.0.83` and the official DeepWiki remote MCP endpoint, exposes only the listed browser/docs tools on demand, and keeps unlisted tools hidden. No MCP adapter is installed.

The packages remain installed and their commands remain available, but their model-call schemas are deferred. `./p` starts with seven repository tools plus `harness_tools` and native `tool_search`:

| `harness_tools` capability | Activated schemas |
|---|---|
| `planning` | `todo` |
| `delegation` | `subagent` |
| `code_intelligence` | `lsp_diagnostics`, `lsp_definition`, `lsp_references`, `lsp_workspace_symbols`, `lsp_more` |
| `web` | `web_search`, `web_fetch` |

Browser and docs work uses native `tool_search` directly: load only the needed `mcp__playwright__*` or `mcp__deepwiki__*` tools, then call their returned schemas. No docs capability-loader call is needed.

Ask the agent to activate all required groups together. Passing an empty capability list unloads the managed specialist schemas without removing unrelated custom tools. A restored session reactivates the groups in its latest continuity snapshot.

## First startup

```bash
./p
```

The repository launcher passes Pi's official `--approve` trust override, so it loads project resources and installs missing pinned packages without a trust prompt. It grants normal implementation access across the writable workspace, while arbitrary Git/GitHub mutations remain disabled independently. Routine delivery uses the reviewed `scripts/ai-pr.mjs` helper on the persistent `ai-changes` branch; install/authenticate `gh` as the owner and see `docs/GIT_POLICY.md`. Set `AI_PR_DELIVERY=off` for local-only runs. Use `PI_PROJECT_TRUST=ask ./p` only when you intentionally want the interactive trust decision.

For the reviewed Pi `1.0.4` pin, the launcher defaults to:

| Variable | Default | Effect / opt-out |
|---|---:|---|
| `PI_SMART_READ` | `1` | Bounds implicit reads of regular files at least 96 KiB; set `0` to disable. |
| `PI_SMART_READ_BYTES` | `98304` | Size threshold in bytes. |
| `PI_SMART_READ_LINES` | `400` | Injected limit for a qualifying read; explicit ranges are unchanged. |
| `PI_BLIND_RETRY_LIMIT` | `2` | Blocks the next identical tool call after this many errored executions; set `0` to disable. |
| `PI_CONTINUITY` | `1` | Persists/injects the bounded mechanical continuity capsule; set `0` to disable. |

These controls are model/provider neutral. Pi owns schema compatibility; the launcher does not force experimental features.

Reload after package changes:

```text
/reload
```

Validate the repository configuration:

```bash
bash scripts/pi-doctor.sh
```

## Localized fast path

For a tiny, obvious, low-risk change, invoke the project skill directly:

```text
/skill:quick-fix <small low-risk change>
```

Pi exposes project skills as `/skill:name` commands and also selects them from their descriptions. This path deliberately skips plans, todos, subagents, broad suites, and full gates unless scope, risk, or repository policy requires escalation.

## Todo panel

Confirm the extension:

```text
/todos
```

Use todos only for genuinely multi-step work.

## MCP and Playwright browser tools

Check the native connection inside Pi:

```text
/mcp
```

Servers connect in the background; the first prompt does not wait for deferred browser tools. Native `tool_search` waits for connection when discovery is needed. Search for the exact capability, then call the returned `mcp__playwright__*` schema. Loaded tools persist on the active branch across resume/reload. Codemode remains opt-in; native nested calls still pass through the guard.

A bounded smoke request:

```text
Use tool_search to load Playwright browser_snapshot. Do not navigate anywhere. Report whether the tool is available.
```

For browser QA, start the real local application. Use snapshots for actions and native screenshots for appearance; artifacts live in `.artifacts/playwright/`. Autonomous mode permits focused `browser_evaluate`; strict mode blocks evaluation and public navigation. Upload, file injection, browser installation, and arbitrary browser scripting are hidden.

The default server needs Chrome. If it is unavailable, install the browser as the operator following Playwright's reported command, or set a known installed browser's `--executable-path` in the server args. Installing a generic Chromium build does not by itself install the default Chrome channel. Keep server and browser versions compatible.

Remove any user-level `pi-mcp-adapter` in `pi config` before starting: it registers `/mcp` and replaces the built-in connection. Convert personal servers to `~/.pi/agent/mcp.json`; keep credentials there, outside Git. `/mcp` is the reliable in-session check; the separate `pi mcp list` CLI reads project servers only after persistent project trust.

### Visual evidence across model capabilities

The workflow uses the active model's native image input; it does not install or call a separate image model or add a Vision tool schema. The runtime reports configured image support on image results and refreshes guidance on visual user turns or with loaded browser tools. Model names are never used to infer support. For custom models, confirm accurate `input` metadata in the operator's Pi configuration; do not silently change it.

Playwright now uses `--image-responses allow`: a requested screenshot returns native image content through native MCP as well as a saved artifact. Native MCP bounds direct text results and retains the full text in a temporary file; Pi `1.0.4` normalizes tool-result images. Request only useful viewport/element screenshots and retain Pi's default image resizing. If a permitted response contains only a path, use `read` on that exact file; do not paste base64 or assume the model can see a filename.

`harnessVision.imageInput` and `imageBlocks` in tool details mean configured support and blocks returned, not provider acceptance or completed inspection. Pi's `images.blockImages` setting can strip images after the extension hook, and a provider can reject them. Respect that setting and user privacy opt-outs: disabled/filtered/unsupported/unreadable pixels leave appearance-only criteria `UNPROVEN`. TUI image display is separate from model input. After updating `.pi/mcp.json`, run `/reload` and reconnect Playwright with `/mcp` or start a fresh session.

Use browser-observable evidence first for behavior: accessibility snapshots, DOM structure, element geometry, computed state, console output, network evidence, and deterministic browser tests. For appearance, follow the `browser-qa` pixel-inspection loop: references/baseline, small desktop/mobile evidence set, focused detail crops, bounded critique/repair, then final re-capture. Exact contrast and dimensions need measurement, not visual estimates. Images may contain private data and incur provider image-token cost; capture synthetic/masked fixtures only and keep artifacts out of commits.

Do not claim pixel-level or aesthetic screenshot findings that the active model cannot actually inspect. Mark those acceptance criteria `UNPROVEN` and report the saved screenshot path instead.

## Language server setup

Start this workflow with `./p`. The published `pi-lsp-adapter@0.1.3` incorrectly lists Pi TUI and TypeBox as runtime dependencies. `scripts/pi-extension-compat.mjs` moves only those reviewed declarations to optional `"*"` peers in the project's installed `.pi/npm` cache, before Pi reads extension manifests. Pi supplies the actual runtime modules through its loader. Upstream source, registry integrity records, product dependencies and provider settings stay unchanged.

The launcher installs the configured adapter on its first trusted session if missing, then repairs it. Help, explicit no-approval/no-extension runs and ask/never trust modes do not trigger this pre-install. `./p install ...` and `./p update ...` reapply the correction after successful installation. The workaround retires automatically when the configured LSP pin changes; it does not patch an unknown release or suppress diagnostics.

For an existing project showing the host-dependency warning, copy the updated `p` and `scripts/pi-extension-compat.mjs` from the same workflow revision, quit Pi and run `./p` again. For a direct `pi` launch, repair the installed cache first:

```bash
node scripts/pi-extension-compat.mjs
pi
```

Reapply after a direct `pi update` reinstalls this package, or use `./p update`. `/bootstrap` fills product contracts; it cannot repair an npm manifest. Doctor checks an installed adapter without modifying it and reports how to repair it.

Check available servers:

```text
/lsp status
```

Install only the server required by the current project, for example:

```text
/lsp install vtsls
/lsp doctor vtsls
```

or:

```text
/lsp install pyright
/lsp doctor pyright
```

Missing language servers are not silently installed.

The `/lsp` management command is always available. The model activates `code_intelligence` only when definitions, references, workspace symbols, or diagnostics add evidence beyond exact text search.

Language-server diagnostics arrive asynchronously. A cold first query can say "No LSP diagnostics" before TypeScript publishes its errors. Recheck after initialization or a recent edit; use the project's compiler/check command for authoritative verification. Empty LSP output alone is not a passed build.

## Documentation search

DeepWiki runs as a native remote MCP server (see `.pi/mcp.json`): Pi connects over streamable HTTP to `https://mcp.deepwiki.com/mcp`. It covers public GitHub repositories with no API key and no local process. Private repositories need a Devin account and are out of scope for the default workflow — treat private-repo docs as `UNPROVEN` via local source instead.

The server stays `hidden` with only `read_wiki_structure`, `read_wiki_contents`, and `ask_wiki_question` exposed as `deferred`; load them with native `tool_search`, then call the returned `mcp__deepwiki__*` schemas:

```text
Use tool_search to load the DeepWiki read_wiki_structure tool. List the documentation topics for vercel/next.js. Do not fetch full contents yet.
```

Use `mcp__deepwiki__read_wiki_structure` first to discover topics for a `owner/repo` name, then `mcp__deepwiki__read_wiki_contents` or `mcp__deepwiki__ask_wiki_question` for the focused question — only when local source, installed types, and repository patterns do not answer it. No documentation schema is paid for on an ordinary localized edit. Loaded tools persist on the active branch across resume/reload; Pi branch state owns them, not `harness_tools`.

Reliability: DeepWiki answers come from its generated wiki index, which can lag the repository HEAD — prefer local source for bleeding-edge APIs and confirm version-sensitive claims against installed types. Pi retries transient MCP HTTP failures (408, 429, 5xx) twice; on a rate limit slow down, narrow to one structure call plus one focused question, and resume.

Never paste secrets, credentials, private keys, or proprietary code into `repoName`/`question` — the safety guard blocks obvious secret/sensitive-path inputs. There is no key to manage: do not add credentials to `.pi/mcp.json`; keep any personal Devin/private-repo servers in your user-level `~/.pi/agent/mcp.json`, outside Git.

## Web search

The included search extension defaults to Exa free MCP search and does not require a model-native search provider. The upgraded package keeps private config under the agent directory in `pi-pkg-cfg/pi-web-search/config.json` and copies legacy configuration forward without deleting it. `/web` is the preferred setup. Fetches revalidate redirects and block private/network metadata targets; use browser tools for localhost QA.

Inspect or change the provider with:

```text
/web
```

Show current configuration:

```text
/web --show
```

The agent has two web tools:

- `web_search` for current external information;
- `web_fetch` for a specific public URL.

The model activates the `web` capability before using them.

Do not commit search API keys or proxy credentials.

## Recommended smoke checks

After setup:

```text
/todos
/lsp status
/mcp
/web --show
```

Then test capabilities with bounded requests:

```text
Use tool_search to load the DeepWiki read_wiki_structure tool. List the documentation topics for the target repository. Do not fetch full contents yet.
```

```text
Use tool_search to load the native Playwright browser_snapshot tool. Do not navigate.
```

## Updating packages

Package versions are pinned for reproducibility. Review release notes before changing a pin. After intentionally updating pins:

```text
/reload
```

then run:

```bash
bash scripts/pi-doctor.sh
```
