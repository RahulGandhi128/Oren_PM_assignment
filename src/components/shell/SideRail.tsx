"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { tipProps } from "@/lib/tooltip";
import { NavIcon } from "./NavIcon";
import { isActive, NAV_GROUPS } from "./navItems";

/** Left icon rail (desktop). Active page = navy tile with white icon, as in the reference. */
export function SideRail() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" data-tour="side-rail" className="no-print sticky top-topbar hidden h-[calc(100vh-var(--hz-layout-top-bar-height))] w-rail shrink-0 flex-col items-center gap-3 border-r border-border-strong bg-surface py-4 md:flex">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className={`flex flex-col items-center gap-2 ${gi > 0 ? "w-full border-t hairline pt-3" : ""}`}>
          {group.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link key={item.href} href={item.href} aria-label={item.label} {...tipProps(item.label)}
                aria-current={active ? "page" : undefined}
                className={`flex size-6 items-center justify-center rounded-md transition-colors ${active ? "bg-accent text-surface" : "text-ink hover:bg-accent-soft"}`}>
                <NavIcon name={item.icon} />
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
