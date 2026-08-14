# Changelog

All notable workflow changes are documented here. This project follows the spirit of Keep a Changelog; versioning begins when the first release is tagged.

## Unreleased

### Added

- **Contact points designed (2026-08-14):** new monoline channel icon set (`Icon`: phone, whatsapp, telegram, email, instagram) and `ChannelLink` (inline / row / tile variants) — footer list rows with hover-fill chips, mobile-menu contact tiles (full-width call row + 2×2 channel grid), contact-page rows with 56px icon tiles, audit rail/banners/thank-you inline links, phone icons inside CTA/FAQ/contact buttons; tokens + `data-event` analytics preserved.
- **Image-led editorial redesign (2026-08-14, founder-directed):** the flowchart/route visual language (JourneyLine, LeadStatusStrip, SystemArchitectureDiagram, scatter fields, route-band hero, station rails, route motifs) was removed from the public design and replaced by Typography + Photography + Real Product Screens + Editorial Numbers — new hero photo composition, homepage media rhythm (~6 moments), editorial numerals (۰۱–۰۶), designed concept previews (labeled «نمونه نمایشی»), audit progress as «مرحله X از ۶» + progress bar, numbered thank-you next steps, typographic 404, re-captured real work screenshots, CC0 photography with caption provenance, `docs/IMAGERY.md` registry, and an updated `docs/DESIGN.md` contract.
- Behavioral coverage for autonomous/strict guard modes and launcher trust overrides.
- Product design contract, distinctive frontend-design skill, visual hard gates, and scored craft rubric.
- Idea-to-production prompts: discover, design, spec, ADR, build UI, design review, release plan, and incident response.
- Evidence-gated product roadmap template.
- Safety-guard behavior tests and a contained Docker launcher.
- Security reporting and dependency-review policy.
- `test-design` and `/test` workflows with red/pre-fix defect-sensitivity guidance.
- Deterministic affected-file verification routing with a conservative full-gate fallback.
- Workflow eval schema v2 with executable assertions, trace metrics, baseline comparison, and a real code/test repair fixture.
- Primary-source research and audit record in `docs/RESEARCH.md`.

### Changed

- Made `./p` trust the checked-out project and run autonomously by default: routine workflow edits, task-branch Git delivery, public browser navigation, and focused page evaluation no longer require intermediate approval; the optional Docker launcher selects strict mode.
- Narrowed the safety guard to high-blast-radius actions such as secret access, destructive host/Git commands, force/deleting pushes, publication/deployment/production mutation, and browser file exfiltration.
- Replaced archived `pi-context7` with maintained `pi-doc-search`.
- Removed delegated image-analysis extensions, model configuration, tools, and workflow guidance; browser QA now relies on browser-native evidence and saved screenshots as artifacts.
- Removed the template's forced model/provider selection.
- Pinned Pi installation guidance and GitHub Actions by immutable revision.
- Raised browser QA, accessibility, responsive, and Core Web Vitals requirements for visual work.
- Made the canonical full verification gate validate the template before product source is bootstrapped.
- Reduced duplicate always-loaded policy and added a combined context-size ratchet.
