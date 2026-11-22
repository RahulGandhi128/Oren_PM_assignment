import type { Metadata } from "next";
import { BoardPack } from "@/components/report/BoardPack";
import { TourLayer } from "@/components/tour/TourLayer";
import { TourPrompt } from "@/components/tour/TourControls";
import "./globals.css";
import { fontVariableClasses } from "@/theme/fonts";
import { tokensToCss } from "@/theme/generate-css";
import { TopBar } from "@/components/shell/TopBar";
import { Footer } from "@/components/shell/Footer";
import { OverridesBanner } from "@/components/shell/OverridesBanner";
import { SideRail } from "@/components/shell/SideRail";
import { SubHeader } from "@/components/shell/SubHeader";
import { TooltipLayer } from "@/components/ui/TooltipLayer";

export const metadata: Metadata = {
  title: "Horizon · Nimbus Cement climate exposure",
  description: "Physical climate exposure of Nimbus Cement's 9 plants, today and in 2040.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-theme="light" className={fontVariableClasses}>
      <head>
        <style id="horizon-tokens" dangerouslySetInnerHTML={{ __html: tokensToCss() }} />
      </head>
      <body className="min-h-screen bg-bg text-ink">
        <TopBar />
        <div className="flex">
          <SideRail />
          <div className="min-w-0 flex-1 print:block">
            <OverridesBanner />
            <SubHeader />
            <main className="mx-auto max-w-page px-gutter py-6 print:max-w-none print:p-0">{children}</main>
            <Footer />
          </div>
        </div>
        <TooltipLayer />
        <TourLayer />
        <TourPrompt />
        <BoardPack />
      </body>
    </html>
  );
}
