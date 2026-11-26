"use client";

import { useCallback, useState } from "react";
import type {
  AiRecommendationRequestBody,
  DailyRoutineBlock,
} from "@/lib/ai-types";
import { useLocationContext } from "@/components/LocationContext";
import { AiContextBanner } from "@/components/AiContextBanner";
import { AiRecommendationCards } from "@/components/AiRecommendationCards";
import { useAiRecommendation } from "@/components/useAiRecommendation";
import {
  ArrowRightIcon,
  CalendarIcon,
  RunnerIcon,
  SparklesIcon,
} from "@/components/Icons";

const ACTIVITY_LEVELS = [
  "Light (walks & errands)",
  "Moderate (commute + casual exercise)",
  "Active (running / cycling / outdoor sports)",
  "Mostly indoors today",
];

const COMMUTE_TYPES = [
  "Public transit",
  "Walking / Cycling",
  "Solo driving",
  "Carpooling",
  "Remote / Work from home",
];

const HOUSEHOLD_PROFILES = [
  "General adult schedule",
  "Family with school-age children",
  "Older adults / sensitive respiratory profile",
  "Dog walking & family outings",
];

const DATA_BASIS_META: Record<
  DailyRoutineBlock["dataBasis"],
  { label: string; classes: string }
> = {
  provider_forecast: {
    label: "Provider 24h Forecast",
    classes: "border-primary/35 text-primary bg-primary/10",
  },
  current_observed: {
    label: "Current Observed",
    classes: "border-secondary/35 text-secondary bg-secondary/10",
  },
  general_guidance: {
    label: "General Guidance",
    classes: "border-white/20 text-on-surface-variant bg-white/5",
  },
};

export function DailyRoutineView() {
  const { activeLocation, airQualityData, openLocationModal } =
    useLocationContext();

  const [activityLevel, setActivityLevel] = useState(ACTIVITY_LEVELS[1]);
  const [commuteType, setCommuteType] = useState(COMMUTE_TYPES[0]);
  const [household, setHousehold] = useState(HOUSEHOLD_PROFILES[0]);
  const [scheduleNotes, setScheduleNotes] = useState("");

  const { loading, error, response, cooldownSeconds, isBusy, execute } =
    useAiRecommendation();

  const generateRoutine = useCallback(async () => {
    if (isBusy) return;
    if (!activeLocation) {
      openLocationModal();
      return;
    }

    const body: AiRecommendationRequestBody = {
      mode: "daily-routine",
      location: {
        name: activeLocation.name,
        region: activeLocation.region,
        country: activeLocation.country,
        lat: activeLocation.lat,
        lon: activeLocation.lon,
      },
      dailyRoutine: {
        activityLevel,
        commuteType,
        household,
        scheduleNotes: scheduleNotes.trim() || undefined,
      },
    };

    await execute(body);
  }, [
    isBusy,
    activeLocation,
    openLocationModal,
    activityLevel,
    commuteType,
    household,
    scheduleNotes,
    execute,
  ]);

  const hasForecast = Boolean(
    airQualityData?.forecast24h && airQualityData.forecast24h.length > 0
  );

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6">
      {/* Header */}
      <section className="liquid-glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary/15 blur-[110px]" />
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3.5">
            <div className="liquid-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-secondary/35 text-secondary shadow-[0_0_18px_rgba(78,222,163,0.28)]">
              <CalendarIcon size={22} />
            </div>
            <div>
              <span className="tabular-telemetry text-[11px] font-bold tracking-wider text-secondary uppercase">
                Pollution-Aware Daily Planner
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Daily Routine Planner
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                Morning, afternoon, and evening suggestions grounded in verified
                air quality (India CPCB stations where available, Open-Meteo US
                AQI, and OpenWeather telemetry) and{" "}
                {hasForecast
                  ? "available 24-hour provider forecast data"
                  : "current readings"}
                —without unsupported exact safe-hour promises or medical
                guarantees.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AiContextBanner />

      {/* Routine Preferences Form */}
      <section
        aria-label="Daily routine preferences"
        className="liquid-glass rounded-3xl p-5 sm:p-6"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void generateRoutine();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="routine-activity"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Activity Level
              </label>
              <select
                id="routine-activity"
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {ACTIVITY_LEVELS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="routine-commute"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Commute Mode
              </label>
              <select
                id="routine-commute"
                value={commuteType}
                onChange={(e) => setCommuteType(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {COMMUTE_TYPES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="routine-household"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Household / Family
              </label>
              <select
                id="routine-household"
                value={household}
                onChange={(e) => setHousehold(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {HOUSEHOLD_PROFILES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="routine-notes"
              className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
            >
              Optional Schedule Notes
            </label>
            <input
              id="routine-notes"
              type="text"
              maxLength={240}
              value={scheduleNotes}
              onChange={(e) => setScheduleNotes(e.target.value)}
              placeholder="e.g., School drop-off in morning, evening soccer practice, prefer shorter outdoor walks…"
              className="liquid-input w-full rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/65"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <p className="text-xs text-on-surface-variant">
              {hasForecast
                ? "Uses OpenWeather 24h forecast where available and labels forecast vs. current conditions."
                : "Forecast data will be verified on the server; periods without forecast coverage are labeled as current/general guidance."}
            </p>
            <button
              type="submit"
              disabled={isBusy}
              className="liquid-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-on-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SparklesIcon size={17} />
              <span>
                {loading
                  ? "Building Routine…"
                  : cooldownSeconds > 0
                    ? `Cooldown (${cooldownSeconds}s)`
                    : activeLocation
                      ? "Generate Daily Routine"
                      : "Select Location First"}
              </span>
              {!isBusy && <ArrowRightIcon size={15} />}
            </button>
          </div>
        </form>
      </section>

      {/* Morning / Afternoon / Evening Liquid Glass Blocks */}
      {!loading && response?.result.routineBlocks && (
        <section
          aria-label="Morning, Afternoon, and Evening routine plan"
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          {response.result.routineBlocks.map((block) => {
            const basis = DATA_BASIS_META[block.dataBasis];
            return (
              <article
                key={block.period}
                className="liquid-glass liquid-glass-interactive flex flex-col justify-between rounded-3xl p-5"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="tabular-telemetry inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-white uppercase">
                      <RunnerIcon size={15} className="text-secondary" />
                      {block.period}
                    </span>
                    <span
                      className={`tabular-telemetry rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${basis.classes}`}
                    >
                      {basis.label}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-white">
                    {block.headline}
                  </h2>

                  <dl className="mt-4 space-y-3 text-xs leading-relaxed">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <dt className="tabular-telemetry font-bold tracking-wider text-secondary uppercase">
                        Outdoor Activity
                      </dt>
                      <dd className="mt-1 text-on-surface">
                        {block.outdoorGuidance}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <dt className="tabular-telemetry font-bold tracking-wider text-primary uppercase">
                        Commute
                      </dt>
                      <dd className="mt-1 text-on-surface">
                        {block.commuteTip}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <dt className="tabular-telemetry font-bold tracking-wider text-tertiary uppercase">
                        Exercise
                      </dt>
                      <dd className="mt-1 text-on-surface">
                        {block.exerciseTip}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <dt className="tabular-telemetry font-bold tracking-wider text-on-surface-variant uppercase">
                        Family &amp; Sensitive Groups
                      </dt>
                      <dd className="mt-1 text-on-surface-variant">
                        {block.familyNote}
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Detailed AI Synthesis, Recommendations & Caveats */}
      <AiRecommendationCards
        loading={loading}
        error={error}
        cooldownSeconds={cooldownSeconds}
        response={response}
        onRetry={() => void generateRoutine()}
        loadingLabel="Building your Morning, Afternoon, and Evening pollution-aware routine…"
      />
    </div>
  );
}
