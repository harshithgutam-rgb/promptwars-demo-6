export type UsAqiCategoryKey =
  | "good"
  | "moderate"
  | "usg"
  | "unhealthy"
  | "very_unhealthy"
  | "hazardous"
  | "beyond_aqi";

export interface UsAqiCategoryMeta {
  key: UsAqiCategoryKey;
  label: string;
  shortLabel: string;
  rangeLabel: string;
  isBeyondScale: boolean;
  guidance: string;
  accentHex: string;
  secondaryHex: string;
  textClass: string;
  badgeBorderClass: string;
  dotClass: string;
  glowRgba: string;
}

export interface UsAqiSubIndices {
  pm2_5: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
}

export interface DominantPollutantInfo {
  key: keyof UsAqiSubIndices;
  label: string;
  aqi: number;
}

export interface UsAqiForecastPoint {
  timestamp: string; // ISO 8601 UTC
  usAqi: number;
}

export interface UsAqiTelemetry {
  provider: string;
  attributionName: string;
  attributionUrl: string;
  license: string;
  label: string;
  dataType: "modeled_estimate";
  standardName: "US EPA AQI (0–500)";
  standardNote: string;
  validAt: string; // ISO 8601 UTC from Open-Meteo current.time
  fetchedAt: string; // ISO 8601 UTC
  freshnessMinutes?: number;
  isStale?: boolean;
  returnedCoordinates?: {
    lat: number;
    lon: number;
  } | null;
  gridSnapDistanceKm?: number | null;
  value: number; // Un-truncated integer >= 0 (may exceed 500 -> Beyond AQI)
  subIndices: UsAqiSubIndices;
  dominantPollutant: DominantPollutantInfo | null;
  hourlyForecast24h: UsAqiForecastPoint[];
}

export const US_AQI_LEGEND: UsAqiCategoryMeta[] = [
  {
    key: "good",
    label: "Good",
    shortLabel: "Good",
    rangeLabel: "0–50",
    isBeyondScale: false,
    guidance:
      "Air quality is satisfactory under the US EPA AQI standard, and air pollution poses little or no risk.",
    accentHex: "#4edea3",
    secondaryHex: "#38bdf8",
    textClass: "text-secondary",
    badgeBorderClass: "border-secondary/40",
    dotClass: "bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.95)]",
    glowRgba: "rgba(78, 222, 163, 0.32)",
  },
  {
    key: "moderate",
    label: "Moderate",
    shortLabel: "Moderate",
    rangeLabel: "51–100",
    isBeyondScale: false,
    guidance:
      "Air quality is acceptable under US EPA AQI; there may be a risk for people unusually sensitive to air pollution.",
    accentHex: "#facc15",
    secondaryHex: "#38bdf8",
    textClass: "text-yellow-300",
    badgeBorderClass: "border-yellow-400/40",
    dotClass: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.95)]",
    glowRgba: "rgba(250, 204, 21, 0.28)",
  },
  {
    key: "usg",
    label: "Unhealthy for Sensitive Groups",
    shortLabel: "Sensitive",
    rangeLabel: "101–150",
    isBeyondScale: false,
    guidance:
      "Members of sensitive groups may experience health effects; the general public is less likely to be affected.",
    accentHex: "#fb923c",
    secondaryHex: "#f59e0b",
    textClass: "text-orange-300",
    badgeBorderClass: "border-orange-400/40",
    dotClass: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.95)]",
    glowRgba: "rgba(251, 146, 60, 0.3)",
  },
  {
    key: "unhealthy",
    label: "Unhealthy",
    shortLabel: "Unhealthy",
    rangeLabel: "151–200",
    isBeyondScale: false,
    guidance:
      "Some members of the general public may experience health effects; sensitive groups may experience more serious effects.",
    accentHex: "#f43f5e",
    secondaryHex: "#fb7185",
    textClass: "text-rose-300",
    badgeBorderClass: "border-rose-400/40",
    dotClass: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.95)]",
    glowRgba: "rgba(244, 63, 94, 0.32)",
  },
  {
    key: "very_unhealthy",
    label: "Very Unhealthy",
    shortLabel: "Very Unhealthy",
    rangeLabel: "201–300",
    isBeyondScale: false,
    guidance:
      "Health alert: the risk of health effects is increased for everyone under the US EPA AQI scale.",
    accentHex: "#c084fc",
    secondaryHex: "#f43f5e",
    textClass: "text-purple-300",
    badgeBorderClass: "border-purple-400/40",
    dotClass: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.95)]",
    glowRgba: "rgba(192, 132, 252, 0.32)",
  },
  {
    key: "hazardous",
    label: "Hazardous",
    shortLabel: "Hazardous",
    rangeLabel: "301–500",
    isBeyondScale: false,
    guidance:
      "Health warning of emergency conditions: everyone is more likely to be affected under the US EPA AQI scale.",
    accentHex: "#e11d48",
    secondaryHex: "#9f1239",
    textClass: "text-rose-200",
    badgeBorderClass: "border-rose-500/50",
    dotClass: "bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.95)]",
    glowRgba: "rgba(225, 29, 72, 0.38)",
  },
  {
    key: "beyond_aqi",
    label: "Beyond AQI (Extreme)",
    shortLabel: "Beyond AQI",
    rangeLabel: ">500",
    isBeyondScale: true,
    guidance:
      "Exceeds the upper 500 bound of the standard US EPA AQI scale. Severe air pollution; avoid outdoor exposure.",
    accentHex: "#be123c",
    secondaryHex: "#881337",
    textClass: "text-rose-100",
    badgeBorderClass: "border-rose-500/70",
    dotClass: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,1)]",
    glowRgba: "rgba(190, 18, 60, 0.45)",
  },
];

/**
 * Classifies a numerical US EPA AQI value using official breakpoints:
 * 0–50 Good, 51–100 Moderate, 101–150 Unhealthy for Sensitive Groups,
 * 151–200 Unhealthy, 201–300 Very Unhealthy, 301–500 Hazardous, >500 Beyond AQI.
 * Never truncates values > 500.
 */
export function classifyUsAqi(value: number): UsAqiCategoryMeta {
  const rounded = Math.round(value);
  if (rounded <= 50) return US_AQI_LEGEND[0];
  if (rounded <= 100) return US_AQI_LEGEND[1];
  if (rounded <= 150) return US_AQI_LEGEND[2];
  if (rounded <= 200) return US_AQI_LEGEND[3];
  if (rounded <= 300) return US_AQI_LEGEND[4];
  if (rounded <= 500) return US_AQI_LEGEND[5];
  return US_AQI_LEGEND[6];
}

/**
 * Maps a numerical US AQI value to a visual gauge arc fraction (0.04 to 1.0).
 * Values > 500 fill the arc to 100% while displaying the un-truncated value.
 */
export function usAqiArcFraction(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0.04;
  return Math.min(1, Math.max(0.04, value / 500));
}

const SUB_INDEX_LABELS: Record<keyof UsAqiSubIndices, string> = {
  pm2_5: "PM2.5",
  pm10: "PM10",
  o3: "O₃",
  no2: "NO₂",
  so2: "SO₂",
  co: "CO",
};

export function identifyDominantUsPollutant(
  subIndices: UsAqiSubIndices
): DominantPollutantInfo | null {
  let best: DominantPollutantInfo | null = null;
  for (const key of Object.keys(SUB_INDEX_LABELS) as Array<
    keyof UsAqiSubIndices
  >) {
    const val = subIndices[key];
    if (val === null || !Number.isFinite(val)) continue;
    if (!best || val > best.aqi) {
      best = {
        key,
        label: SUB_INDEX_LABELS[key],
        aqi: Math.round(val),
      };
    }
  }
  return best;
}

/**
 * Current US EPA PM2.5 24-hour AQI Breakpoints (effective May 6, 2024; 40 CFR Part 58 Appendix G).
 * NOTE: Strictly applicable ONLY to valid 24-hour averaged PM2.5 concentrations in µg/m³
 * (truncated to 1 decimal place per EPA rules). Never feed an instantaneous concentration
 * into this function as if it were a regulatory 24-hour average.
 */
interface EpaBreakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

export const EPA_2024_PM25_BREAKPOINTS: readonly EpaBreakpoint[] = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 500 },
] as const;

export function calculateEpa2024Pm25SubIndex(
  pm25TwentyFourHourAvgUgM3: number
): number | null {
  if (
    !Number.isFinite(pm25TwentyFourHourAvgUgM3) ||
    pm25TwentyFourHourAvgUgM3 < 0
  ) {
    return null;
  }

  // Official EPA rule: truncate PM2.5 24-hour average to 1 decimal place
  const cTrunc = Math.floor(pm25TwentyFourHourAvgUgM3 * 10 + 1e-9) / 10;

  for (const bp of EPA_2024_PM25_BREAKPOINTS) {
    if (cTrunc >= bp.cLow && cTrunc <= bp.cHigh) {
      const raw =
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (cTrunc - bp.cLow) +
        bp.iLow;
      return Math.round(raw);
    }
  }

  // Above 325.4 µg/m³: Beyond the standard 0–500 AQI scale (linear continuation using top slope)
  const top = EPA_2024_PM25_BREAKPOINTS[EPA_2024_PM25_BREAKPOINTS.length - 1];
  const slope = (top.iHigh - top.iLow) / (top.cHigh - top.cLow);
  return Math.round(top.iHigh + slope * (cTrunc - top.cHigh));
}

export const US_VS_CPCB_DISCLOSURE =
  "US AQI (0–500, Open-Meteo modeled) and India's CPCB National AQI are separate standards with different breakpoints and categories. OpenWeather AQI (1–5) is an independent provider index.";
