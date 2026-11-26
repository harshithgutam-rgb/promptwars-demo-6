import type { UsAqiTelemetry } from "@/lib/us-aqi";
import type {
  CpcbAqiTelemetry,
  CpcbFallbackCode,
  CpcbNearestStationMeta,
  PrimaryAqiReading,
} from "@/lib/cpcb-aqi";

export type LocationSource = "geolocation" | "search" | "preset";

export interface LocationPoint {
  id: string;
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
  source: LocationSource;
  savedAt: string;
}

export interface PollutantReadings {
  pm2_5: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  nh3: number | null;
  no: number | null;
}

export interface ForecastPoint {
  timestamp: string; // ISO 8601 UTC
  aqi: 1 | 2 | 3 | 4 | 5;
  pm2_5: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
}

export interface WeatherBaseline {
  tempC: number;
  humidity: number;
  windSpeedMs: number;
  windDeg: number | null;
  pressureHpa: number | null;
  description: string | null;
}

export interface AirQualityData {
  provider: string;
  aqiStandard: {
    name: string;
    scaleMin: 1;
    scaleMax: 5;
    description: string;
  };
  units: {
    pollutants: "µg/m³";
  };
  coordinates: {
    lat: number;
    lon: number;
  };
  openWeatherReturnedCoordinates?: {
    lat: number;
    lon: number;
  } | null;
  openWeatherDataType?: "modeled_estimate";
  observedAt: string; // ISO 8601 UTC from OpenWeather dt
  fetchedAt: string; // ISO 8601 UTC
  current: {
    aqi: 1 | 2 | 3 | 4 | 5;
    components: PollutantReadings;
  };
  forecast24h: ForecastPoint[];
  weather: WeatherBaseline | null;
  /**
   * Independent US EPA AQI (0–500+) sourced directly from Open-Meteo Air Quality API
   * (Copernicus CAMS modeled estimate). Never converted from OpenWeather 1–5.
   */
  usAqi: UsAqiTelemetry | null;
  usAqiUnavailableReason?: string | null;
  /**
   * Official India CPCB National AQI (IND-NAQI 0–500) from ground monitoring stations
   * via data.gov.in (present only for Indian coordinates with a fresh valid station <= 25 km).
   */
  cpcbAqi?: CpcbAqiTelemetry | null;
  cpcbRegionalReference?: CpcbAqiTelemetry | null;
  cpcbFallbackCode?: CpcbFallbackCode | null;
  cpcbUnavailableReason?: string | null;
  cpcbNearestStationMeta?: CpcbNearestStationMeta | null;
  /**
   * Canonical primary AQI reading shared by Dashboard, Global Map, and all 4 Gemini features:
   * prioritizes official CPCB station data in India when fresh & valid <= 25 km, otherwise Open-Meteo US AQI.
   */
  primaryAqi?: PrimaryAqiReading | null;
}

export interface AirQualityErrorResponse {
  error: string;
  code:
    | "API_KEY_MISSING"
    | "INVALID_COORDINATES"
    | "UPSTREAM_AUTH_ERROR"
    | "RATE_LIMITED"
    | "UPSTREAM_ERROR"
    | "INVALID_UPSTREAM_RESPONSE";
}

export interface GeocodeResult {
  id: string;
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
}

export interface GeocodeApiResponse {
  provider: string;
  results: GeocodeResult[];
}

export interface AqiLevelMeta {
  index: 1 | 2 | 3 | 4 | 5;
  label: string;
  shortLabel: string;
  guidance: string;
  accentHex: string;
  secondaryHex: string;
  textClass: string;
  badgeBorderClass: string;
  dotClass: string;
  glowRgba: string;
  arcFraction: number;
}

/**
 * Official OpenWeather Air Quality Index (1-5) scale.
 * Kept strictly separate from the 0-500 US EPA AQI scale.
 */
export const OPENWEATHER_AQI_SCALE: Record<1 | 2 | 3 | 4 | 5, AqiLevelMeta> = {
  1: {
    index: 1,
    label: "Good",
    shortLabel: "Good",
    guidance:
      "Air quality is rated Good on the OpenWeather 1–5 provider index.",
    accentHex: "#4edea3",
    secondaryHex: "#38bdf8",
    textClass: "text-secondary",
    badgeBorderClass: "border-secondary/40",
    dotClass: "bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.95)]",
    glowRgba: "rgba(78, 222, 163, 0.32)",
    arcFraction: 0.2,
  },
  2: {
    index: 2,
    label: "Fair",
    shortLabel: "Fair",
    guidance:
      "Air quality is rated Fair on the OpenWeather 1–5 provider index.",
    accentHex: "#57e1ce",
    secondaryHex: "#38bdf8",
    textClass: "text-tertiary",
    badgeBorderClass: "border-tertiary/40",
    dotClass: "bg-tertiary shadow-[0_0_8px_rgba(87,225,206,0.95)]",
    glowRgba: "rgba(87, 225, 206, 0.3)",
    arcFraction: 0.4,
  },
  3: {
    index: 3,
    label: "Moderate",
    shortLabel: "Moderate",
    guidance:
      "Air quality is rated Moderate on the OpenWeather 1–5 provider index.",
    accentHex: "#f59e0b",
    secondaryHex: "#38bdf8",
    textClass: "text-amber-300",
    badgeBorderClass: "border-amber-400/40",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.95)]",
    glowRgba: "rgba(245, 158, 11, 0.28)",
    arcFraction: 0.6,
  },
  4: {
    index: 4,
    label: "Poor",
    shortLabel: "Poor",
    guidance:
      "Air quality is rated Poor on the OpenWeather 1–5 provider index.",
    accentHex: "#fb923c",
    secondaryHex: "#f43f5e",
    textClass: "text-orange-300",
    badgeBorderClass: "border-orange-400/40",
    dotClass: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.95)]",
    glowRgba: "rgba(251, 146, 60, 0.3)",
    arcFraction: 0.8,
  },
  5: {
    index: 5,
    label: "Very Poor",
    shortLabel: "Very Poor",
    guidance:
      "Air quality is rated Very Poor on the OpenWeather 1–5 provider index.",
    accentHex: "#f43f5e",
    secondaryHex: "#fb7185",
    textClass: "text-rose-300",
    badgeBorderClass: "border-rose-400/40",
    dotClass: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.95)]",
    glowRgba: "rgba(244, 63, 94, 0.32)",
    arcFraction: 1.0,
  },
};

export interface PollutantClassification {
  status: "Good" | "Fair" | "Moderate" | "Poor" | "Very Poor" | "Unavailable";
  percent: number;
  textClass: string;
  borderClass: string;
  barGradientClass: string;
  thresholdNote: string;
}

/**
 * Thresholds aligned directly with OpenWeather's published pollutant concentration
 * table (all in µg/m³).
 */
export function classifyPollutant(
  key: "pm2_5" | "pm10" | "o3" | "no2",
  value: number | null
): PollutantClassification {
  if (value === null || !Number.isFinite(value)) {
    return {
      status: "Unavailable",
      percent: 0,
      textClass: "text-on-surface-variant",
      borderClass: "border-white/15",
      barGradientClass: "from-white/20 to-white/10",
      thresholdNote: "Provider reading unavailable",
    };
  }

  const thresholds: Record<
    "pm2_5" | "pm10" | "o3" | "no2",
    { breaks: [number, number, number, number]; maxVisual: number; refLabel: string }
  > = {
    pm2_5: { breaks: [10, 25, 50, 75], maxVisual: 85, refLabel: "OW Good <10 µg/m³" },
    pm10: { breaks: [20, 50, 100, 200], maxVisual: 220, refLabel: "OW Good <20 µg/m³" },
    o3: { breaks: [60, 100, 140, 180], maxVisual: 200, refLabel: "OW Good <60 µg/m³" },
    no2: { breaks: [40, 70, 150, 200], maxVisual: 220, refLabel: "OW Good <40 µg/m³" },
  };

  const { breaks, maxVisual, refLabel } = thresholds[key];
  const percent = Math.min(100, Math.max(6, Math.round((value / maxVisual) * 100)));

  if (value < breaks[0]) {
    return {
      status: "Good",
      percent,
      textClass: "text-secondary",
      borderClass: "border-secondary/30",
      barGradientClass: "from-secondary to-primary",
      thresholdNote: refLabel,
    };
  }
  if (value < breaks[1]) {
    return {
      status: "Fair",
      percent,
      textClass: "text-tertiary",
      borderClass: "border-tertiary/30",
      barGradientClass: "from-tertiary to-primary",
      thresholdNote: refLabel,
    };
  }
  if (value < breaks[2]) {
    return {
      status: "Moderate",
      percent,
      textClass: "text-amber-300",
      borderClass: "border-amber-400/30",
      barGradientClass: "from-amber-400 to-primary",
      thresholdNote: refLabel,
    };
  }
  if (value < breaks[3]) {
    return {
      status: "Poor",
      percent,
      textClass: "text-orange-300",
      borderClass: "border-orange-400/30",
      barGradientClass: "from-orange-400 to-rose-400",
      thresholdNote: refLabel,
    };
  }
  return {
    status: "Very Poor",
    percent,
    textClass: "text-rose-300",
    borderClass: "border-rose-400/30",
    barGradientClass: "from-rose-400 to-rose-600",
    thresholdNote: refLabel,
  };
}

export function isValidAqiIndex(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

export function toNullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lon).toFixed(2)}° ${lonDir}`;
}

export function formatLocationLabel(loc: LocationPoint): string {
  const parts = [loc.name];
  if (loc.region && loc.region.toLowerCase() !== loc.name.toLowerCase()) {
    parts.push(loc.region);
  }
  if (loc.country) {
    parts.push(loc.country);
  }
  return parts.join(", ");
}

export function formatWindDirection(deg: number | null): string {
  if (deg === null || !Number.isFinite(deg)) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return dirs[idx];
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTimestampReadable(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const WORLDWIDE_QUICK_CITIES: Omit<LocationPoint, "savedAt">[] = [
  {
    id: "preset-new-delhi",
    name: "New Delhi",
    region: "Delhi",
    country: "IN",
    lat: 28.6139,
    lon: 77.209,
    source: "preset",
  },
  {
    id: "preset-bengaluru",
    name: "Bengaluru",
    region: "Karnataka",
    country: "IN",
    lat: 12.9716,
    lon: 77.5946,
    source: "preset",
  },
  {
    id: "preset-london",
    name: "London",
    region: "England",
    country: "GB",
    lat: 51.5074,
    lon: -0.1278,
    source: "preset",
  },
  {
    id: "preset-tokyo",
    name: "Tokyo",
    country: "JP",
    lat: 35.6762,
    lon: 139.6503,
    source: "preset",
  },
  {
    id: "preset-new-york",
    name: "New York",
    region: "NY",
    country: "US",
    lat: 40.7128,
    lon: -74.006,
    source: "preset",
  },
  {
    id: "preset-sydney",
    name: "Sydney",
    region: "NSW",
    country: "AU",
    lat: -33.8688,
    lon: 151.2093,
    source: "preset",
  },
];
