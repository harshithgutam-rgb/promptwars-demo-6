import type { Metadata } from "next";
import { GlobalMapView } from "@/components/GlobalMapView";

export const metadata: Metadata = {
  title: "Global Map & Search — AirWise AI",
};

export default function GlobalMapPage() {
  return <GlobalMapView />;
}
