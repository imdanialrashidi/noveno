/**
 * Work portfolio filter by industry (plan 030) — client-side, query-param hydrated.
 *
 * - Renders all entries static (SEO intact), hides non-matching rows via `hidden`.
 * - Query param `?industry=` shareable; `history.replaceState` without reload.
 * - Progressive enhancement: no-JS shows all, with JS hydrates filter.
 * - Buttons use aria-pressed, group has role=group.
 */

export function initWorkFilter(root: HTMLElement): void {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-industry-filter]")];
  if (buttons.length === 0) return;
  const rows = [...document.querySelectorAll<HTMLElement>("[data-industry]")];
  const empty = document.getElementById("work-empty") as HTMLElement | null;
  const industries = new Set(buttons.map((b) => b.getAttribute("data-industry-filter") ?? ""));

  const apply = (industry: string) => {
    const normalized = industries.has(industry) ? industry : "all";
    for (const b of buttons) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-industry-filter") === normalized));
    }
    let visible = 0;
    for (const r of rows) {
      const match = normalized === "all" || r.getAttribute("data-industry") === normalized;
      r.hidden = !match;
      if (match) visible += 1;
    }
    if (empty) empty.hidden = visible !== 0;
    const url = new URL(location.href);
    if (normalized === "all") url.searchParams.delete("industry");
    else url.searchParams.set("industry", normalized);
    history.replaceState(null, "", url.toString());
  };

  const initial = new URLSearchParams(location.search).get("industry") ?? "all";
  apply(initial);

  for (const b of buttons) {
    b.addEventListener("click", () => apply(b.getAttribute("data-industry-filter") ?? "all"));
  }
}
