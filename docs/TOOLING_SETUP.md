# Production Tooling Setup

This repository pins a small production-oriented Pi tool stack. Pi installs the project packages after the repository is trusted.

The reviewed Pi pin requires Node.js 22.19.0 or newer. The included CI pins Node 22.23.2; the container pins Node 24.19.0 on Debian Bookworm slim.

## Included packages

- `pi-sub-agent@0.1.5`
- `pi-mcp-adapter@2.20.1`
- `@juicesharp/rpiv-todo@2.1.0`
- `pi-lsp-adapter@0.1.3`
- `@dreki-gg/pi-doc-search@0.3.2`
- `@bytetrue/pi-web-search@0.1.3`

The project MCP configuration pins `@playwright/mcp@0.0.79` and exposes a restricted browser tool set through the single `mcp` proxy.

## First startup

```bash
./p
```

The repository launcher passes Pi's official `--approve` trust override, so it loads project resources and installs missing pinned packages without a trust prompt. Use `PI_PROJECT_TRUST=ask ./p` only when you intentionally want the interactive trust decision.

Reload after package changes:

```text
/reload
```

Validate the repository configuration:

```bash
bash scripts/pi-doctor.sh
```

## Todo panel

Confirm the extension:

```text
/todos
```

Use todos only for genuinely multi-step work.

## MCP and Playwright browser tools

Check the adapter:

```text
/mcp status
```

The Playwright server is lazy. It starts only on the first browser-tool call and stops after an idle period.

A useful smoke request is:

```text
Use the mcp proxy to find the Playwright page snapshot tool. Do not navigate anywhere.
```

For actual browser QA, start the project's local application and navigate to its URL. Begin with accessibility snapshots; use screenshots when appearance materially matters. Screenshots are stored under `.artifacts/playwright/`.

Autonomous mode exposes focused `browser_evaluate` when snapshots and normal interactions cannot reveal the required state. File upload, drag-and-drop file injection, and MCP scripting remain unavailable. `PI_GUARD_MODE=strict` disables page evaluation and restricts navigation to localhost.

If Playwright reports that no browser executable is available, install Chromium once outside the normal agent session:

```bash
npx -y playwright install chromium
```

Use the browser version already installed by a real project when possible.

### Visual evidence with a text-only primary

The default project model is text-only. The workflow does not install or call a separate image model.

Use browser-observable evidence first: accessibility snapshots, DOM structure, element geometry, computed state, console output, network evidence, and deterministic browser tests. Screenshots may still be captured as reproducible artifacts for human review or for a primary model that is explicitly switched to an image-capable model.

Do not claim pixel-level or aesthetic screenshot findings that the active model cannot actually inspect. Mark those acceptance criteria `UNPROVEN` and report the saved screenshot path instead.

## Language server setup

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

## Documentation search

`pi-doc-search` queries Context7 directly and keeps a persistent local cache. It works without a key at lower rate limits. For higher limits, set the key in your shell or user environment, never in the repository:

```bash
export CONTEXT7_API_KEY="<your-context7-key>"
```

Use `doc_search_resolve_library_id`, `doc_search_get_library_docs`, and `doc_search_get_cached_doc_raw` only when local source, installed types, and repository patterns do not answer a version-sensitive framework question.

## Web search

The included search extension does not require a model-native search provider.

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

Do not commit search API keys or proxy credentials.

## Recommended smoke checks

After setup:

```text
/todos
/lsp status
/mcp status
/web --show
```

Then test capabilities with bounded requests:

```text
Use doc_search_resolve_library_id to resolve the React documentation library ID. Do not fetch broad documentation yet.
```

```text
Use the MCP proxy to locate the Playwright snapshot tool. Do not navigate.
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
