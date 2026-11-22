export type NavIcon = "overview" | "plants" | "network" | "methodology" | "issues" | "data" | "report";
export type NavItem = { href: string; label: string; icon: NavIcon };

/** Grouped like the reference rail: analysis · method & quality · outputs. */
export const NAV_GROUPS: NavItem[][] = [
  [
    { href: "/", label: "Overview", icon: "overview" },
    { href: "/plants", label: "Plants", icon: "plants" },
    { href: "/network", label: "Network", icon: "network" },
  ],
  [
    { href: "/methodology", label: "Methodology", icon: "methodology" },
    { href: "/issues", label: "Issues & notes", icon: "issues" },
  ],
  [
    { href: "/data", label: "Data", icon: "data" },
  ],
];

export const NAV_ITEMS = NAV_GROUPS.flat();

export function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function pageTitle(pathname: string): string {
  if (pathname.startsWith("/plants/")) return "Plant detail";
  return NAV_ITEMS.find((n) => isActive(n.href, pathname))?.label ?? "Horizon";
}
