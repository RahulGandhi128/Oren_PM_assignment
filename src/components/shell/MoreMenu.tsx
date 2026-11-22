"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { exportUrl } from "@/lib/api";
import { useBoardPack } from "@/lib/boardPack";
import { useOverrides } from "@/lib/store";
import { DownloadIcon } from "@/components/data/DownloadData";

const item = "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-small text-ink outline-none data-[highlighted]:bg-surface2";

/** "⋯" menu in the top bar: Report and Download data. */
export function MoreMenu() {
  const overrides = useOverrides();
  const request = useBoardPack((s) => s.request);
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger data-tour="more-menu" aria-label="More: report and data download"
        className="inline-flex h-[2.25rem] w-[2.25rem] items-center justify-center rounded-md border border-border-strong bg-surface text-ink transition-colors hover:bg-surface2 data-[state=open]:bg-accent data-[state=open]:text-surface">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6}
          className="z-50 w-[17rem] rounded-lg border border-border-strong bg-surface p-1 shadow-lift">
          <Menu.Item onSelect={request} className={item}>
            <BoardIcon />
            <span className="flex flex-col">
              <span className="font-medium">Report</span>
              <span className="text-micro tracking-normal text-muted">Print one A4 page, or save it as a PDF</span>
            </span>
          </Menu.Item>
          <Menu.Item asChild>
            <a href={exportUrl("xlsx", overrides)} download className={item}>
              <span className="mt-[0.125rem]"><DownloadIcon size={16} /></span>
              <span className="flex flex-col">
                <span className="font-medium">Download data</span>
                <span className="text-micro tracking-normal text-muted">Excel file with the numbers and inputs</span>
              </span>
            </a>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function BoardIcon() {
  return (
    <svg className="mt-[0.125rem] shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M4 1.5h5.5L12.5 4.5v10h-8.5z" /><path d="M9.5 1.5v3h3M6.5 8h4M6.5 10.5h4" />
    </svg>
  );
}
