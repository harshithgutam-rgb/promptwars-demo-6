import type { Metadata } from "next";
import { DailyRoutineView } from "@/components/DailyRoutineView";

export const metadata: Metadata = {
  title: "Daily Routine — AirWise AI",
};

export default function DailyRoutinePage() {
  return <DailyRoutineView />;
}
