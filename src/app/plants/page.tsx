import { indiaGeometry } from "@/components/map/geo";
import { PlantsView } from "./PlantsView";

export default function PlantsPage() {
  const geometry = indiaGeometry();
  return (
    <PlantsView geometry={geometry} />
  );
}
