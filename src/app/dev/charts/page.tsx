import { notFound } from "next/navigation";
import ChartGallery from "@/components/charts/ChartGallery";

// Dev-only visual check for the chart primitives.
export default function ChartsDevPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ChartGallery />;
}
