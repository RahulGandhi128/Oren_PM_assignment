import type { Metadata } from "next";
import { IssuesView } from "./IssuesView";

export const metadata: Metadata = { title: "Issues & notes · Horizon" };

export default function IssuesPage() {
  return <IssuesView />;
}
