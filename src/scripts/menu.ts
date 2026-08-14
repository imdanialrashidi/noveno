/**
 * Mobile menu (DESIGN §8, §9.2) — framework-free.
 * - trigger (≤44px) toggles the panel; Escape closes; focus returns to
 *   the trigger; the panel is hidden from the a11y tree while closed.
 * - The mobile sticky header keeps its CTA outside the panel.
 * - Open/close is a lightweight opacity+translate transition (motion
 *   layer); `hidden` is applied only AFTER the close transition ends so
 *   the fade-out is never cut by display:none. Reduced motion zeroes
 *   the durations in CSS, so the panel still toggles instantly.
 */
export function initMobileMenu(
  trigger: HTMLButtonElement,
  panel: HTMLElement,
  close: () => void,
): () => void {
  let open = false;
  let closeTimer: number | undefined;

  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    trigger.setAttribute("aria-expanded", String(next));
    window.clearTimeout(closeTimer);

    if (next) {
      panel.hidden = false;
      // Let the browser compute the initial (hidden) style first, then
      // transition to the open state — never a flash of the final state.
      // Focus must move inside the same frame: focusing an element right
      // after removing `hidden` can fail because the style recalc has not
      // run yet (measured: focus stayed on the trigger).
      requestAnimationFrame(() => {
        panel.classList.add("menu-open");
        const first = panel.querySelector<HTMLElement>("a, button");
        first?.focus();
      });
    } else {
      panel.classList.remove("menu-open");
      // Re-apply `hidden` after the close transition (or a bounded
      // fallback if transitionend never fires, e.g. display changes).
      const finish = () => {
        if (open) return; // reopened before the close completed
        panel.hidden = true;
        trigger.focus();
      };
      panel.addEventListener("transitionend", () => finish(), { once: true });
      closeTimer = window.setTimeout(finish, 300);
    }
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };
  const onTriggerClick = () => setOpen(!open);

  trigger.addEventListener("click", onTriggerClick);
  document.addEventListener("keydown", onKeydown);

  return () => {
    trigger.removeEventListener("click", onTriggerClick);
    document.removeEventListener("keydown", onKeydown);
    window.clearTimeout(closeTimer);
    close();
  };
}
