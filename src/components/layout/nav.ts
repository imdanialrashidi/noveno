/**
 * Active-nav check shared by Header and MobileMenu (single source of truth).
 * Exact-match for "/", otherwise exact or prefix match (section pages stay
 * highlighted under their section's path). Matches the behavior both
 * components previously inlined byte-for-byte.
 */
export function isCurrent(href: string, pathname: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}
