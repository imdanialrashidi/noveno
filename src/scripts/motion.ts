/**
 * Lightweight motion layer (product-led pass) — framework-free.
 *
 * One shared IntersectionObserver drives all entrance reveals; nothing
 * else listens to scroll. Every effect is progressive enhancement:
 * content is visible by default (no-JS, no-CLS, no-LCP risk) and only
 * elements BELOW the initial viewport ever get a hidden starting state.
 *
 * Effects (the 5-behavior system, docs/DESIGN.md §12):
 *  1. `[data-reveal]`            — section/content group reveal
 *                                  (opacity + 12px translate, 450ms).
 *  2. `[data-reveal-stagger]`    — reveal container whose `[data-reveal-item]`
 *                                  children stagger via `--reveal-i`
 *                                  (set inline: style="--reveal-i: N").
 *  3. `[data-hero-stages]`       — the hero product composition's quiet
 *                                  one-shot settle (the 4-stage strip
 *                                  under the real-UI figure; transform +
 *                                  opacity only, tiny layer, painted after
 *                                  the headline and figure — LCP-safe).
 *  4. Mobile menu open/close      — orchestrated in src/scripts/menu.ts.
 *  5. Link/button + work preview  — pure CSS (global.css).
 *
 * Reduced motion: `prefers-reduced-motion: reduce` zeroes all durations
 * in CSS AND this module skips adding hidden starting states, so content
 * always renders directly in its final state.
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Hero stages settle — one quiet entrance for the strip under the hero
 * product figure. The hidden starting state is added by JS only, so
 * no-JS and reduced-motion keep the strip fully visible.
 */
export function initHeroStages(root: Document | HTMLElement = document): void {
  if (prefersReducedMotion()) return;
  const strip = root.querySelector<HTMLElement>("[data-hero-stages]");
  if (!strip) return;
  strip.classList.add("hero-stages-init");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => strip.classList.add("hero-stages-in"));
  });
}

/**
 * Reveal-below-the-fold reveals. Elements already inside the viewport at
 * init are left untouched (final state) — the hero and first screen
 * never animate, so LCP and FCP are unaffected.
 */
export function initReveal(root: Document | HTMLElement = document): void {
  if (prefersReducedMotion()) return;
  if (typeof IntersectionObserver === "undefined") return;

  const targets = [...root.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-stagger]")];
  if (targets.length === 0) return;

  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add("reveal-in");
        revealObserver.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
  );

  for (const el of targets) {
    if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
      el.classList.add("reveal-init");
      revealObserver.observe(el);
    } else {
      el.classList.add("reveal-in");
    }
  }
}

/** Stagger containers: propagate the settled state to their items. */
export function initStagger(root: Document | HTMLElement = document): void {
  if (prefersReducedMotion()) return;
  for (const group of root.querySelectorAll<HTMLElement>("[data-reveal-stagger]")) {
    group.querySelectorAll<HTMLElement>("[data-reveal-item]").forEach((item) => {
      const i = item.getAttribute("data-reveal-item");
      item.style.setProperty("--reveal-i", i ?? "0");
    });
  }
}
