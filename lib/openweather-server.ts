import {
  type AirQualityData,
  type AirQualityErrorResponse,
  type ForecastPoint,
  type WeatherBaseline,
  isValidAqiIndex,
  toNullableFiniteNumber,
} from "@/lib/air-quality";
import { fetchOpenMeteoUsAqi } from "@/lib/open-meteo-server";
import { fetchNearestCpcbStation } from "@/lib/cpcb-server";
import {
  classifyCpcbAqi,
  isWithinIndiaBounds,
  type PrimaryAqiReading,
} from "@/lib/cpcb-aqi";
import { classifyUsAqi } from "@/lib/us-aqi";

interface RawOpenWeatherAirItem {
  dt?: unknown;
  main?: {
    aqi?: unknown;
  };
  components?: {
    co?: unknown;
    no?: unknown;
    no2?: unknown;
    o3?: unknown;
    so2?: unknown;
    pm2_5?: unknown;
    pm10?: unknown;
    nh3?: unknown;
  };
}

interface RawOpenWeatherAirPayload {
  coord?: {
    lat?: unknown;
    lon?: unknown;
  };
  list?: unknown;
}

interface RawOpenWeatherWeatherPayload {
  main?: {
    temp?: unknown;
    humidity?: unknown;
    pressure?: unknown;
  };
  wind?: {
    speed?: unknown;
    deg?: unknown;
  };
  weather?: Array<{
    description?: unknown;
  }>;
}

export type ServerAirQualityResult =
  | { ok: true; data: AirQualityData }
  | { ok: false; status: number; error: AirQualityErrorResponse };

// 5-minute server-side TTL cache per rounded coordinate to respect provider quotas
const OW_CACHE_TTL_MS = 5 * 60 * 1000;
const OW_CACHE_MAX = 200;
const owCache = new Map<string, { expiresAt: number; data: AirQualityData }>();
const owInFlight = new Map<string, Promise<ServerAirQualityResult>>();

/** Clears in-memory cache (intended for automated unit tests). */
export function clearOpenWeatherCache(): void {
  owCache.clear();
  owInFlight.clear();
}

function getCachedAirQuality(lat: number, lon: number): AirQualityData | null {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const entry = owCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    owCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedAirQuality(
  lat: number,
  lon: number,
  data: AirQualityData
): void {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  owCache.set(key, { expiresAt: Date.now() + OW_CACHE_TTL_MS, data });
  if (owCache.size > OW_CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of owCache.entries()) {
      if (v.expiresAt <= now) owCache.delete(k);
    }
  }
}

export function parseCoordinate(
  raw: string | number | null | undefined,
  min: number,
  max: number
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function validateAirItem(item: unknown): {
  dt: number;
  aqi: 1 | 2 | 3 | 4 | 5;
  components: {
    pm2_5: number | null;
    pm10: number | null;
    o3: number | null;
    no2: number | null;
    so2: number | null;
    co: number | null;
    nh3: number | null;
    no: number | null;
  };
} | null {
  if (!item || typeof item !== "object") return null;
  const record = item as RawOpenWeatherAirItem;
  if (
    typeof record.dt !== "number" ||
    !Number.isFinite(record.dt) ||
    record.dt <= 0
  ) {
    return null;
  }
  const aqi = record.main?.aqi;
  if (!isValidAqiIndex(aqi)) {
    return null;
  }
  const comp = record.components ?? {};
  return {
    dt: record.dt,
    aqi,
    components: {
      pm2_5: toNullableFiniteNumber(comp.pm2_5),
      pm10: toNullableFiniteNumber(comp.pm10),
      o3: toNullableFiniteNumber(comp.o3),
      no2: toNullableFiniteNumber(comp.no2),
      so2: toNullableFiniteNumber(comp.so2),
      co: toNullableFiniteNumber(comp.co),
      nh3: toNullableFiniteNumber(comp.nh3),
      no: toNullableFiniteNumber(comp.no),
    },
  };
}

function parseWeatherPayload(raw: unknown): WeatherBaseline | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as RawOpenWeatherWeatherPayload;
  const tempC = toNullableFiniteNumber(payload.main?.temp);
  const humidity = toNullableFiniteNumber(payload.main?.humidity);
  const windSpeedMs = toNullableFiniteNumber(payload.wind?.speed);

  if (tempC === null || humidity === null || windSpeedMs === null) {
    return null;
  }

  const description =
    Array.isArray(payload.weather) &&
    typeof payload.weather[0]?.description === "string"
      ? payload.weather[0].description
      : null;

  return {
    tempC,
    humidity,
    windSpeedMs,
    windDeg: toNullableFiniteNumber(payload.wind?.deg),
    pressureHpa: toNullableFiniteNumber(payload.main?.pressure),
    description,
  };
}

/**
 * Fetches and validates live air pollution, 24-hour forecast, and optional weather
 * from OpenWeather alongside independent US EPA AQI (0–500+) from Open-Meteo.
 * Never converts OpenWeather 1–5 to 0–500 or forces both standards to agree.
 */
export async function fetchServerAirQuality(
  lat: number,
  lon: number,
  options?: { bypassCache?: boolean }
): Promise<ServerAirQualityResult> {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (!options?.bypassCache) {
    const cached = getCachedAirQuality(lat, lon);
    if (cached) {
      return { ok: true, data: cached };
    }
    const existingFlight = owInFlight.get(cacheKey);
    if (existingFlight) {
      return existingFlight;
    }
  }

  const flight = (async (): Promise<ServerAirQualityResult> => {
    const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: false,
        status: 503,
        error: {
          error:
            "Live air quality telemetry requires OPENWEATHER_API_KEY in your server environment (.env.local).",
          code: "API_KEY_MISSING",
        },
      };
    }

    const currentUrl = new URL(
      "https://api.openweathermap.org/data/2.5/air_pollution"
    );
    currentUrl.searchParams.set("lat", lat.toFixed(4));
    currentUrl.searchParams.set("lon", lon.toFixed(4));
    currentUrl.searchParams.set("appid", apiKey);

    const forecastUrl = new URL(
      "https://api.openweathermap.org/data/2.5/air_pollution/forecast"
    );
    forecastUrl.searchParams.set("lat", lat.toFixed(4));
    forecastUrl.searchParams.set("lon", lon.toFixed(4));
    forecastUrl.searchParams.set("appid", apiKey);

    const weatherUrl = new URL(
      "https://api.openweathermap.org/data/2.5/weather"
    );
    weatherUrl.searchParams.set("lat", lat.toFixed(4));
    weatherUrl.searchParams.set("lon", lon.toFixed(4));
    weatherUrl.searchParams.set("units", "metric");
    weatherUrl.searchParams.set("appid", apiKey);

    const bypass = Boolean(options?.bypassCache);
    const owFetchInit = bypass
      ? { signal: AbortSignal.timeout(10000), cache: "no-store" as const }
      : { signal: AbortSignal.timeout(10000), next: { revalidate: 300 } };
    const forecastFetchInit = bypass
      ? { signal: AbortSignal.timeout(10000), cache: "no-store" as const }
      : { signal: AbortSignal.timeout(10000), next: { revalidate: 600 } };

    try {
      const [currentRes, forecastRes, weatherRes, usAqiResult, cpcbResult] =
        await Promise.all([
          fetch(currentUrl.toString(), owFetchInit),
          fetch(forecastUrl.toString(), forecastFetchInit).catch(() => null),
          fetch(weatherUrl.toString(), owFetchInit).catch(() => null),
          fetchOpenMeteoUsAqi(lat, lon, { bypassCache: bypass }),
          fetchNearestCpcbStation(lat, lon, { bypassCache: bypass }),
        ]);

      if (currentRes.status === 401 || currentRes.status === 403) {
        return {
          ok: false,
          status: 502,
          error: {
            error:
              "OpenWeather rejected the configured OPENWEATHER_API_KEY. Verify the key is active in .env.local.",
            code: "UPSTREAM_AUTH_ERROR",
          },
        };
      }

      if (currentRes.status === 429) {
        return {
          ok: false,
          status: 429,
          error: {
            error:
              "OpenWeather API rate limit reached. Please retry in a moment.",
            code: "RATE_LIMITED",
          },
        };
      }

      if (!currentRes.ok) {
        return {
          ok: false,
          status: 502,
          error: {
            error: `OpenWeather Air Pollution API returned HTTP ${currentRes.status}.`,
            code: "UPSTREAM_ERROR",
          },
        };
      }

      const currentJson = (await currentRes.json()) as RawOpenWeatherAirPayload;
      const rawCurrentList = Array.isArray(currentJson?.list)
        ? currentJson.list
        : [];
      const currentValidated = validateAirItem(rawCurrentList[0]);

      if (!currentValidated) {
        return {
          ok: false,
          status: 502,
          error: {
            error:
              "Received unexpected or incomplete air quality payload from OpenWeather.",
            code: "INVALID_UPSTREAM_RESPONSE",
          },
        };
      }

      const forecast24h: ForecastPoint[] = [];
      if (forecastRes && forecastRes.ok) {
        try {
          const forecastJson =
            (await forecastRes.json()) as RawOpenWeatherAirPayload;
          const rawForecastList = Array.isArray(forecastJson?.list)
            ? forecastJson.list
            : [];
          const nowSec = Math.floor(Date.now() / 1000);
          const cutoffSec = nowSec + 25 * 3600;

          for (const item of rawForecastList) {
            const valid = validateAirItem(item);
            if (!valid) continue;
            if (valid.dt >= nowSec - 3600 && valid.dt <= cutoffSec) {
              forecast24h.push({
                timestamp: new Date(valid.dt * 1000).toISOString(),
                aqi: valid.aqi,
                pm2_5: valid.components.pm2_5,
                pm10: valid.components.pm10,
                o3: valid.components.o3,
                no2: valid.components.no2,
              });
            }
            if (forecast24h.length >= 25) break;
          }
        } catch {
          // Optional forecast remains empty if malformed
        }
      }

      let weather: WeatherBaseline | null = null;
      if (weatherRes && weatherRes.ok) {
        try {
          const weatherJson: unknown = await weatherRes.json();
          weather = parseWeatherPayload(weatherJson);
        } catch {
          weather = null;
        }
      }

      const owRetLat = toNullableFiniteNumber(currentJson?.coord?.lat);
      const owRetLon = toNullableFiniteNumber(currentJson?.coord?.lon);
      const openWeatherReturnedCoordinates =
        owRetLat !== null && owRetLon !== null
          ? { lat: owRetLat, lon: owRetLon }
          : null;

      const cpcbData = cpcbResult.ok ? cpcbResult.data : null;
      const cpcbRegionalReference = !cpcbResult.ok
        ? cpcbResult.regionalReference
        : null;
      const cpcbFallbackCode = !cpcbResult.ok && isWithinIndiaBounds(lat, lon)
        ? cpcbResult.fallbackCode
        : null;
      const cpcbNearestStationMeta = cpcbResult.ok
        ? cpcbResult.nearestStationMeta
        : isWithinIndiaBounds(lat, lon)
          ? (cpcbResult.nearestStationMeta ?? null)
          : null;
      const usAqiData = usAqiResult.ok ? usAqiResult.data : null;
      const inIndia = isWithinIndiaBounds(lat, lon);
      const cpcbFallbackReason =
        !cpcbResult.ok && inIndia ? cpcbResult.reason : null;

      let primaryAqi: PrimaryAqiReading | null = null;
      if (cpcbData) {
        const cat = classifyCpcbAqi(cpcbData.value);
        primaryAqi = {
          value: cpcbData.value,
          standard: "IND_CPCB",
          standardLabel: "India AQI (CPCB 0–500)",
          category: cat.label,
          provider: cpcbData.provider,
          dataType: "ground_station",
          observedAt: cpcbData.observedAt,
          fetchedAt: cpcbData.fetchedAt,
          freshnessMinutes: cpcbData.freshnessMinutes,
          isStale: cpcbData.isStale,
          stationName: cpcbData.stationName,
          stationDistanceKm: cpcbData.stationDistanceKm,
          returnedCoordinates: cpcbData.stationCoordinates,
          dominantPollutant: {
            key: cpcbData.dominantPollutant.key,
            label: cpcbData.dominantPollutant.label,
            aqi: cpcbData.dominantPollutant.aqi,
          },
          fallbackReason: null,
        };
      } else if (usAqiData) {
        const cat = classifyUsAqi(usAqiData.value);
        primaryAqi = {
          value: usAqiData.value,
          standard: "US_EPA",
          standardLabel: "US EPA AQI (0–500)",
          category: cat.label,
          provider: usAqiData.provider,
          dataType: "modeled_estimate",
          observedAt: usAqiData.validAt,
          fetchedAt: usAqiData.fetchedAt,
          freshnessMinutes: usAqiData.freshnessMinutes ?? 0,
          isStale: usAqiData.isStale ?? false,
          stationName: null,
          stationDistanceKm: null,
          returnedCoordinates: usAqiData.returnedCoordinates ?? null,
          dominantPollutant: usAqiData.dominantPollutant
            ? {
                key: usAqiData.dominantPollutant.key,
                label: usAqiData.dominantPollutant.label,
                aqi: usAqiData.dominantPollutant.aqi,
              }
            : null,
          fallbackReason: cpcbFallbackReason,
        };
      }

      const assembled: AirQualityData = {
        provider: "OpenWeather Air Pollution API (SILAM Modeled)",
        aqiStandard: {
          name: "OpenWeather AQI (1–5)",
          scaleMin: 1,
          scaleMax: 5,
          description:
            "1 = Good, 2 = Fair, 3 = Moderate, 4 = Poor, 5 = Very Poor",
        },
        units: {
          pollutants: "µg/m³",
        },
        coordinates: {
          lat,
          lon,
        },
        openWeatherReturnedCoordinates,
        openWeatherDataType: "modeled_estimate",
        observedAt: new Date(currentValidated.dt * 1000).toISOString(),
        fetchedAt: new Date().toISOString(),
        current: {
          aqi: currentValidated.aqi,
          components: currentValidated.components,
        },
        forecast24h,
        weather,
        usAqi: usAqiData,
        usAqiUnavailableReason: usAqiResult.ok ? null : usAqiResult.reason,
        cpcbAqi: cpcbData,
        cpcbRegionalReference,
        cpcbFallbackCode,
        cpcbUnavailableReason: cpcbFallbackReason,
        cpcbNearestStationMeta,
        primaryAqi,
      };

      setCachedAirQuality(lat, lon, assembled);

      return {
        ok: true,
        data: assembled,
      };
    } catch {
      return {
        ok: false,
        status: 502,
        error: {
          error: "Unable to reach the OpenWeather Air Pollution API right now.",
          code: "UPSTREAM_ERROR",
        },
      };
    } finally {
      owInFlight.delete(cacheKey);
    }
  })();

  if (!options?.bypassCache) {
    owInFlight.set(cacheKey, flight);
  }
  return flight;
}
