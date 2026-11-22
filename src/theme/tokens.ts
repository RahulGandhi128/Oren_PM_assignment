// src/theme/tokens.ts — THE aesthetics file. The only place visual values live.
// Visual language follows the Oren dashboard reference (clean white cards, navy ink,
// muted pastel chart series, small red/green change pills). Colours sampled from the reference.
export const tokens = {
  font: {
    display: "var(--font-display)", // Inter, bold — headings and big numbers
    serif: "var(--font-serif)",     // Instrument Serif — editorial headlines (Overview hero, finding cards)
    sans: "var(--font-sans)",       // Inter — UI and body
    mono: "var(--font-mono)",       // Geist Mono — source IDs, codes
    numericFeatures: '"tnum" 1, "lnum" 1', // tabular figures for all numbers
  },
  weight: { display: "700", heading: "600", serif: "400" },
  type: {
    // size / line-height / letter-spacing
    hero:    { size: "2rem",     line: "1.2",  tracking: "-0.015em" },
    serif:   { size: "2.5rem",   line: "1.12", tracking: "-0.01em" },  // Overview headline (serif)
    h1:      { size: "1.5rem",   line: "1.25", tracking: "-0.01em" },
    h2:      { size: "1.125rem", line: "1.35", tracking: "-0.005em" },
    h3:      { size: "0.9375rem",line: "1.4",  tracking: "0" },
    body:    { size: "0.875rem", line: "1.55", tracking: "0" },
    small:   { size: "0.8125rem",line: "1.5",  tracking: "0" },
    micro:   { size: "0.6875rem",line: "1.4",  tracking: "0.03em" },
    figure:  { size: "1.75rem",  line: "1.1",  tracking: "-0.01em" }, // KPI numbers
  },
  color: {
    light: {
      bg:        "#FDFDFD", // page
      surface:   "#FFFFFF", // cards
      surface2:  "#F7F8FA", // card headers, tiles on hover, map panel
      ink:       "#1F2951", // navy: numbers, titles
      ink2:      "#3D426B", // secondary text, legends
      muted:     "#82849C", // inactive tabs, captions
      border:    "#E9E9EC", // tile borders
      borderStrong: "#DADBDF", // card borders, inputs
      accent:    "#212B53", // navy: active nav tile, primary buttons, selected state
      accentSoft:"#EEF0F6",
      focusRing: "#4CA8F8",
      scrim:     "rgba(14,19,37,0.55)", // tour backdrop
    },
    dark: {
      bg: "#0E1325", surface: "#151B31", surface2: "#1B223D",
      ink: "#EEF0F7", ink2: "#C3C7D9", muted: "#8A8FA8",
      border: "#262D4A", borderStrong: "#343C5E",
      accent: "#9AA8E8", accentSoft: "#232B4D", focusRing: "#4CA8F8", scrim: "rgba(0,0,0,0.6)",
    },
    // Risk scale: sequential and still ordered in greyscale (light → dark)
    risk: {
      low:      "#E3E6EE",
      moderate: "#F4D27A",
      high:     "#E0894A",
      severe:   "#C4433F",
      critical: "#7A1F1F", // reserved; v1 uses 4 bands, critical only for stress-test peaks
    },
    // Hazard identity colours (icons, legends, chart marks). Validated with the dataviz
    // palette checker: lightness band, chroma floor, CVD and normal-vision separation all pass.
    hazard: {
      heat:    "#C77A26",
      water:   "#2F7FD0",
      flood:   "#2E9B5F",
      coastal: "#A0529E",
    },
    // Chart series, in the reference's order
    series: {
      sand:   "#E0AB68",
      aqua:   "#BFEBEE",
      mint:   "#AADCA1",
      slate:  "#838EB7",
      yellow: "#F4DA7A",
      blue:   "#4CA8F8",
      teal:   "#2F6E73",
      burnt:  "#CB7D2E",
      pink:   "#F2A8CA",
      steel:  "#487093",
    },
    // Change pills: up = risk rises (red), down = risk falls (green)
    delta: {
      upBg: "#FAE6E7", upBorder: "#EEC9C9", upText: "#C2413D",
      downBg: "#E9F6ED", downBorder: "#C5D8CE", downText: "#316139",
    },
    provenance: {
      data:        "#212B53", // solid chip
      derived:     "#487093", // solid chip
      assumption:  "#B8741F", // dashed outline chip
      placeholder: "#C4433F", // striped chip, must be gone before submission
    },
    // Data-quality indicators (issues page, warning/danger signs next to affected numbers)
    quality: {
      info:    "#487093",
      warning: "#B8741F",
      danger:  "#C2413D",
      warningSoft: "#FDF4E7",
      dangerSoft:  "#FAE6E7",
    },
    chart: {
      today: "#A9B0C8",  // baseline
      future:"#212B53",  // 2040
      grid:  "#EEF0F4",
      axis:  "#8A8FA3",
      low:   "#3E6FA8",  // tornado: assumption at its minimum
      high:  "#B8741F",  // tornado: assumption at its maximum
    },
  },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "24px", 6: "32px", 7: "48px", 8: "64px", 9: "96px" },
  radius: { sm: "4px", md: "6px", lg: "8px", pill: "999px" },
  shadow: {
    card:  "0 1px 2px rgba(31,41,81,0.04)",
    lift:  "0 4px 8px rgba(31,41,81,0.06), 0 16px 32px rgba(31,41,81,0.12)",
    spotlight: "0 0 0 9999px rgba(14,19,37,0.55)", // tour: dims everything outside the highlighted element
  },
  motion: {
    fast: "120ms", base: "220ms", slow: "420ms",
    ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    numberTweenMs: 600,
  },
  layout: {
    maxWidth: "1280px", gutter: "32px", topBarHeight: "56px", railWidth: "64px",
    // Board pack sheet: A4 with the print margin (spec §10 page 6)
    a4Width: "210mm", a4Height: "297mm", a4Margin: "15mm",
  },
} as const;

export type Tokens = typeof tokens;
