import type { Metadata } from "next";
import { IndoorAirRescueView } from "@/components/IndoorAirRescueView";

export const metadata: Metadata = {
  title: "Indoor Air Rescue — AirWise AI",
};

export default function IndoorAirRescuePage() {
  return <IndoorAirRescueView />;
}
