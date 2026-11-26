"use client";

import { useCallback, useMemo, useState } from "react";
import {
  calculateWhatIfComparison,
  TRANSPORT_MODES,
  type TransportModeId,
} from "@/lib/emissions";
import type { AiRecommendationRequestBody } from "@/lib/ai-types";
import { useLocationContext } from "@/components/LocationContext";
import { AiContextBanner } from "@/components/AiContextBanner";
import { AiRecommendationCards } from "@/components/AiRecommendationCards";
import { useAiRecommendation } from "@/components/useAiRecommendation";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  SlidersIcon,
  SparklesIcon,
} from "@/components/Icons";

const MODE_LIST: TransportModeId[] = [
  "car_solo",
  "carpool",
  "public_bus",
  "public_rail",
  "cycling",
  "walking",
];

export function WhatIfSimulatorView() {
  const { activeLocation, airQualityData, openLocationModal } =
    useLocationContext();

  const [distanceKm, setDistanceKm] = useState(12);
  const [tripsPerWeek, setTripsPerWeek] = useState(10);
  const [baselineMode, setBaselineMode] = useState<TransportModeId>("car_solo");
  const [alternativeMode, setAlternativeMode] =
    useState<TransportModeId>("public_rail");
  const [carpoolRiders, setCarpoolRiders] = useState(3);
  const [notes, setNotes] = useState("");

  const { loading, error, response, cooldownSeconds, isBusy, execute } =
    useAiRecommendation();

  const currentAqi = airQualityData?.current.aqi ?? null;

  // 100% deterministic TypeScript calculation — never invented by Gemini
  const comparison = useMemo(
    () =>
      calculateWhatIfComparison(
        {
          distanceKm,
          tripsPerWeek,
          baselineMode,
          alternativeMode,
          carpoolRiders,
        },
        currentAqi
      ),
    [
      distanceKm,
      tripsPerWeek,
      baselineMode,
      alternativeMode,
      carpoolRiders,
      currentAqi,
    ]
  );

  const maxWeeklyKg = Math.max(
    0.1,
    ...comparison.allModes.map((m) => m.weeklyKg)
  );

  const explainWithGemini = useCallback(async () => {
    if (isBusy) return;
    if (!activeLocation) {
      openLocationModal();
      return;
    }

    const body: AiRecommendationRequestBody = {
      mode: "what-if",
      location: {
        name: activeLocation.name,
        region: activeLocation.region,
        country: activeLocation.country,
        lat: activeLocation.lat,
        lon: activeLocation.lon,
      },
      whatIf: {
        distanceKm,
        tripsPerWeek,
        baselineMode,
        alternativeMode,
        carpoolRiders,
        notes: notes.trim() || undefined,
      },
    };

    await execute(body);
  }, [
    isBusy,
    activeLocation,
    openLocationModal,
    distanceKm,
    tripsPerWeek,
    baselineMode,
    alternativeMode,
    carpoolRiders,
    notes,
    execute,
  ]);

  const isSavings = comparison.delta.weeklyKgSaved >= 0;

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6">
      {/* Header */}
      <section className="liquid-glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-container/20 blur-[110px]" />
        <div className="relative z-10 flex items-start gap-3.5">
          <div className="liquid-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/35 text-primary shadow-[0_0_18px_rgba(56,189,248,0.28)]">
            <SlidersIcon size={22} />
          </div>
          <div>
            <span className="tabular-telemetry text-[11px] font-bold tracking-wider text-primary uppercase">
              Deterministic Emission Factors • Gemini Explainer
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              What-If Transport Simulator
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant sm:text-sm">
              Compare estimated personal CO₂e emissions across driving,
              carpooling, public transit, cycling, and walking using documented
              conversion factors—then ask Gemini AI to explain trade-offs and
              exposure considerations for today&apos;s air quality.
            </p>
          </div>
        </div>
      </section>

      <AiContextBanner />

      {/* Interactive Controls & Deterministic Summary Bento */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Controls (6 cols) */}
        <section
          aria-label="Trip comparison controls"
          className="liquid-glass flex flex-col justify-between gap-4 rounded-3xl p-5 sm:p-6 lg:col-span-6"
        >
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Trip Parameters</h2>

            {/* Distance Slider */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <label
                  htmlFor="sim-distance"
                  className="tabular-telemetry font-semibold tracking-wider text-on-surface-variant uppercase"
                >
                  One-Way Trip Distance
                </label>
                <span className="tabular-telemetry font-bold text-primary">
                  {distanceKm.toFixed(1)} km ({(distanceKm * 0.621371).toFixed(1)}{" "}
                  mi)
                </span>
              </div>
              <input
                id="sim-distance"
                type="range"
                min={1}
                max={80}
                step={0.5}
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>

            {/* Trips per Week Slider */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <label
                  htmlFor="sim-trips"
                  className="tabular-telemetry font-semibold tracking-wider text-on-surface-variant uppercase"
                >
                  One-Way Trips Per Week
                </label>
                <span className="tabular-telemetry font-bold text-secondary">
                  {tripsPerWeek} trips / week
                </span>
              </div>
              <input
                id="sim-trips"
                type="range"
                min={1}
                max={20}
                step={1}
                value={tripsPerWeek}
                onChange={(e) => setTripsPerWeek(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            {/* Mode Selectors */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="sim-baseline"
                  className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
                >
                  Current Mode
                </label>
                <select
                  id="sim-baseline"
                  value={baselineMode}
                  onChange={(e) =>
                    setBaselineMode(e.target.value as TransportModeId)
                  }
                  className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
                >
                  {MODE_LIST.map((id) => (
                    <option key={id} value={id}>
                      {TRANSPORT_MODES[id].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="sim-alternative"
                  className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
                >
                  Alternative Mode
                </label>
                <select
                  id="sim-alternative"
                  value={alternativeMode}
                  onChange={(e) =>
                    setAlternativeMode(e.target.value as TransportModeId)
                  }
                  className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
                >
                  {MODE_LIST.map((id) => (
                    <option key={id} value={id}>
                      {TRANSPORT_MODES[id].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Carpool Rider Count (shown if either mode is carpool) */}
            {(baselineMode === "carpool" || alternativeMode === "carpool") && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="sim-riders"
                    className="tabular-telemetry font-semibold tracking-wider text-on-surface-variant uppercase"
                  >
                    Carpool Occupants
                  </label>
                  <span className="tabular-telemetry font-bold text-tertiary">
                    {carpoolRiders} riders
                  </span>
                </div>
                <input
                  id="sim-riders"
                  type="range"
                  min={2}
                  max={5}
                  step={1}
                  value={carpoolRiders}
                  onChange={(e) => setCarpoolRiders(Number(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="sim-notes"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Optional Route Context (for Gemini Explanation)
              </label>
              <input
                id="sim-notes"
                type="text"
                maxLength={240}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Steep hills, limited bike lanes, carrying laptop/groceries…"
                className="liquid-input w-full rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/65"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => void explainWithGemini()}
            className="liquid-cta inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-on-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SparklesIcon size={17} />
            <span>
              {loading
                ? "Analyzing Trade-offs with Gemini…"
                : cooldownSeconds > 0
                  ? `Cooldown (${cooldownSeconds}s)`
                  : activeLocation
                    ? "Explain Comparison & Alternatives with Gemini AI"
                    : "Select Location to Ask Gemini AI"}
            </span>
            {!isBusy && <ArrowRightIcon size={15} />}
          </button>
        </section>

        {/* Right Deterministic Output Card (6 cols) */}
        <section
          aria-label="Estimated emissions comparison"
          className="liquid-glass flex flex-col justify-between gap-4 rounded-3xl p-5 sm:p-6 lg:col-span-6"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-white">
                Estimated Emissions Comparison
              </h2>
              <span className="liquid-pill tabular-telemetry rounded-full border border-tertiary/35 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-tertiary uppercase">
                Deterministic Estimate
              </span>
            </div>

            {/* Key KPI Cards */}
            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
              <div className="liquid-pill rounded-2xl p-3 text-center">
                <span className="tabular-telemetry block text-[10px] text-on-surface-variant uppercase">
                  Per Trip
                </span>
                <span
                  className={`tabular-telemetry mt-1 block text-lg font-bold sm:text-xl ${
                    isSavings ? "text-secondary" : "text-amber-300"
                  }`}
                >
                  {isSavings ? "-" : "+"}
                  {Math.abs(comparison.delta.perTripKgSaved).toFixed(2)} kg
                </span>
                <span className="tabular-telemetry text-[10px] text-on-surface-variant">
                  CO₂e est.
                </span>
              </div>

              <div className="liquid-pill rounded-2xl p-3 text-center">
                <span className="tabular-telemetry block text-[10px] text-on-surface-variant uppercase">
                  Weekly
                </span>
                <span
                  className={`tabular-telemetry mt-1 block text-lg font-bold sm:text-xl ${
                    isSavings ? "text-secondary" : "text-amber-300"
                  }`}
                >
                  {isSavings ? "-" : "+"}
                  {Math.abs(comparison.delta.weeklyKgSaved).toFixed(1)} kg
                </span>
                <span className="tabular-telemetry text-[10px] text-on-surface-variant">
                  {comparison.delta.percentChange}% change
                </span>
              </div>

              <div className="liquid-pill rounded-2xl p-3 text-center">
                <span className="tabular-telemetry block text-[10px] text-on-surface-variant uppercase">
                  Annual ({comparison.assumptions.weeksPerYear}w)
                </span>
                <span
                  className={`tabular-telemetry mt-1 block text-lg font-bold sm:text-xl ${
                    isSavings ? "text-primary" : "text-amber-300"
                  }`}
                >
                  {isSavings ? "-" : "+"}
                  {Math.abs(comparison.delta.annualKgSaved).toFixed(0)} kg
                </span>
                <span className="tabular-telemetry text-[10px] text-on-surface-variant">
                  CO₂e est.
                </span>
              </div>
            </div>

            {/* Mode-by-Mode Bar Comparison */}
            <div className="mt-5 space-y-3">
              <span className="tabular-telemetry block text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                All Modes — Estimated Weekly CO₂e ({tripsPerWeek} ×{" "}
                {distanceKm.toFixed(1)} km)
              </span>

              {comparison.allModes.map((item) => {
                const widthPct =
                  item.weeklyKg === 0
                    ? 2
                    : Math.max(6, Math.round((item.weeklyKg / maxWeeklyKg) * 100));
                const isBaseline = item.mode === baselineMode;
                const isAlt = item.mode === alternativeMode;
                return (
                  <div
                    key={item.mode}
                    className={`rounded-2xl border p-3 transition-colors ${
                      isAlt
                        ? "border-secondary/45 bg-secondary/10"
                        : isBaseline
                          ? "border-primary/40 bg-primary/10"
                          : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-white">
                          {item.label}
                        </span>
                        {isBaseline && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">
                            Current
                          </span>
                        )}
                        {isAlt && (
                          <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[9px] font-bold text-secondary uppercase">
                            Alternative
                          </span>
                        )}
                      </div>
                      <span className="tabular-telemetry shrink-0 font-bold text-white">
                        {item.weeklyKg.toFixed(2)} kg/wk{" "}
                        <span className="font-normal text-on-surface-variant">
                          ({item.effectiveGramsPerKm} g/km)
                        </span>
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.weeklyKg === 0
                            ? "bg-secondary"
                            : isAlt
                              ? "bg-gradient-to-r from-secondary to-tertiary"
                              : "bg-gradient-to-r from-primary to-sky-500"
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>

                    <p className="mt-1.5 text-[11px] text-on-surface-variant">
                      {item.suitabilityNote}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Transparent Methodology & City-AQI Scope Disclaimer */}
      <section
        aria-label="Assumptions and methodology"
        className="liquid-glass rounded-2xl border border-amber-400/25 p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <AlertTriangleIcon
            size={18}
            className="mt-0.5 shrink-0 text-amber-300"
          />
          <div className="space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
            <p>
              <strong className="text-white">Documented Assumptions:</strong>{" "}
              {comparison.assumptions.methodology}
            </p>
            <p>
              <strong className="text-amber-200">Estimate Scope:</strong>{" "}
              {comparison.assumptions.aqiImpactDisclaimer}
            </p>
          </div>
        </div>
      </section>

      {/* Gemini AI Explanation of Comparison & Practical Alternatives */}
      <AiRecommendationCards
        loading={loading}
        error={error}
        cooldownSeconds={cooldownSeconds}
        response={response}
        onRetry={() => void explainWithGemini()}
        loadingLabel="Generating Gemini AI explanation of your transport comparison…"
      />
    </div>
  );
}
