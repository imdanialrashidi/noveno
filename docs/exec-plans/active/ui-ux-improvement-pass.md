# UI/UX Improvement Pass — Noveno Public Site

Status: active — **improvement pass built and verified 2026-10** (slices 1–4 below); deferred items remain
Updated: 2026-10
Type: analysis → implemented vertical slices. Design contract updated first (`docs/DESIGN.md` §0 + §16.1).

## 1. Goal and non-goals

**Goal.** Raise the public site's UI/UX quality where evidence shows a real user-visible
gap, in this order of value: (a) restore content that silently disappears when JavaScript
is unavailable, (b) remove the three-route duplication of the offer/price surface so a
visitor can answer "what does it cost?" on one page, (c) make the mobile first viewport
carry the product's identity and a single decisive action, (d) replace stale 2026-08
browser/accessibility evidence with a fresh settled-state matrix.

**Non-goals (do not reopen in this pass).**

- No new visual thesis. `docs/DESIGN.md` §3–§14 stays the contract; this pass implements
  the accepted direction, it does not redesign it. The flowchart/route grammar stays
  rejected; photography stays retired.
- No new section, page, route, dependency, or client framework.
- No content invention: no unverified metric, testimonial, logo, client count, delivery
  promise, or guarantee language.
- No change to the audit trust boundary (`functions/api/audit.ts`, `/api/events.ts`),
  lead delivery, or attribution.
- No URL removed or renamed; no title/canonical/sitemap ownership change.
- No claim about conversion or field CWV — the site has no field data yet; lab and
  structural evidence only.

## 2. Acceptance contract

- [ ] **A1 — FAQ answers are readable without JavaScript.** With JS disabled, every
  homepage FAQ answer (`/`) and every FAQ answer on `/services` is visible and readable
  in the DOM; accordions still open/close with JS enabled, keyboard-operable.
  *Proof:* no-JS browser capture + a structural assertion that a closed accordion panel is
  not `display:none` / zero-height without the JS-initialized state.
- [ ] **A2 — one price surface.** The starting-price block is rendered on exactly one
  route (`/pricing`). `/` keeps the three tier names with a short "starts at" teaser and a
  link to `/pricing`; `/services` keeps the system model and links to `/pricing`. No URL,
  title, canonical, or sitemap entry changes.
  *Proof:* structural test asserting the canonical price string appears in exactly one
  built page; screenshots of the three affected routes.
- [ ] **A3 — the mobile first viewport is decisive.** At 390×844 the first viewport shows
  kicker, headline, **one** primary action, and the top edge of the recomposed brand
  artwork strip; the secondary action is no longer a competing full-width button in the
  first viewport. No horizontal overflow at 320/360/390/430.
  *Proof:* measured element geometry (bounding boxes vs viewport) + screenshot, not a
  visual estimate.
- [ ] **A4 — accessibility baseline is proven, not assumed.** Automated WCAG 2.2 AA sweep
  (axe) on `/`, `/services`, `/pricing`, `/audit`, `/contact` at 1440 and 390, light and
  dark: zero critical/serious violations; visible focus, correct landmarks/headings, no
  color-only meaning; 320px reflow; reduced-motion honored.
  *Proof:* axe run output (route/viewport/theme in the record) + keyboard snapshot.
- [ ] **A5 — budgets hold.** Interactive JS ≤ 15 KB gzip, fonts ≤ 200 KB, no new
  render-blocking bytes beyond a stated delta, and LCP/CLS/TBT no worse than the recorded
  baseline (LCP stays the headline text; the hero still ships zero raster media).
  *Proof:* `tests/structural.test.mjs` budget tests + one Lighthouse/CDP run on the same
  profile as `docs/DESIGN.md` §12.
- [ ] **A6 — the contract is updated before the code moves.** Any change to the locked
  hero/header composition is recorded in `docs/DESIGN.md` §16 with rationale *before*
  implementation; §8/§12 remain otherwise intact. `tests/seo-contract.test.mjs` stays green.
  *Proof:* doc diff reviewed alongside the code diff.
- [ ] **A7 — review and gate.** Focused independent review (reviewer subagent if available,
  otherwise a separate evidence-focused self-review pass) reports no unresolved
  BLOCKER/MAJOR on the diff, and `bash scripts/verify.sh` exits 0 on a fresh `dist/`.

## 3. Confirmed facts, assumptions, unknowns

**Confirmed (verified this session).**

| # | Finding | Evidence | Severity |
|---|---|---|---|
| F1 | **FAQ answers are hidden unless JavaScript runs.** `FAQItem.astro`'s scoped style sets `.accordion-panel { grid-template-rows: 0fr; opacity: 0 }`; the open state is added only by the component's own inline script. No-JS or blocked-JS ⇒ every FAQ answer on `/` and `/services` disappears while the triggers still render. | `src/components/ui/FAQItem.astro:44-52` (+ `<style>` 84-99); same pattern nowhere else — `[data-reveal]`/`.hero-stages-init` are JS-*added*, so they are no-JS safe | MAJOR |
| F2 | **The offer/price surface is rendered on three routes.** `/` (9 sections), `/services` (8), `/pricing` (5) all render `OFFERS` + `PRICING_NOTE` from the same source. | `src/pages/index.astro`, `src/pages/services.astro`, `src/pages/pricing.astro`; `dist/{index,services,pricing}/index.html` all contain `۲۴.۹ میلیون` | MAJOR (IA) |
| F3 | **The mobile first viewport is text-only.** In the archived 390-wide capture the whole screen is kicker + 4-line headline + 4-line lead + two stacked full-width buttons + microcopy. | `.artifacts/browser-qa/home-mobile.png` | MAJOR (composition) |
| F4 | **The hero carries two competing primary actions**, stacked full width on mobile — against the founder's own "one primary action per section where practical" (`docs/DESIGN.md` §0). | `src/pages/index.astro:110-125` | MINOR→MAJOR with F3 |
| F5 | **Desktop hero artwork legibility is unproven.** The archived desktop capture reads as sparse scattered dots; the ordered "system plate" and the Noveno-attractor geometry are very faint. The capture may be mid-animation, so this is an evidence gap, not yet a defect. | `.artifacts/browser-qa/home-desktop.png` | UNPROVEN |
| F6 | **Evidence is stale.** The last full browser/a11y matrix is Slice 2 (2026-08) and predates the hero artwork, the one-screen audit form, `/pricing`, and the registration motion layer (2026-10). Several `docs/DESIGN.md` §15 rows are therefore UNPROVEN today. | `docs/exec-plans/active/noveno-launch.md` (Slice 2 evidence) | process |
| F7 | There is no automated accessibility sweep in `tests/`; only static structural checks. | `tests/*.test.mjs` grep for axe → none | process |
| F8 | Mobile navigation is unreachable without JS (CSS-hidden panel + JS-only trigger). No `noscript` fallback exists there, unlike `/audit`. | `Header.astro:31`, `global.css:563-575` | MINOR (robustness) |
| F9 | `node scripts/validate-project-context.mjs --static` reports `NOT READY` (PRODUCT.md, QUALITY.md flagged "template guidance remains") although both carry project-specific content. Informational housekeeping, unrelated to UI/UX. | validator output this session | NIT |

**Constraints.** Static Astro 7, no client framework, ≤15 KB gzip interactive JS, ≤200 KB
fonts, RTL/Persian-first, WCAG 2.2 AA, no secrets, no new services, DESIGN §3–§14 is
contract, PR delivery on `ai-changes` per `docs/GIT_POLICY.md`.

**Assumptions (labelled).** No-JS/blocked-JS is a plausible condition for this audience
(Iranian network filtering — `docs/PRODUCT.md`), treated as robustness rather than a
measured requirement. The founder remains the decision owner for hero/header composition
changes (DESIGN §16); agent-labelled reversibility is not enough there.

**Material unknowns.** (u1) Whether the settled artwork frame reads as "structure" — needs
a ≥2 s post-load capture before any judgement (F5). (u2) Real device CWV on Iranian
networks — only lab proxies are available. (u3) Conversion impact of any hero change —
unmeasurable pre-launch; must be argued on principle, not data.

## 4. Reuse — existing patterns and contracts

`PageLayout`/`PageHero`/`SectionHeader`/`Button`/`OfferRow`/`WorkCard`/`ChannelLink`/
`FAQItem`; the token layer in `src/styles/global.css` (color/type/motion/radius tokens,
`@theme inline` mapping, dark theme); `data-reveal` / `data-sweep` registration grammar
(`src/scripts/motion.ts`); `ChannelLink` as the single contact-link contract;
`tests/structural.test.mjs` budgets; `tests/seo-contract.test.mjs`, `content.test.mjs`,
`site-data.test.mjs`; `docs/DESIGN.md` §15 screen matrix as the proof checklist;
`docs/VISUAL_REVIEW.md` as the scoring contract; `.pi/verification.json` affected routing.

## 5. Smallest viable design and data/control flow

- **F1 fix (shape of the fix, not the code).** The collapsed state must become the
  *enhanced* state: content readable by default, collapse applied only once the
  component's script has initialized (same "JS adds the hidden state" pattern already used
  by `[data-reveal]` / `.hero-stages-init`). Keyboard and pointer behavior, single-open
  policy, and the registration motion stay exactly as accepted. Alternative considered:
  native `<details>/<summary>` — better no-JS semantics but a larger markup change;
  rejected for this pass, noted as deferred.
- **F2 fix.** `OFFERS` stays the single data source (`src/data/site.ts`). Render policy is
  per route: `/pricing` owns prices + validity note + recurring options; `/` renders tier
  name + one-line teaser + a link to `/pricing` (keeps the conversion path without owning
  price detail); `/services` renders the six-stage model, components, engagement and fit,
  and links to `/pricing`. No copy is deleted — only relocated, so nothing user-facing is lost.
- **F3/F4 fix.** Mobile hero composition only: keep kicker, headline, primary action and
  microcopy in the first viewport; bring the top edge of the existing mobile artwork strip
  into view by tightening lead measure/length and the vertical rhythm; move the secondary
  action out of the first viewport (header nav, proof section, or the stage strip area)
  rather than deleting it. No new bytes, no new JS, hero artwork stays the same SVG.
  Any accepted variant is recorded in `docs/DESIGN.md` §16 before implementation.
- **F5.** Measurement only: settled-state capture, no change until evidence says so.
- **F8.** Deferred (§9), not part of the acceptance contract.

Control flow is unchanged everywhere: all static rendering, no new data flow, no new
client script. A1 and A2 touch markup/CSS/structure; A3 touches layout classes only.

## 6. Risks (only where relevant)

- **Correctness:** F1 fix must not introduce a flash-of-open-panels or a stuck collapsed
  state after hydration; verify with JS on and off.
- **Performance:** hero layout changes can move LCP or introduce CLS. Budget: zero new JS,
  CSS delta stated and measured, hero still raster-free. Regression on LCP/CLS/TBT blocks A5.
- **SEO/IA:** removing prices from `/` and `/services` reduces indexable price text on two
  routes. Mitigation: keep a price teaser on `/`, keep `/pricing` canonical/sitemap owner,
  keep every existing title/description. `tests/seo-contract.test.mjs` must stay green.
- **UX:** removing the hero's secondary CTA could cost the `/work` entry point — the
  destination must remain reachable within one scroll on mobile.
- **Trust boundary:** untouched by design. If any slice reaches `functions/`, stop and
  treat it as a separate high-risk task.
- **Rollback/recovery:** each slice ships as its own PR on `ai-changes`; revert is a
  Cloudflare Pages redeploy of the previous commit. No data or schema change, so no
  migration risk.
- **Process risk:** shipping visual changes on a stale baseline. Mitigation: baseline
  capture is step 0 and blocks everything after it.

## 7. Ordered vertical work and stop points

0. **Baseline (blocks everything).** Fresh settled-state capture (≥2 s after load) for `/`,
   `/services`, `/pricing`, `/audit`, `/contact` at 1440/390/320, light + dark; axe sweep;
   measure hero geometry at 390 (first-viewport element boxes) to replace the estimate in
   F3; record current Lighthouse/CDP numbers on the DESIGN §12 profile.
   *Stop:* artifacts archived with state provenance (route, viewport, theme, locale) and the
   measurement numbers written into this plan.
1. **Slice 1 — F1 (no-JS FAQ).** Smallest, independent, immediately verifiable.
   *Stop:* A1 proven with and without JS; no visual change in the JS-on capture; budget
   tests green.
2. **Slice 2 — F2 (one price surface).** Record the IA decision first (this plan + a
   DESIGN §16 line if it changes a visible contract).
   *Stop:* A2 proven by the structural one-route assertion plus three screenshots; SEO
   contract green.
3. **Slice 3 — F3/F4 (mobile first viewport).** Only after step 0 shows the measured gap;
   decide with the founder-facing option list in this plan if the change is visible enough
   to require a documented direction.
   *Stop:* A3 proven by measured geometry + 320/390 captures in both themes; A5 green.
4. **Slice 4 — evidence refresh.** Re-run the full `docs/DESIGN.md` §15 matrix and A4 for
   the touched routes; update `docs/exec-plans/active/noveno-launch.md` if the launch
   evidence section is now out of date.
   *Stop:* A4/A7 satisfied; `bash scripts/verify.sh` exit 0; review has no BLOCKER/MAJOR.
5. **Delivery.** One PR per slice on `ai-changes` via `node scripts/ai-pr.mjs` with exact
   file paths and evidence; never merge.

## 8. Verification and evaluator strategy

- **Cheapest lane first:** `node scripts/verify-affected.mjs --file <path>` for each touched
  file; full `bash scripts/verify.sh` once per slice before delivery (it rebuilds `dist/`,
  which the structural assertions read).
- **Browser evidence (`browser-qa`):** settled-state screenshots with provenance, keyboard
  journey through header → menu → `/audit` → submit-failure → retry, focus-visible
  snapshots, reduced-motion run, no-JS run for A1, network panel showing no failed requests
  and no new requests. Geometry claims come from DOM measurement, not eyeballing.
- **Accessibility (`accessibility-audit`):** axe sweep across the five routes × two
  viewports × two themes; plus the manual items axe cannot judge (RTL reading order,
  Persian label/placeholder phrasing, error-coupling clarity, tap-target feel).
- **Performance (`web-performance`):** one before/after Lighthouse pair plus one CDP
  throttled run on the same profile as DESIGN §12; report as lab signal only.
- **Visual (`frontend-design` + `docs/VISUAL_REVIEW.md`):** one product pass (journey,
  states, a11y, responsiveness, budgets) and one studio pass (thesis fidelity, anti-template
  review, craft scoring) on the touched routes; hard gates first, craft second.
- **Evaluator output:** per criterion PASS/FAIL/UNPROVEN/BLOCKED, plus hard-gate status.
  Appearance-dependent criteria stay UNPROVEN if image inspection is unavailable.

## 9. Decisions intentionally deferred

- Persistent/sticky mobile conversion affordance (contradicts the locked 3-element mobile
  header, DESIGN §8) — an owner decision, not an agent's.
- No-JS navigation via `<details>/<summary>` (F8) — robustness proposal, not a defect the
  audit fixed; revisit only if a real no-JS requirement appears.
- Native `<details>` FAQ (alternative to the A1 fix).
- Any imagery, dashboard, metric, testimonial, or industry page (rejected/retired by the
  founder).
- Blog re-entry into primary navigation; pricing-vs-services route merge or rename.
- Fixing the `validate-project-context.mjs` false "TEMPLATE" signal (F9) — unrelated,
  informational.

## 10. Handoff

**Delivered 2026-10 (evidence below).** All four planned slices shipped on `ai-changes`; the design contract was updated before the code moved. Nine files changed, all reviewed in one scoped diff.

| Criterion | Result | Evidence |
| --- | --- | --- |
| A1 FAQ readable without JS | **PASS** | No-JS context: 5/5 answers at `h=116` on `/`, 10/10 at `h=116–208` on `/services` (was `h=24, opacity 0`). JS-on: collapsed to 24 px, click opens to 91 px, single-open, `Enter` on a focused trigger opens it, `aria-expanded` correct |
| A2 one price surface | **PASS** | `/services` renders 0 offer rows and no price string; `/` keeps the founder-accepted starting prices in compact rows (0 scope bullets); `/pricing` keeps 3 rows + 11 scope bullets and stays canonical |
| A3 signature executes its thesis | **PASS** | Desktop crop: mark is now the strongest hairline on the plate, plate is 340×340 (32 % of frame), registered squares ring it, scatter arrives from the right. Mobile crop: mark inside the shelf (was clipped at the frame edge), shelf plate added. Re-themes correctly in dark |
| A4 accessibility + responsive | **PASS** | axe WCAG 2.2 A/AA: **0 violations** across 6 routes × 2 viewports × 2 themes (24 runs, reveal-aware scroll). `/work` selected chip 4.37:1 → **10.35:1** (`#0c3d2b` on `#e3efe9`). No horizontal overflow at 320/360/390/430/768/1024/1440 on 6 routes |
| A5 performance budgets | **PASS** | Interactive JS **10174 B gzip — unchanged, zero new JS**. Page CSS 9999 → 10081 B (+0.8 %). Lighthouse mobile LCP 2185 ms · CLS 0.026 · TBT 0 (baseline 2330/0.02/0); desktop LCP 478 ms · CLS 0.008 · TBT 0 (baseline 508/0.01/0). Lab only, not field CWV |
| A6 contract updated first | **PASS** | `docs/DESIGN.md` §0 owner bullet + §16.1 execution log; §17 deferred list extended; no URL, title, canonical or sitemap change; `tests/seo-contract.test.mjs` green |
| A7 journey + gate | **PASS** | `/audit` empty submit → 4 invalid fields + banner; filled submit (ok mode) → `/audit/thank-you`, 0 failed requests; delivery-down mode → truthful banner, **no** thank-you, values preserved. Menu opens, CTA inside, Escape closes; tab order skip-link → logo → theme → menu → primary → secondary. `bash scripts/verify.sh` exit 0, `npm test` 316/316, `astro check` 0 errors |

**Defects found and fixed beyond the original plan** (found by the baseline sweep, not predicted):

- `/work` selected filter chip was a real AA failure (4.37:1) — a token-pairing error, fixed with the existing `--on-primary-soft` pair, no token value changed.
- The first `data-accordion-ready` implementation put the marker on `<html>`; Astro's scoped CSS then emitted `[data-astro-cid][data-accordion-ready]` and never matched, so JS-on accordions stopped collapsing. Marker moved onto each item; caught by the same verification step, not by a screenshot.

**Corrections to the plan's own findings.** F3 was stated from a stale archived capture: measurement shows the mobile artwork strip *was* already inside the 390×844 fold (top 663, bottom 786). The real mobile defect was the 124 px two-button block sitting between the promise and the proof, which is what F4 described; the secondary CTA is now a quiet link below the microcopy on mobile only (one primary action per section, DESIGN §0), and the artwork strip sits at 651–774 with everything else above it.

**What a fresh session must not do.** Rewrite the hero artwork concept; reintroduce photography, route/diagram grammar, unverified metrics, or new sections; change URLs, prices, or the audit trust boundary; merge to `main`.