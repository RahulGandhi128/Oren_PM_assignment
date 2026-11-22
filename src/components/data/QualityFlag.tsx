"use client";
import Link from "next/link";
import { useIssues, worstSeverity, type Severity } from "@/lib/issues";

const ICON_CLASS: Record<Severity, string> = {
  info: "text-quality-info",
  warning: "text-quality-warning",
  danger: "text-quality-danger",
};
const SEVERITY_LABEL: Record<Severity, string> = { info: "Note", warning: "Warning", danger: "Data problem" };

/** Warning triangle / danger octagon. Pure SVG so it prints and scales with text. */
export function SeverityIcon({ severity, size = 14 }: { severity: Severity; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className={`shrink-0 ${ICON_CLASS[severity]}`}>
      {severity === "danger" ? (
        <path d="M5.2 1h5.6L15 5.2v5.6L10.8 15H5.2L1 10.8V5.2Z" fill="currentColor" />
      ) : severity === "warning" ? (
        <path d="M8 1.2 15.2 14H.8Z" fill="currentColor" strokeLinejoin="round" />
      ) : (
        <circle cx="8" cy="8" r="7" fill="currentColor" />
      )}
      {severity === "info" ? (
        <path d="M8 7v4.5M8 4.5v.5" className="stroke-surface" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d={severity === "warning" ? "M8 6v3.6M8 11.6v.4" : "M8 4.5v4.6M8 11.2v.4"} className="stroke-surface" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Shows the most severe issue touching a value. Hover lists every issue;
 * click goes to the Issues & notes page. Renders nothing when there are no flags.
 */
export function QualityFlag({ flags, size = 14 }: { flags?: string[] | null; size?: number }) {
  const issues = useIssues();
  if (!flags?.length) return null;
  const list = flags.map((f) => issues.get(f)).filter((i): i is NonNullable<typeof i> => Boolean(i));
  const sev = worstSeverity(list) ?? "warning";
  const tip = list.length
    ? list.map((i) => `${SEVERITY_LABEL[i.severity]}: ${i.title}`).join("\n") + "\n(click for details)"
    : `${flags.length} data note(s)`;
  return (
    <Link
      href={`/issues#${list.find((i) => i.severity === sev)?.id ?? flags[0]}`}
      title={tip}
      aria-label={`${SEVERITY_LABEL[sev]}. ${tip}`}
      className="inline-flex items-center align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      <SeverityIcon severity={sev} size={size} />
    </Link>
  );
}

export { SEVERITY_LABEL };
