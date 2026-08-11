/**
 * Theme toggle (DESIGN §7.3) — framework-free.
 * - OS default via CSS media query; explicit override only is persisted.
 * - The inline head snippet sets `data-theme` before first paint; this
 *   module only reacts to user intent and system changes while unset.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "noveno-theme";

export function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function effectiveTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function clearOverride(): void {
  document.documentElement.removeAttribute("data-theme");
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* storage unavailable — attribute-only mode still works */
  }
}

/**
 * Wire one theme toggle button. `aria-pressed` reflects the effective
 * dark state (true = dark active); the visible label announces the
 * current state per DESIGN §7.3. Returns an unsubscribe function.
 */
export function initThemeToggle(button: HTMLButtonElement): () => void {
  const label = button.getAttribute("data-theme-label");
  const iconLight = button.querySelector("[data-theme-icon-light]");
  const iconDark = button.querySelector("[data-theme-icon-dark]");

  function sync() {
    const dark = effectiveTheme() === "dark";
    button.setAttribute("aria-pressed", String(dark));
    if (label !== null) {
      button.setAttribute("aria-label", dark ? "حالت تاریک فعال است؛ روشن کردن" : "حالت روشن فعال است؛ تاریک کردن");
    }
    if (iconLight && iconDark) {
      iconLight.setAttribute("aria-hidden", String(dark));
      iconDark.setAttribute("aria-hidden", String(!dark));
      (iconLight as SVGElement).style.display = dark ? "none" : "block";
      (iconDark as SVGElement).style.display = dark ? "block" : "none";
    }
  }

  function toggle() {
    const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* override stays in-memory for this page view */
    }
    sync();
  }

  const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    // Follow the OS only while the visitor has no explicit override.
    if (!readStoredTheme()) {
      if (systemQuery.matches) applyTheme("dark");
      else clearOverride();
      sync();
    }
  };

  button.addEventListener("click", toggle);
  systemQuery.addEventListener("change", onSystemChange);
  sync();

  return () => {
    button.removeEventListener("click", toggle);
    systemQuery.removeEventListener("change", onSystemChange);
  };
}
