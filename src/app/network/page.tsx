import { Suspense } from "react";
import { NetworkView } from "./NetworkView";

export const metadata = { title: "Network · Horizon" };

export default function Page() {
  return (
    <Suspense>
      <NetworkView />
    </Suspense>
  );
}
