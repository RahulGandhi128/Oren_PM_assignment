const crFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mtFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

const DASH = "—";
export const formatCr = (v: number | null) => (v == null ? DASH : `₹${crFmt.format(v)} cr`);
export const formatMt = (v: number | null) => (v == null ? DASH : `${mtFmt.format(v)} Mt`);
export const formatInt = (v: number | null) => (v == null ? DASH : intFmt.format(v));

const oneDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatDays = (v: number | null) => (v == null ? DASH : oneDp.format(v));
export const formatNum1 = (v: number | null) => (v == null ? DASH : oneDp.format(v));
export const formatPct = (v: number | null, signed = true) => (v == null ? DASH : `${signed && v > 0 ? "+" : ""}${oneDp.format(v)}%`);

/** Numeric value for geometry/sorting; placeholders count as 0. */
export const num = (v: { value: number | null }) => v.value ?? 0;

/** Whole crore, for headlines and chart labels: "₹301 cr". */
export const formatCr0 = (v: number | null) => (v == null ? DASH : `₹${intFmt.format(v)} cr`);
/** Counts in Indian grouping, rounded to the nearest hundred above 10,000 (e.g. "1,85,000"). */
const enIN = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const formatCount = (v: number | null) => (v == null ? DASH : enIN.format(v >= 10000 ? Math.round(v / 100) * 100 : Math.round(v)));
