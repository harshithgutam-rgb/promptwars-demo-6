export type TransportModeId =
  | "car_solo"
  | "carpool"
  | "public_bus"
  | "public_rail"
  | "cycling"
  | "walking";

export interface TransportModeSpec {
  id: TransportModeId;
  label: string;
  shortLabel: string;
  /** Tailpipe / operational CO2e factor in grams per passenger-kilometer (g CO2e/pkm) */
  baseGramsPerKm: number;
  isActiveTransport: boolean;
  /** Practical maximum one-way distance hint in km where the mode is typically practical */
  practicalMaxKm: number | null;
  sourceCitation: string;
  assumptionNote: string;
}

/**
 * Deterministic, documented passenger-km emission factors.
 * Sources:
 * - UK DESNZ / DEFRA 2024 Greenhouse Gas Reporting Conversion Factors (average passenger car, local bus, national/light rail)
 * - US EPA GHG Equivalencies & Tailpipe Reference (~170 g CO2e/km average passenger car)
 * Active transport (walking, cycling) has 0 g CO2e/km direct tailpipe emissions.
 */
export const TRANSPORT_MODES: Record<TransportModeId, TransportModeSpec> = {
  car_solo: {
    id: "car_solo",
    label: "Solo Driving (Average Car)",
    shortLabel: "Driving",
    baseGramsPerKm: 170,
    isActiveTransport: false,
    practicalMaxKm: null,
    sourceCitation: "UK DESNZ / DEFRA 2024 average passenger car (~170 g CO₂e/km)",
    assumptionNote: "1 occupant in an average internal-combustion passenger car.",
  },
  carpool: {
    id: "carpool",
    label: "Carpooling (Shared Car)",
    shortLabel: "Carpool",
    baseGramsPerKm: 170,
    isActiveTransport: false,
    practicalMaxKm: null,
    sourceCitation: "UK DESNZ / DEFRA 2024 car factor divided by riders",
    assumptionNote: "Average passenger car emissions split equally across riders.",
  },
  public_bus: {
    id: "public_bus",
    label: "Public Transport (City Bus)",
    shortLabel: "City Bus",
    baseGramsPerKm: 82,
    isActiveTransport: false,
    practicalMaxKm: null,
    sourceCitation: "UK DESNZ / DEFRA 2024 average local bus (~82 g CO₂e/pkm)",
    assumptionNote: "Average urban bus load factor; varies by fleet electrification.",
  },
  public_rail: {
    id: "public_rail",
    label: "Public Transport (Metro / Rail)",
    shortLabel: "Metro / Rail",
    baseGramsPerKm: 35,
    isActiveTransport: false,
    practicalMaxKm: null,
    sourceCitation: "UK DESNZ / DEFRA 2024 urban/light rail (~35 g CO₂e/pkm)",
    assumptionNote: "Average electric metro/rail grid intensity; varies by local grid.",
  },
  cycling: {
    id: "cycling",
    label: "Cycling",
    shortLabel: "Cycling",
    baseGramsPerKm: 0,
    isActiveTransport: true,
    practicalMaxKm: 20,
    sourceCitation: "Zero direct tailpipe emissions (0 g CO₂e/km)",
    assumptionNote: "Excludes bike manufacturing lifecycle and dietary energy.",
  },
  walking: {
    id: "walking",
    label: "Walking",
    shortLabel: "Walking",
    baseGramsPerKm: 0,
    isActiveTransport: true,
    practicalMaxKm: 6,
    sourceCitation: "Zero direct tailpipe emissions (0 g CO₂e/km)",
    assumptionNote: "Zero tailpipe emissions; best suited to shorter distances.",
  },
};

export interface WhatIfInput {
  distanceKm: number; // One-way trip distance in km
  tripsPerWeek: number; // Number of one-way trips per week (e.g., 10 for 5 round-trips)
  baselineMode: TransportModeId;
  alternativeMode: TransportModeId;
  carpoolRiders: number; // 2 to 5
}

export interface ModeEmissionEstimate {
  mode: TransportModeId;
  label: string;
  shortLabel: string;
  effectiveGramsPerKm: number;
  perTripGrams: number;
  perTripKg: number;
  weeklyKg: number;
  annualKg: number; // Based on 50 active commuting weeks/year
  isActiveTransport: boolean;
  suitabilityNote: string;
}

export interface WhatIfComparisonResult {
  input: WhatIfInput;
  assumptions: {
    weeksPerYear: number;
    methodology: string;
    aqiImpactDisclaimer: string;
  };
  baseline: ModeEmissionEstimate;
  alternative: ModeEmissionEstimate;
  allModes: ModeEmissionEstimate[];
  delta: {
    perTripKgSaved: number; // Positive means alternative emits less than baseline
    weeklyKgSaved: number;
    annualKgSaved: number;
    percentChange: number; // Negative means reduction, e.g., -52%
  };
}

export const ASSUMED_COMMUTE_WEEKS_PER_YEAR = 50;

export function getEffectiveGramsPerKm(
  mode: TransportModeId,
  carpoolRiders: number
): number {
  const spec = TRANSPORT_MODES[mode];
  if (mode === "carpool") {
    const riders = Math.max(2, Math.min(5, Math.round(carpoolRiders)));
    return Number((spec.baseGramsPerKm / riders).toFixed(1));
  }
  return spec.baseGramsPerKm;
}

function buildSuitabilityNote(
  mode: TransportModeId,
  distanceKm: number,
  currentAqi: 1 | 2 | 3 | 4 | 5 | null
): string {
  const spec = TRANSPORT_MODES[mode];
  if (spec.isActiveTransport) {
    if (spec.practicalMaxKm && distanceKm > spec.practicalMaxKm) {
      return `Distance (${distanceKm.toFixed(1)} km one-way) exceeds typical ${spec.shortLabel.toLowerCase()} range (~${spec.practicalMaxKm} km); consider transit or mixed-mode.`;
    }
    if (currentAqi !== null && currentAqi >= 4) {
      return `Zero tailpipe emissions, but OpenWeather AQI is ${currentAqi}/5 — elevated breathing rate outdoors increases personal pollutant inhalation.`;
    }
    if (currentAqi === 3) {
      return `Zero tailpipe emissions; OpenWeather AQI is 3/5 (Moderate), so quieter low-traffic routes are preferable.`;
    }
    return "Zero direct tailpipe emissions and practical for this trip distance.";
  }
  if (mode === "carpool") {
    return "Splits vehicle tailpipe emissions across riders without requiring transit access.";
  }
  return spec.assumptionNote;
}

/**
 * Deterministic calculation of estimated CO2e emissions and savings across modes.
 * Never uses AI-invented numbers.
 */
export function calculateWhatIfComparison(
  rawInput: WhatIfInput,
  currentAqi: 1 | 2 | 3 | 4 | 5 | null = null
): WhatIfComparisonResult {
  const distanceKm = Math.max(0.5, Math.min(250, Number(rawInput.distanceKm) || 1));
  const tripsPerWeek = Math.max(1, Math.min(30, Math.round(rawInput.tripsPerWeek) || 1));
  const carpoolRiders = Math.max(2, Math.min(5, Math.round(rawInput.carpoolRiders) || 2));

  const input: WhatIfInput = {
    distanceKm,
    tripsPerWeek,
    baselineMode: rawInput.baselineMode,
    alternativeMode: rawInput.alternativeMode,
    carpoolRiders,
  };

  const computeForMode = (mode: TransportModeId): ModeEmissionEstimate => {
    const spec = TRANSPORT_MODES[mode];
    const effectiveGramsPerKm = getEffectiveGramsPerKm(mode, carpoolRiders);
    const perTripGrams = Math.round(effectiveGramsPerKm * distanceKm);
    const perTripKg = Number((perTripGrams / 1000).toFixed(3));
    const weeklyKg = Number(((perTripGrams * tripsPerWeek) / 1000).toFixed(2));
    const annualKg = Number(
      ((perTripGrams * tripsPerWeek * ASSUMED_COMMUTE_WEEKS_PER_YEAR) / 1000).toFixed(1)
    );

    return {
      mode,
      label:
        mode === "carpool"
          ? `Carpooling (${carpoolRiders} riders)`
          : spec.label,
      shortLabel:
        mode === "carpool" ? `Carpool (${carpoolRiders}x)` : spec.shortLabel,
      effectiveGramsPerKm,
      perTripGrams,
      perTripKg,
      weeklyKg,
      annualKg,
      isActiveTransport: spec.isActiveTransport,
      suitabilityNote: buildSuitabilityNote(mode, distanceKm, currentAqi),
    };
  };

  const allModeIds: TransportModeId[] = [
    "car_solo",
    "carpool",
    "public_bus",
    "public_rail",
    "cycling",
    "walking",
  ];
  const allModes = allModeIds.map(computeForMode);
  const baseline = computeForMode(input.baselineMode);
  const alternative = computeForMode(input.alternativeMode);

  const perTripKgSaved = Number((baseline.perTripKg - alternative.perTripKg).toFixed(3));
  const weeklyKgSaved = Number((baseline.weeklyKg - alternative.weeklyKg).toFixed(2));
  const annualKgSaved = Number((baseline.annualKg - alternative.annualKg).toFixed(1));
  const percentChange =
    baseline.perTripGrams > 0
      ? Math.round(
          ((alternative.perTripGrams - baseline.perTripGrams) /
            baseline.perTripGrams) *
            100
        )
      : alternative.perTripGrams === 0
        ? 0
        : 100;

  return {
    input,
    assumptions: {
      weeksPerYear: ASSUMED_COMMUTE_WEEKS_PER_YEAR,
      methodology:
        "Estimated using published UK DESNZ / DEFRA 2024 average passenger-km CO₂e conversion factors across 50 active weeks/year. Actual emissions vary by vehicle efficiency, fuel type, local electricity grid, and transit occupancy.",
      aqiImpactDisclaimer:
        "These figures are personal tailpipe CO₂e estimates only. An individual trip switch reduces your personal emissions footprint, but does not directly produce a measurable change in city-wide AQI on its own.",
    },
    baseline,
    alternative,
    allModes,
    delta: {
      perTripKgSaved,
      weeklyKgSaved,
      annualKgSaved,
      percentChange,
    },
  };
}
