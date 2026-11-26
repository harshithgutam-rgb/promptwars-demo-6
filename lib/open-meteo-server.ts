import {
  identifyDominantUsPollutant,
  US_VS_CPCB_DISCLOSURE,
  type UsAqiForecastPoint,
  type UsAqiSubIndices,
  type UsAqiTelemetry,
} from "@/lib/us-aqi";
import { haversineDistanceKm } from "@/lib/cpcb-aqi";

interface RawOpenMeteoAirItem {
  latitude?: unknown;
  longitude?: unknown;
  utc_offset_seconds?: unknown;
  current?: {
    time?: unknown;
    us_aqi?: unknown;
    us_aqi_pm2_5?: unknown;
    us_aqi_pm10?: unknown;
    us_aqi_nitrogen_dioxide?: unknown;
    us_aqi_ozone?: unknown;
    us_aqi_sulphur_dioxide?: unknown;
    us_aqi_carbon_monoxide?: unknown;
  };
  hourly?: {
    time?: unknown;
    us_aqi?: unknown;
  };
}

export type OpenMeteoUsAqiResult =
  | { ok: true; data: UsAqiTelemetry }
  | { ok: false; reason: string };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes per rounded coordinate
const MAX_CACHE_ENTRIES = 200;

interface CacheEntry {
  expiresAt: number;
  hasForecast: boolean;
  value: UsAqiTelemetry;
}

const openMeteoCache = new Map<string, CacheEntry>();
const openMeteoInFlight = new Map<string, Promise<OpenMeteoUsAqiResult>>();

/** Clears in-memory cache (intended for automated unit tests). */
export function clearOpenMeteoCache(): void {
  openMeteoCache.clear();
  openMeteoInFlight.clear();
}

function makeCoordKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function getCached(
  lat: number,
  lon: number,
  requireForecast: boolean
): UsAqiTelemetry | null {
  const key = makeCoordKey(lat, lon);
  const entry = openMeteoCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    openMeteoCache.delete(key);
    return null;
  }
  // Never serve a batch current-only entry (empty hourlyForecast24h) to Dashboard requests
  if (requireForecast && !entry.hasForecast) {
    return null;
  }
  return entry.value;
}

function setCached(
  lat: number,
  lon: number,
  value: UsAqiTelemetry,
  hasForecast: boolean
): void {
  const key = makeCoordKey(lat, lon);
  const existing = openMeteoCache.get(key);
  // Never let a current-only map batch overwrite a fresh full-forecast entry
  if (!hasForecast && existing && existing.hasForecast && Date.now() < existing.expiresAt) {
    return;
  }
  openMeteoCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    hasForecast,
    value,
  });
  if (openMeteoCache.size > MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of openMeteoCache.entries()) {
      if (v.expiresAt <= now) {
        openMeteoCache.delete(k);
      }
    }
  }
}

/**
 * Normalizes Open-Meteo GMT/UTC ISO timestamps ("2026-11-24T02:00") to valid ISO 8601 UTC.
 */
function normalizeOpenMeteoUtcTime(rawTime: unknown): string | null {
  if (typeof rawTime !== "string" || rawTime.trim() === "") return null;
  const trimmed = rawTime.trim();
  const withZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed)
    ? trimmed
    : `${trimmed}Z`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toValidNonNegativeAqi(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  // Never truncate values > 500; preserve full Beyond AQI value
  return Math.round(value);
}

function parseSingleOpenMeteoItem(
  raw: unknown,
  fetchedAt: string,
  requestedCoord?: { lat: number; lon: number }
): UsAqiTelemetry | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as RawOpenMeteoAirItem;
  const current = item.current;
  if (!current || typeof current !== "object") return null;

  const validAt = normalizeOpenMeteoUtcTime(current.time);
  const usAqiValue = toValidNonNegativeAqi(current.us_aqi);

  if (!validAt || usAqiValue === null) {
    return null;
  }

  const returnedLat =
    typeof item.latitude === "number" && Number.isFinite(item.latitude)
      ? item.latitude
      : null;
  const returnedLon =
    typeof item.longitude === "number" && Number.isFinite(item.longitude)
      ? item.longitude
      : null;
  const returnedCoordinates =
    returnedLat !== null && returnedLon !== null
      ? { lat: returnedLat, lon: returnedLon }
      : null;
  const gridSnapDistanceKm =
    returnedCoordinates && requestedCoord
      ? haversineDistanceKm(
          requestedCoord.lat,
          requestedCoord.lon,
          returnedCoordinates.lat,
          returnedCoordinates.lon
        )
      : null;

  const validMs = Date.parse(validAt);
  const fetchedMs = Date.parse(fetchedAt);
  const freshnessMinutes =
    Number.isFinite(validMs) && Number.isFinite(fetchedMs)
      ? Math.max(0, Math.round((fetchedMs - validMs) / 60_000))
      : undefined;

  const subIndices: UsAqiSubIndices = {
    pm2_5: toValidNonNegativeAqi(current.us_aqi_pm2_5),
    pm10: toValidNonNegativeAqi(current.us_aqi_pm10),
    o3: toValidNonNegativeAqi(current.us_aqi_ozone),
    no2: toValidNonNegativeAqi(current.us_aqi_nitrogen_dioxide),
    so2: toValidNonNegativeAqi(current.us_aqi_sulphur_dioxide),
    co: toValidNonNegativeAqi(current.us_aqi_carbon_monoxide),
  };

  const dominantPollutant = identifyDominantUsPollutant(subIndices);

  const hourlyForecast24h: UsAqiForecastPoint[] = [];
  if (
    item.hourly &&
    Array.isArray(item.hourly.time) &&
    Array.isArray(item.hourly.us_aqi)
  ) {
    const len = Math.min(
      25,
      item.hourly.time.length,
      item.hourly.us_aqi.length
    );
    for (let i = 0; i < len; i++) {
      const ts = normalizeOpenMeteoUtcTime(item.hourly.time[i]);
      const val = toValidNonNegativeAqi(item.hourly.us_aqi[i]);
      if (ts && val !== null) {
        hourlyForecast24h.push({ timestamp: ts, usAqi: val });
      }
    }
  }

  return {
    provider: "Open-Meteo Air Quality API (Copernicus CAMS)",
    attributionName: "Open-Meteo.com",
    attributionUrl: "https://open-meteo.com/",
    license: "CC BY 4.0",
    label: "US AQI — Open-Meteo modeled estimate",
    dataType: "modeled_estimate",
    standardName: "US EPA AQI (0–500)",
    standardNote: US_VS_CPCB_DISCLOSURE,
    validAt,
    fetchedAt,
    freshnessMinutes,
    isStale: freshnessMinutes !== undefined ? freshnessMinutes > 120 : false,
    returnedCoordinates,
    gridSnapDistanceKm,
    value: usAqiValue,
    subIndices,
    dominantPollutant,
    hourlyForecast24h,
  };
}

const CURRENT_FIELDS = [
  "us_aqi",
  "us_aqi_pm2_5",
  "us_aqi_pm10",
  "us_aqi_nitrogen_dioxide",
  "us_aqi_ozone",
  "us_aqi_sulphur_dioxide",
  "us_aqi_carbon_monoxide",
].join(",");

/**
 * Fetches modeled US EPA AQI (0–500+) for a single coordinate from Open-Meteo.
 * Cached for 5 minutes per rounded coordinate to respect provider free-tier limits.
 */
export async function fetchOpenMeteoUsAqi(
  lat: number,
  lon: number,
  options?: { bypassCache?: boolean }
): Promise<OpenMeteoUsAqiResult> {
  const bypass = Boolean(options?.bypassCache);
  const key = makeCoordKey(lat, lon);

  if (!bypass) {
    const cached = getCached(lat, lon, true);
    if (cached) {
      return { ok: true, data: cached };
    }
    const existingFlight = openMeteoInFlight.get(key);
    if (existingFlight) {
      return existingFlight;
    }
  }

  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("current", CURRENT_FIELDS);
  url.searchParams.set("hourly", "us_aqi");
  url.searchParams.set("forecast_hours", "24");
  url.searchParams.set("timezone", "UTC");

  const flight = (async (): Promise<OpenMeteoUsAqiResult> => {
    try {
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(8000),
        ...(bypass ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
      });

      if (res.status === 429) {
        return {
          ok: false,
          reason: "Open-Meteo Air Quality API rate limit reached.",
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          reason: `Open-Meteo Air Quality API returned HTTP ${res.status}.`,
        };
      }

      const raw: unknown = await res.json();
      const parsed = parseSingleOpenMeteoItem(raw, new Date().toISOString(), {
        lat,
        lon,
      });
      if (!parsed) {
        return {
          ok: false,
          reason:
            "Open-Meteo returned incomplete or unavailable US AQI data for these coordinates.",
        };
      }

      setCached(lat, lon, parsed, true);
      return { ok: true, data: parsed };
    } catch {
      return {
        ok: false,
        reason: "Unable to reach Open-Meteo Air Quality API right now.",
      };
    } finally {
      openMeteoInFlight.delete(key);
    }
  })();

  if (!bypass) {
    openMeteoInFlight.set(key, flight);
  }
  return flight;
}

/**
 * Efficiently fetches Open-Meteo US AQI for up to 10 coordinates in a SINGLE HTTP request
 * (using Open-Meteo's native comma-separated multi-location support + 5-min server cache).
 */
export async function fetchOpenMeteoUsAqiBatch(
  coords: Array<{ lat: number; lon: number }>
): Promise<Array<UsAqiTelemetry | null>> {
  const results: Array<UsAqiTelemetry | null> = coords.map((c) =>
    getCached(c.lat, c.lon, false)
  );
  const missingIndices: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    if (!results[i]) missingIndices.push(i);
  }

  if (missingIndices.length === 0) {
    return results;
  }

  const lats = missingIndices
    .map((idx) => coords[idx].lat.toFixed(4))
    .join(",");
  const lons = missingIndices
    .map((idx) => coords[idx].lon.toFixed(4))
    .join(",");

  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", lats);
  url.searchParams.set("longitude", lons);
  url.searchParams.set("current", CURRENT_FIELDS);
  url.searchParams.set("timezone", "UTC");

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return results;

    const raw: unknown = await res.json();
    const fetchedAt = new Date().toISOString();
    const items: unknown[] = Array.isArray(raw) ? raw : [raw];

    for (let j = 0; j < missingIndices.length; j++) {
      const targetIdx = missingIndices[j];
      const targetCoord = coords[targetIdx];
      const parsed = parseSingleOpenMeteoItem(items[j], fetchedAt, targetCoord);
      if (parsed) {
        // Store as current-only (hasForecast=false) so Dashboard still fetches full 24h forecast
        setCached(targetCoord.lat, targetCoord.lon, parsed, false);
        results[targetIdx] = parsed;
      }
    }
  } catch {
    // Preserve any cached entries and return null for uncached failures
  }

  return results;
}
