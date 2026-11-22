"use client";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useWhen, type When } from "@/lib/when";

/** Underline tabs "Now | 2040": which year leads every page. */
export function WhenTabs() {
  const [when, setWhen] = useWhen();
  return (
    <ToggleGroup.Root type="single" value={when} onValueChange={(v) => v && setWhen(v as When)} aria-label="Lead year" data-tour="when-tabs" className="inline-flex items-end gap-1">
      {(["now", "2040"] as const).map((w) => (
        <ToggleGroup.Item key={w} value={w}
          className="tabular border-b-2 border-transparent px-3 py-2 text-small font-medium text-muted transition-colors hover:text-ink data-[state=on]:border-ink data-[state=on]:text-ink">
          {w === "now" ? "Now" : "2040"}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
