/**
 * Mobile menu (DESIGN §8, §9.2) — framework-free.
 * - trigger (≤44px) toggles the panel; Escape closes; focus returns to
 *   the trigger; the panel is hidden from the a11y tree while closed.
 * - The mobile sticky header keeps its CTA outside the panel.
 */
export function initMobileMenu(
  trigger: HTMLButtonElement,
  panel: HTMLElement,
  close: () => void,
): () => void {
  let open = false;

  function setOpen(next: boolean) {
    open = next;
    trigger.setAttribute("aria-expanded", String(next));
    panel.hidden = !next;
    if (next) {
      const first = panel.querySelector<HTMLElement>("a, button");
      first?.focus();
    } else {
      trigger.focus();
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
    close();
  };
}
