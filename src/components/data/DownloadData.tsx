"use client";
import { EXPORT_TABLES, exportUrl } from "@/lib/api";
import { useOverrides } from "@/lib/store";
import { tipProps } from "@/lib/tooltip";

const TABLE_LABEL: Record<(typeof EXPORT_TABLES)[number], string> = {
  exposure: "Exposure", hazards: "Hazard inputs", assumptions: "Assumptions", sources: "Sources",
};

function useExportTip() {
  return "Excel workbook: About, Exposure, Hazard inputs, Assumptions and Sources. Physical risk only, using the assumptions you are viewing.";
}

/** "Download data" button (.xlsx) with optional CSV links underneath. */
export function DownloadDataButton({ csv = true }: { csv?: boolean }) {
  const overrides = useOverrides();
  const tip = useExportTip();
  return (
    <div className="no-print flex flex-col items-start gap-1 sm:items-end">
      <a href={exportUrl("xlsx", overrides)} download {...tipProps(tip)}
        className="inline-flex items-center gap-2 rounded-pill border border-ink px-4 py-2 text-small font-medium text-ink transition-colors hover:bg-ink hover:text-bg">
        <DownloadIcon /> Download data
      </a>
      {csv && (
        <p className="text-micro tracking-normal text-muted">
          or CSV:{" "}
          {EXPORT_TABLES.map((t, i) => (
            <span key={t}>
              {i > 0 && " · "}
              <a href={exportUrl(t, overrides)} download className="text-accent underline-offset-4 hover:underline">{TABLE_LABEL[t]}</a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
    </svg>
  );
}
