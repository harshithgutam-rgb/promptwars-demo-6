import type { Metadata } from "next";
import { GeminiAdvisorView } from "@/components/GeminiAdvisorView";

export const metadata: Metadata = {
  title: "Gemini AI Advisor — AirWise AI",
};

export default function GeminiAiPage() {
  return <GeminiAdvisorView />;
}
