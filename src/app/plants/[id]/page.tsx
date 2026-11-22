import { Suspense } from "react";
import { PlantDetailView } from "./PlantDetailView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PlantDetailView id={id.toUpperCase()} />
    </Suspense>
  );
}
