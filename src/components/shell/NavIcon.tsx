import type { NavIcon as Name } from "./navItems";

/** 18×18 line icons in the reference's style (rounded, 1.6 stroke). */
export function NavIcon({ name }: { name: Name }) {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {name === "overview" && (<><rect x="2.5" y="2.5" width="5" height="5" rx="1" /><rect x="10.5" y="2.5" width="5" height="5" rx="1" /><rect x="2.5" y="10.5" width="5" height="5" rx="1" /><rect x="10.5" y="10.5" width="5" height="5" rx="1" /></>)}
      {name === "plants" && (<><path d="M9 16s-5-4.6-5-8.5a5 5 0 0 1 10 0C14 11.4 9 16 9 16Z" /><circle cx="9" cy="7.5" r="1.8" /></>)}
      {name === "network" && (<><circle cx="4" cy="5" r="1.8" /><circle cx="4" cy="13" r="1.8" /><circle cx="14" cy="4" r="1.8" /><circle cx="14" cy="9" r="1.8" /><circle cx="14" cy="14" r="1.8" /><path d="M5.8 5 12.2 4M5.8 13l6.4-3.6M5.8 13l6.4 1" /></>)}
      {name === "methodology" && (<><path d="M3 5h12M3 9h12M3 13h12" /><circle cx="6.5" cy="5" r="1.5" className="fill-surface" /><circle cx="11.5" cy="9" r="1.5" className="fill-surface" /><circle cx="8" cy="13" r="1.5" className="fill-surface" /></>)}
      {name === "issues" && (<><path d="M9 2.5 16 15H2L9 2.5Z" /><path d="M9 7.5v3.2M9 12.8v.2" /></>)}
      {name === "data" && (<><ellipse cx="9" cy="4.5" rx="5.5" ry="2" /><path d="M3.5 4.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M3.5 9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" /></>)}
      {name === "report" && (<><path d="M4 2.5h7l3 3v10H4v-13Z" /><path d="M11 2.5v3h3M6.5 9h5M6.5 12h5" /></>)}
    </svg>
  );
}
