"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreMenu } from "./MoreMenu";
import { StatusPill } from "./StatusPill";
import { TourButton } from "@/components/tour/TourControls";
import { pageTitle } from "./navItems";

/** White header: Oren logo, current page title, status pill, ⋯ menu (Report, Download data). */
export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-40 h-topbar border-b border-border-strong bg-surface">
      <div className="flex h-full items-center gap-4 pr-gutter">
        <Link href="/" className="flex h-full shrink-0 items-center pl-4 pr-2" aria-label="Oren · Horizon home">
          <Image src="/brand/oren-logo.png" alt="Oren" width={172} height={76} priority className="h-[1.75rem] w-auto" />
        </Link>
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <span className="truncate text-h2 font-bold text-ink">{pageTitle(pathname)}</span>
          <span className="hidden truncate text-small text-muted sm:inline">Horizon · Nimbus Cement climate exposure</span>
        </div>
        <TourButton />
        <StatusPill />
        <MoreMenu />
      </div>
    </header>
  );
}
