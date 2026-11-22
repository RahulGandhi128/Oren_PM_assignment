"use client";
import { useEffect, useState } from "react";
import type { components } from "./api-types";

export type Issue = components["schemas"]["Issue"];
export type Severity = Issue["severity"];

let cache: Promise<Issue[]> | null = null;
function loadIssues(): Promise<Issue[]> {
  cache ??= fetch("/api/issues")
    .then((r) => (r.ok ? r.json() : { issues: [] }))
    .then((d: { issues: Issue[] }) => d.issues)
    .catch(() => {
      cache = null;
      return [];
    });
  return cache;
}

/** All data issues, keyed by ID. Fetched once per session. */
export function useIssues(): Map<string, Issue> {
  const [issues, setIssues] = useState<Map<string, Issue>>(new Map());
  useEffect(() => {
    loadIssues().then((list) => setIssues(new Map(list.map((i) => [i.id, i]))));
  }, []);
  return issues;
}

const RANK: Record<Severity, number> = { info: 0, warning: 1, danger: 2 };
export const worstSeverity = (list: Issue[]): Severity | null =>
  list.length ? list.reduce((a, b) => (RANK[b.severity] > RANK[a.severity] ? b : a)).severity : null;
