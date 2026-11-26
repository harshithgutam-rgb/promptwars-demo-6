export type CpcbAqiCategoryKey =
  | "good"
  | "satisfactory"
  | "moderate"
  | "poor"
  | "very_poor"
  | "severe"
  | "beyond_scale";

export interface CpcbAqiCategoryMeta {
  key: CpcbAqiCategoryKey;
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

export interface CpcbSubIndices {
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
  nh3: number | null;
}

export interface CpcbDominantPollutant {
  key: keyof CpcbSubIndices;
  label: string;
  aqi: number;
}

/**
 * Configurable application policies for India CPCB station selection:
 * - <= 10 km: Primary CPCB ground-station AQI (local)
 * - 10–25 km: Primary CPCB ground-station AQI with explicit station-distance disclosure
 * - 25–50 km: Retain Open-Meteo US AQI as primary; optionally show nearest valid CPCB station as regional reference only
 * - > 50 km: Retain Open-Meteo US AQI as primary (never present a distant station as exact location AQI)
 */
export const CPCB_POLICY = {
  LOCAL_PRIMARY_MAX_KM: 10,
  EXTENDED_PRIMARY_MAX_KM: 25,
  REGIONAL_REFERENCE_MAX_KM: 50,
  MAX_AGE_MINUTES: 180,
  STALE_WARNING_MINUTES: 120,
} as const;

export type CpcbDistanceBand = "local_10km" | "extended_25km" | "regional_50km";
export type CpcbUsageRole = "primary" | "regional_reference";

export type CpcbFallbackCode =
  | "outside_india"
  | "key_missing"
  | "provider_unavailable"
  | "no_nearby_station"
  | "station_stale"
  | "insufficient_pollutants"
  | "regional_only_25_to_50km";

export interface CpcbNearestStationMeta {
  stationName: string;
  city: string;
  state: string;
  distanceKm: number;
  observedAt: string;
  freshnessMinutes: number;
  valid: boolean;
  validPollutantCount: number;
  value: number | null;
  dominantPollutantLabel: string | null;
}

export interface CpcbAqiTelemetry {
  provider: string;
  attributionName: string;
  attributionUrl: string;
  license: string;
  label: string;
  dataType: "ground_station";
  standardName: "India CPCB National AQI (0–500)";
  standardNote: string;
  stationName: string;
  city: string;
  state: string;
  stationCoordinates: {
    lat: number;
    lon: number;
  };
  stationDistanceKm: number;
  distanceBand: CpcbDistanceBand;
  usageRole: CpcbUsageRole;
  observedAt: string; // ISO 8601 UTC converted from IST (+05:30)
  fetchedAt: string; // ISO 8601 UTC
  freshnessMinutes: number;
  isStale: boolean;
  value: number; // Official CPCB IND-NAQI = max(valid sub-indices), >= 1
  validPollutantCount: number;
  subIndices: CpcbSubIndices;
  dominantPollutant: CpcbDominantPollutant;
}

export interface PrimaryAqiReading {
  value: number;
  standard: "IND_CPCB" | "US_EPA";
  standardLabel: "India AQI (CPCB 0–500)" | "US EPA AQI (0–500)";
  category: string;
  provider: string;
  dataType: "ground_station" | "modeled_estimate";
  observedAt: string;
  fetchedAt: string;
  freshnessMinutes: number;
  isStale: boolean;
  stationName: string | null;
  stationDistanceKm: number | null;
  returnedCoordinates: { lat: number; lon: number } | null;
  dominantPollutant: { key: string; label: string; aqi: number } | null;
  fallbackReason: string | null;
}

/**
 * Official India CPCB National Air Quality Index (IND-NAQI) 6-band scale.
 * Kept strictly separate from US EPA AQI (0–500) and OpenWeather (1–5).
 */
export const CPCB_AQI_LEGEND: CpcbAqiCategoryMeta[] = [
  {
    key: "good",
    label: "Good",
    shortLabel: "Good",
    rangeLabel: "0–50",
    isBeyondScale: false,
    guidance:
      "Minimal health impact under India's CPCB National Air Quality Index.",
    accentHex: "#4edea3",
    secondaryHex: "#38bdf8",
    textClass: "text-secondary",
    badgeBorderClass: "border-secondary/40",
    dotClass: "bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.95)]",
    glowRgba: "rgba(78, 222, 163, 0.32)",
  },
  {
    key: "satisfactory",
    label: "Satisfactory",
    shortLabel: "Satisfactory",
    rangeLabel: "51–100",
    isBeyondScale: false,
    guidance:
      "Minor breathing discomfort to sensitive people under India's CPCB National AQI.",
    accentHex: "#86efac",
    secondaryHex: "#38bdf8",
    textClass: "text-emerald-300",
    badgeBorderClass: "border-emerald-400/40",
    dotClass: "bg-emerald-300 shadow-[0_0_8px_rgba(134,239,172,0.95)]",
    glowRgba: "rgba(134, 239, 172, 0.28)",
  },
  {
    key: "moderate",
    label: "Moderate",
    shortLabel: "Moderate",
    rangeLabel: "101–200",
    isBeyondScale: false,
    guidance:
      "Breathing discomfort to people with lung or heart disease, children, and older adults under CPCB AQI.",
    accentHex: "#facc15",
    secondaryHex: "#f59e0b",
    textClass: "text-yellow-300",
    badgeBorderClass: "border-yellow-400/40",
    dotClass: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.95)]",
    glowRgba: "rgba(250, 204, 21, 0.28)",
  },
  {
    key: "poor",
    label: "Poor",
    shortLabel: "Poor",
    rangeLabel: "201–300",
    isBeyondScale: false,
    guidance:
      "Breathing discomfort to most people on prolonged exposure under India's CPCB National AQI.",
    accentHex: "#fb923c",
    secondaryHex: "#f59e0b",
    textClass: "text-orange-300",
    badgeBorderClass: "border-orange-400/40",
    dotClass: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.95)]",
    glowRgba: "rgba(251, 146, 60, 0.32)",
  },
  {
    key: "very_poor",
    label: "Very Poor",
    shortLabel: "Very Poor",
    rangeLabel: "301–400",
    isBeyondScale: false,
    guidance:
      "Respiratory illness on prolonged exposure; stronger effects on people with lung and heart conditions.",
    accentHex: "#f43f5e",
    secondaryHex: "#fb7185",
    textClass: "text-rose-300",
    badgeBorderClass: "border-rose-400/40",
    dotClass: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.95)]",
    glowRgba: "rgba(244, 63, 94, 0.34)",
  },
  {
    key: "severe",
    label: "Severe",
    shortLabel: "Severe",
    rangeLabel: "401–500",
    isBeyondScale: false,
    guidance:
      "Affects healthy people and seriously impacts those with existing respiratory or cardiovascular conditions.",
    accentHex: "#e11d48",
    secondaryHex: "#9f1239",
    textClass: "text-rose-200",
    badgeBorderClass: "border-rose-500/55",
    dotClass: "bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.95)]",
    glowRgba: "rgba(225, 29, 72, 0.4)",
  },
  {
    key: "beyond_scale",
    label: "Severe (>500)",
    shortLabel: "Severe+",
    rangeLabel: ">500",
    isBeyondScale: true,
    guidance:
      "Exceeds the 500 upper bound of India's CPCB National AQI scale. Severe air pollution; minimize outdoor exposure.",
    accentHex: "#be123c",
    secondaryHex: "#881337",
    textClass: "text-rose-100",
    badgeBorderClass: "border-rose-500/70",
    dotClass: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,1)]",
    glowRgba: "rgba(190, 18, 60, 0.45)",
  },
];

export function classifyCpcbAqi(value: number): CpcbAqiCategoryMeta {
  const rounded = Math.round(value);
  if (rounded <= 50) return CPCB_AQI_LEGEND[0];
  if (rounded <= 100) return CPCB_AQI_LEGEND[1];
  if (rounded <= 200) return CPCB_AQI_LEGEND[2];
  if (rounded <= 300) return CPCB_AQI_LEGEND[3];
  if (rounded <= 400) return CPCB_AQI_LEGEND[4];
  if (rounded <= 500) return CPCB_AQI_LEGEND[5];
  return CPCB_AQI_LEGEND[6];
}

export function cpcbAqiArcFraction(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0.04;
  return Math.min(1, Math.max(0.04, value / 500));
}

export const CPCB_SUB_INDEX_LABELS: Record<keyof CpcbSubIndices, string> = {
  pm2_5: "PM2.5",
  pm10: "PM10",
  no2: "NO₂",
  so2: "SO₂",
  co: "CO",
  o3: "O₃",
  nh3: "NH₃",
};

/**
 * Maps CPCB data.gov.in `pollutant_id` values to canonical sub-index keys.
 */
export function normalizeCpcbPollutantId(
  rawId: unknown
): keyof CpcbSubIndices | null {
  if (typeof rawId !== "string") return null;
  const norm = rawId.trim().toUpperCase();
  if (norm === "PM2.5" || norm === "PM25") return "pm2_5";
  if (norm === "PM10") return "pm10";
  if (norm === "NO2") return "no2";
  if (norm === "SO2") return "so2";
  if (norm === "CO") return "co";
  if (norm === "OZONE" || norm === "O3") return "o3";
  if (norm === "NH3") return "nh3";
  return null;
}

/**
 * Parses a CPCB `avg_value` sub-index string ("292", "0", "NA", "", null).
 * Preserves legitimate zero sub-indices (e.g., NH3=0, O3=0, SO2=0, NO2=0)
 * while strictly rejecting "NA", empty strings, null, NaN, and negative values.
 */
export function parseCpcbSubIndexValue(
  raw: unknown,
  pollutantKey?: keyof CpcbSubIndices
): number | null {
  void pollutantKey;
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str || str.toUpperCase() === "NA" || str === "-") return null;
  const num = Number(str);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

/**
 * Parses CPCB `last_update` timestamps ("DD-MM-YYYY HH:mm:ss" in IST +05:30)
 * into a standard UTC ISO 8601 string.
 */
export function parseCpcbTimestampToUtcIso(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const match = trimmed.match(
    /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  if (!match) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
  }
  const [, dd, mm, yyyy, hh, min, ss] = match;
  const isoIst = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+05:30`;
  const parsed = new Date(isoIst);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * Enforces official CPCB National AQI validity rules (verified against
 * airquality.cpcb.gov.in):
 * - At least 3 valid pollutant sub-indices must be present (valid 0 sub-indices count).
 * - At least one particulate pollutant (PM2.5 or PM10) must be valid.
 * - Overall IND-NAQI = maximum valid sub-index (must be >= 1 so an all-zero dead sensor is rejected).
 */
export function evaluateCpcbStationAqi(subIndices: CpcbSubIndices): {
  value: number;
  dominantPollutant: CpcbDominantPollutant;
  validPollutantCount: number;
} | null {
  const hasParticulate = subIndices.pm2_5 !== null || subIndices.pm10 !== null;
  if (!hasParticulate) return null;

  let validCount = 0;
  let best: CpcbDominantPollutant | null = null;

  for (const key of Object.keys(CPCB_SUB_INDEX_LABELS) as Array<
    keyof CpcbSubIndices
  >) {
    const val = subIndices[key];
    if (val === null || !Number.isFinite(val)) continue;
    validCount += 1;
    if (!best || val > best.aqi) {
      best = {
        key,
        label: CPCB_SUB_INDEX_LABELS[key],
        aqi: val,
      };
    }
  }

  if (validCount < 3 || !best || best.aqi < 1) {
    return null;
  }

  return {
    value: best.aqi,
    dominantPollutant: best,
    validPollutantCount: validCount,
  };
}

/**
 * Bounding box covering all of India including mainland, Ladakh/J&K,
 * Arunachal Pradesh, Lakshadweep, and Andaman & Nicobar Islands.
 */
export function isWithinIndiaBounds(lat: number, lon: number): boolean {
  return lat >= 6.0 && lat <= 38.0 && lon >= 67.0 && lon <= 98.0;
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Number(
    (2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2)
  );
}

export const CPCB_STANDARD_DISCLOSURE =
  "India CPCB National AQI (0–500, IND-NAQI) from official ground monitoring stations via data.gov.in (GODL-India). Separate from US EPA AQI (Open-Meteo modeled) and OpenWeather (1–5 modeled).";
