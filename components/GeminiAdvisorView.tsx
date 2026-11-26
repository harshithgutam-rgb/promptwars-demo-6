"use client";

import { useCallback, useState } from "react";
import type { AiRecommendationRequestBody } from "@/lib/ai-types";
import { useLocationContext } from "@/components/LocationContext";
import { AiContextBanner } from "@/components/AiContextBanner";
import { AiRecommendationCards } from "@/components/AiRecommendationCards";
import { useAiRecommendation } from "@/components/useAiRecommendation";
import { ArrowRightIcon, SparklesIcon } from "@/components/Icons";

const ACTIVITY_OPTIONS = [
  "Outdoor running / cardio",
  "Walking & errands",
  "Desk work / indoor focus",
  "Outdoor sports with kids",
  "Gardening / yard work",
];

const COMMUTE_OPTIONS = [
  "Walking",
  "Cycling",
  "Public transit",
  "Solo car",
  "Carpool",
  "Work from home",
];

const HOUSEHOLD_OPTIONS = [
  "General adult household",
  "Family with young children",
  "Older adults at home",
  "Asthma / respiratory sensitivity",
  "Pets at home",
];

const SUGGESTED_QUESTIONS = [
  "Is right now reasonable for a 30-minute outdoor run given current PM2.5 and O₃?",
  "How should I adjust my commute today based on current air quality and emissions trade-offs?",
  "What practical precautions should a family with children or older adults keep in mind?",
  "Are outdoor pollutant levels favorable for opening windows briefly right now?",
];

export function GeminiAdvisorView() {
  const { activeLocation, openLocationModal } = useLocationContext();

  const [activity, setActivity] = useState(ACTIVITY_OPTIONS[0]);
  const [commuteType, setCommuteType] = useState(COMMUTE_OPTIONS[2]);
  const [household, setHousehold] = useState(HOUSEHOLD_OPTIONS[0]);
  const [constraints, setConstraints] = useState("");
  const [question, setQuestion] = useState("");

  const { loading, error, response, cooldownSeconds, isBusy, execute } =
    useAiRecommendation();

  const runAdvisor = useCallback(
    async (overrideQuestion?: string) => {
      if (isBusy) return;
      if (!activeLocation) {
        openLocationModal();
        return;
      }

      const finalQuestion =
        overrideQuestion !== undefined ? overrideQuestion : question;

      const body: AiRecommendationRequestBody = {
        mode: "advisor",
        location: {
          name: activeLocation.name,
          region: activeLocation.region,
          country: activeLocation.country,
          lat: activeLocation.lat,
          lon: activeLocation.lon,
        },
        advisor: {
          activity,
          commuteType,
          household,
          constraints: constraints.trim() || undefined,
          question: finalQuestion.trim() || undefined,
        },
      };

      await execute(body);
    },
    [
      isBusy,
      activeLocation,
      openLocationModal,
      activity,
      commuteType,
      household,
      constraints,
      question,
      execute,
    ]
  );

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6">
      {/* Header Panel */}
      <section className="liquid-glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-container/20 blur-[110px]" />
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3.5">
            <div className="liquid-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/35 text-primary shadow-[0_0_18px_rgba(56,189,248,0.3)]">
              <SparklesIcon size={22} />
            </div>
            <div>
              <span className="tabular-telemetry text-[11px] font-bold tracking-wider text-primary uppercase">
                Gemini Flash • Server-Verified Telemetry
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Gemini AI Atmospheric Advisor
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                Personalized air quality guidance grounded strictly in verified
                telemetry (India CPCB ground stations where available,
                Open-Meteo US AQI, and OpenWeather modeled pollutants &amp;
                weather), forecast trends, and your household needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Location & OpenWeather Context Strip */}
      <AiContextBanner />

      {/* Personalization & Ask AirWise Form */}
      <section
        aria-label="Personalize your Gemini AI request"
        className="liquid-glass rounded-3xl p-5 sm:p-6"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runAdvisor();
          }}
          className="flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Activity Selector */}
            <div>
              <label
                htmlFor="advisor-activity"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Planned Activity
              </label>
              <select
                id="advisor-activity"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Commute Selector */}
            <div>
              <label
                htmlFor="advisor-commute"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Commute Type
              </label>
              <select
                id="advisor-commute"
                value={commuteType}
                onChange={(e) => setCommuteType(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {COMMUTE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Household Selector */}
            <div>
              <label
                htmlFor="advisor-household"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Household Context
              </label>
              <select
                id="advisor-household"
                value={household}
                onChange={(e) => setHousehold(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {HOUSEHOLD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="advisor-constraints"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Optional Constraints
              </label>
              <input
                id="advisor-constraints"
                type="text"
                maxLength={240}
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g., No air purifier at home, must commute at 8 AM, prefer low-cost tips…"
                className="liquid-input w-full rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/65"
              />
            </div>

            <div>
              <label
                htmlFor="advisor-question"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Ask AirWise (Optional Question)
              </label>
              <input
                id="advisor-question"
                type="text"
                maxLength={400}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a specific question about today's air quality…"
                className="liquid-input w-full rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/65"
              />
            </div>
          </div>

          {/* Suggested Quick Questions */}
          <div>
            <span className="tabular-telemetry mb-2 block text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
              Suggested Questions
            </span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setQuestion(q);
                    void runAdvisor(q);
                  }}
                  className="liquid-btn rounded-full px-3.5 py-1.5 text-left text-xs text-on-surface hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <p className="text-xs text-on-surface-variant">
              General lifestyle guidance only — not medical advice.
            </p>
            <button
              type="submit"
              disabled={isBusy}
              className="liquid-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-on-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SparklesIcon size={17} />
              <span>
                {loading
                  ? "Consulting Gemini AI…"
                  : cooldownSeconds > 0
                    ? `Cooldown (${cooldownSeconds}s)`
                    : activeLocation
                      ? "Ask AirWise AI"
                      : "Select Location First"}
              </span>
              {!isBusy && <ArrowRightIcon size={15} />}
            </button>
          </div>
        </form>
      </section>

      {/* AI Output */}
      <AiRecommendationCards
        loading={loading}
        error={error}
        cooldownSeconds={cooldownSeconds}
        response={response}
        onRetry={() => void runAdvisor()}
        loadingLabel="Generating personalized AirWise AI guidance…"
      />
    </div>
  );
}
