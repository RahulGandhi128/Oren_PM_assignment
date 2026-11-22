import { Suspense } from "react";
import { MethodologyView } from "./MethodologyView";

export const metadata = { title: "Methodology · Horizon" };

export default function Page() {
  return (
    <Suspense>
      <MethodologyView />
    </Suspense>
  );
}
