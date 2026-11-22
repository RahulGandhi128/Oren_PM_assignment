// Font loaders. tokens.font.* reference the CSS variables exposed here.
import { Inter, Instrument_Serif } from "next/font/google";
import { GeistMono } from "geist/font/mono";

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
  display: "swap",
});

/** Class names to put on <html> so the font variables exist. */
export const fontVariableClasses = [inter.variable, serif.variable, GeistMono.variable].join(" ");

/** Map loader variables to the token names. Display and body are both Inter (weights differ). */
export const fontAliases = {
  "--font-display": "var(--font-inter)",
  "--font-sans": "var(--font-inter)",
  "--font-serif": "var(--font-instrument-serif)",
  "--font-mono": "var(--font-geist-mono)",
} as const;
