"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "./navItems";
import { WhenTabs } from "./WhenTabs";

/** Tabs row under the header: Now | 2040 on every page; page links on small screens (no rail). */
export function SubHeader() {
  const pathname = usePathname();
  return (
    <div className="no-print border-b hairline bg-bg">
      <div className="mx-auto flex max-w-page flex-wrap items-end justify-between gap-x-6 px-gutter">
        <WhenTabs />
        <nav aria-label="Pages" className="flex max-w-full gap-1 overflow-x-auto md:hidden">
          {NAV_ITEMS.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href, pathname) ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-2 py-2 text-small ${isActive(n.href, pathname) ? "border-ink text-ink" : "border-transparent text-muted"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
