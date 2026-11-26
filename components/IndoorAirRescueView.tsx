"use client";

import { useCallback, useState } from "react";
import type { AiRecommendationRequestBody } from "@/lib/ai-types";
import { useLocationContext } from "@/components/LocationContext";
import { AiContextBanner } from "@/components/AiContextBanner";
import { AiRecommendationCards } from "@/components/AiRecommendationCards";
import { useAiRecommendation } from "@/components/useAiRecommendation";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ShieldIcon,
  SparklesIcon,
  WindowIcon,
} from "@/components/Icons";

const HOME_TYPES = [
  "Apartment / Flat",
  "Detached / Single-family house",
  "Townhouse / Duplex",
  "Dorm / Single room",
];

const PURIFIER_OPTIONS = [
  "No air purifier (budget-focused)",
  "DIY box-fan filter (Corsi-Rosenthal)",
  "Portable HEPA air purifier",
  "Central HVAC with MERV-11/13 filter",
];

const COOKING_FUELS = [
  "Gas stove / burner",
  "Electric coil / radiant stove",
  "Induction cooktop",
  "Mixed / shared kitchen",
];

const BUDGET_OPTIONS = [
  "Zero-cost & low-cost steps first",
  "Balanced practical actions",
  "Open to filtration / seal upgrades",
];

const HOUSEHOLD_NEEDS = [
  "General household",
  "Children or infants indoors",
  "Asthma / allergy sensitivity",
  "Indoor pets / dust & dander",
  "Near busy road / urban traffic",
];

export function IndoorAirRescueView() {
  const { activeLocation, openLocationModal } = useLocationContext();

  const [homeType, setHomeType] = useState(HOME_TYPES[0]);
  const [hasAirPurifier, setHasAirPurifier] = useState(PURIFIER_OPTIONS[0]);
  const [cookingFuel, setCookingFuel] = useState(COOKING_FUELS[0]);
  const [budgetFocus, setBudgetFocus] = useState(BUDGET_OPTIONS[0]);
  const [householdNeeds, setHouseholdNeeds] = useState(HOUSEHOLD_NEEDS[0]);
  const [notes, setNotes] = useState("");

  const { loading, error, response, cooldownSeconds, isBusy, execute } =
    useAiRecommendation();

  const generateIndoorPlan = useCallback(async () => {
    if (isBusy) return;
    if (!activeLocation) {
      openLocationModal();
      return;
    }

    const body: AiRecommendationRequestBody = {
      mode: "indoor-rescue",
      location: {
        name: activeLocation.name,
        region: activeLocation.region,
        country: activeLocation.country,
        lat: activeLocation.lat,
        lon: activeLocation.lon,
      },
      indoorRescue: {
        homeType,
        hasAirPurifier,
        cookingFuel,
        budgetFocus,
        householdNeeds,
        notes: notes.trim() || undefined,
      },
    };

    await execute(body);
  }, [
    isBusy,
    activeLocation,
    openLocationModal,
    homeType,
    hasAirPurifier,
    cookingFuel,
    budgetFocus,
    householdNeeds,
    notes,
    execute,
  ]);

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6">
      {/* Header */}
      <section className="liquid-glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-tertiary/18 blur-[110px]" />
        <div className="relative z-10 flex items-start gap-3.5">
          <div className="liquid-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-tertiary/35 text-tertiary shadow-[0_0_18px_rgba(87,225,206,0.28)]">
            <ShieldIcon size={22} />
          </div>
          <div>
            <span className="tabular-telemetry text-[11px] font-bold tracking-wider text-tertiary uppercase">
              Personalized Home Air Guidance
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Indoor Air Rescue
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant sm:text-sm">
              Practical ventilation, filtration, cooking, cleaning, and
              budget-conscious indoor source-reduction advice tailored to your
              home setup and current outdoor conditions.
            </p>
          </div>
        </div>
      </section>

      {/* Explicit Outdoor != Indoor Disclosure */}
      <section
        aria-label="Indoor sensor disclosure"
        className="liquid-glass rounded-2xl border border-amber-400/30 p-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangleIcon
            size={18}
            className="mt-0.5 shrink-0 text-amber-300"
          />
          <p className="text-xs leading-relaxed text-on-surface-variant sm:text-[13px]">
            <strong className="text-amber-200">
              Important transparency note:
            </strong>{" "}
            Outdoor AQI readings (CPCB ground stations or modeled estimates) do{" "}
            <strong className="text-white">not</strong> measure your actual
            indoor air quality, and AirWise AI does not have connected indoor
            sensors. Indoor pollutants (cooking smoke, VOCs, dust, humidity) can
            differ significantly from outdoor readings.
          </p>
        </div>
      </section>

      <AiContextBanner />

      {/* Household & Indoor Setup Form */}
      <section
        aria-label="Indoor environment profile"
        className="liquid-glass rounded-3xl p-5 sm:p-6"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void generateIndoorPlan();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="indoor-home-type"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Home Type
              </label>
              <select
                id="indoor-home-type"
                value={homeType}
                onChange={(e) => setHomeType(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {HOME_TYPES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="indoor-purifier"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Filtration / Purifier
              </label>
              <select
                id="indoor-purifier"
                value={hasAirPurifier}
                onChange={(e) => setHasAirPurifier(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {PURIFIER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="indoor-cooking"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Cooking Setup
              </label>
              <select
                id="indoor-cooking"
                value={cookingFuel}
                onChange={(e) => setCookingFuel(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {COOKING_FUELS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="indoor-budget"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Budget Preference
              </label>
              <select
                id="indoor-budget"
                value={budgetFocus}
                onChange={(e) => setBudgetFocus(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {BUDGET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="indoor-household"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Household Priority
              </label>
              <select
                id="indoor-household"
                value={householdNeeds}
                onChange={(e) => setHouseholdNeeds(e.target.value)}
                className="liquid-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-[#0e1526]"
              >
                {HOUSEHOLD_NEEDS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="indoor-notes"
                className="tabular-telemetry mb-1.5 block text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Optional Home Details
              </label>
              <input
                id="indoor-notes"
                type="text"
                maxLength={240}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., No kitchen exhaust hood, incense, window faces avenue…"
                className="liquid-input w-full rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/65"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <WindowIcon size={15} className="text-tertiary" />
              <span>
                Covers ventilation, cooking fumes, cleaning products &amp;
                low-cost source reduction.
              </span>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="liquid-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-on-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SparklesIcon size={17} />
              <span>
                {loading
                  ? "Building Indoor Plan…"
                  : cooldownSeconds > 0
                    ? `Cooldown (${cooldownSeconds}s)`
                    : activeLocation
                      ? "Generate Indoor Air Rescue Plan"
                      : "Select Location First"}
              </span>
              {!isBusy && <ArrowRightIcon size={15} />}
            </button>
          </div>
        </form>
      </section>

      <AiRecommendationCards
        loading={loading}
        error={error}
        cooldownSeconds={cooldownSeconds}
        response={response}
        onRetry={() => void generateIndoorPlan()}
        loadingLabel="Generating personalized Indoor Air Rescue guidance…"
      />
    </div>
  );
}
