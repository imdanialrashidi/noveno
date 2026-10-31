# Ops Runbook — Noveno (static, GitHub Pages)

Operating notes for a **static** site. There is no server to restart, no
database to restore, and no Cloudflare project to roll back. The deploy
surface is one GitHub Actions workflow; the only external dependency at
runtime is Web3Forms (lead email) and the browser's own network.

## Deploy pipeline

`push to main` → `.github/workflows/quality.yml`:

1. `verify` job — format check, canonical gate, build, tests.
2. `deploy` job — uploads `dist/` and deploys to GitHub Pages.

If `verify` fails, **deploy does not run** and the live site keeps the last
successful artifact. Check the Actions run first for any "site is stale" report.

## Symptom → action

| Symptom                                              | Likely cause                                                                      | Action                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Push landed but the site did not change              | `verify` job failed before deploy                                                 | Open the run, fix the failing step, push again                                                         |
| `last-modified` on `/` is old                        | No successful deploy since that date                                              | Compare the live `last-modified` with the latest green run                                             |
| Form shows «ثبت درخواست … در دسترس نیست» immediately | `PUBLIC_WEB3FORMS_ACCESS_KEY` was empty at build time                             | Set the Actions variable, then re-run the workflow                                                     |
| Form shows «ارسال نشد» / delivery banner             | Web3Forms rejected the POST, returned `success:false`, 429, or the network failed | Check Web3Forms dashboard/status, retry; the draft is preserved and the visitor can use direct contact |
| Form shows the rate banner                           | Web3Forms rate limited the key                                                    | Wait; rotate the key if it persists                                                                    |
| 404 on a route that exists in the repo               | Old deploy or build error                                                         | Check the run and the built `dist/`                                                                    |
| `http://noveno.ir` serves the site                   | Enforce HTTPS is off                                                              | Settings → Pages → Enforce HTTPS                                                                       |
| Legacy `/insights/...` link shows 404                | Expected — GitHub Pages cannot 301                                                | The 404 page forwards visitors to `/blog/...` client-side                                              |

## Lead delivery

- Destination: the Web3Forms access key's inbox. Nothing is stored by the site.
- Each submit carries `submission_id` and `delivery_attempt`. Duplicate emails
  with the same `submission_id` are the same journey retried (the client does
  at most 2 automatic attempts; a manual retry adds one more).
- The client never presents success unless Web3Forms returns `{ success: true }`.

## Rotating or revoking the Web3Forms key

1. Create/rotate the key in the Web3Forms dashboard.
2. Update **Settings → Secrets and variables → Actions → Variables →
   `PUBLIC_WEB3FORMS_ACCESS_KEY`**.
3. Re-run the `quality` workflow (or push) so the new key is baked into the
   build; the old key stays in previously built JS until then.

## Rollback

Revert the offending commit on `main` and let the workflow rebuild, or re-run
a known-good workflow run. GitHub Pages keeps serving the previous artifact
until the new deployment finishes.

## Do not

- Do not re-add Turnstile, a CSP header file, or an `/api/*` function without
  accepting a hosting change: GitHub Pages cannot run or honor them, and a
  client-only Turnstile widget would imply a verification that does not exist.
- Do not describe the form as server-validated in product copy, docs, or the
  privacy page.
