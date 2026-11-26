import type { Metadata } from "next";
import { WhatIfSimulatorView } from "@/components/WhatIfSimulatorView";

export const metadata: Metadata = {
  title: "What-If Simulator — AirWise AI",
};

export default function WhatIfSimulatorPage() {
  return <WhatIfSimulatorView />;
}
