import { NextRequest, NextResponse } from "next/server";
import { fetchOpenMeteoUsAqiBatch } from "@/lib/open-meteo-server";
import { fetchNearestCpcbStation } from "@/lib/cpcb-server";
import {
  fetchServerAirQuality,
  parseCoordinate,
} from "@/lib/openweather-server";
import {
  extractClientKey,
  SlidingWindowRateLimiter,
} from "@/lib/rate-limit";
import type { PollutantReadings, WeatherBaseline } from "@/lib/air-quality";
import type { UsAqiTelemetry } from "@/lib/us-aqi";
import type { CpcbAqiTelemetry } from "@/lib/cpcb-aqi";

export const dynamic = "force-dynamic";

const MAX_LOCATIONS_PER_BATCH = 10;
const MAX_BODY_BYTES = 8 * 1024;
const mapMarkersLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 40,
});

export interface MapMarkerInput {
  id: string;
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
}

export interface MapMarkerReading {
  id: string;
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
  usAqi: UsAqiTelemetry | null;
  cpcbAqi: CpcbAqiTelemetry | null;
  openWeather: {
    aqi: 1 | 2 | 3 | 4 | 5;
    observedAt: string;
    components: PollutantReadings;
    weather: WeatherBaseline | null;
  } | null;
}

export interface MapMarkersApiResponse {
  fetchedAt: string;
  markers: MapMarkerReading[];
}

export async function POST(request: NextRequest) {
  const rate = mapMarkersLimiter.consume(extractClientKey(request.headers));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many map refresh requests. Please retry in ${rate.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Unable to read request body." },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Map marker payload exceeds the 8 KB limit." },
      { status: 413 }
    );
  }

  let body: { locations?: unknown };
  try {
    body = JSON.parse(rawText) as { locations?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body?.locations) || body.locations.length === 0) {
    return NextResponse.json(
      { error: "At least one location is required." },
      { status: 400 }
    );
  }

  const validLocations: MapMarkerInput[] = [];
  for (const raw of body.locations.slice(0, MAX_LOCATIONS_PER_BATCH)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<MapMarkerInput>;
    const lat = parseCoordinate(item.lat, -90, 90);
    const lon = parseCoordinate(item.lon, -180, 180);
    if (
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      lat === null ||
      lon === null
    ) {
      continue;
    }
    validLocations.push({
      id: item.id.slice(0, 80),
      name: item.name.slice(0, 80),
      region:
        typeof item.region === "string" ? item.region.slice(0, 60) : undefined,
      country:
        typeof item.country === "string"
          ? item.country.slice(0, 40)
          : undefined,
      lat,
      lon,
    });
  }

  if (validLocations.length === 0) {
    return NextResponse.json(
      { error: "No valid coordinates provided." },
      { status: 400 }
    );
  }

  // 1. Single batched Open-Meteo call (cached 5m per rounded coord) for US AQI 0–500+
  const usAqiBatchPromise = fetchOpenMeteoUsAqiBatch(
    validLocations.map((l) => ({ lat: l.lat, lon: l.lon }))
  );

  // 2. Shared 15-min India CPCB snapshot lookup (only triggers for Indian coordinates)
  const cpcbBatchPromise = Promise.all(
    validLocations.map(async (loc) => {
      const res = await fetchNearestCpcbStation(loc.lat, loc.lon);
      return res.ok ? res.data : null;
    })
  );

  // 3. Cached OpenWeather fetches (only when OPENWEATHER_API_KEY is configured)
  const hasOwKey = Boolean(process.env.OPENWEATHER_API_KEY?.trim());
  const owBatchPromise = hasOwKey
    ? Promise.all(
        validLocations.map(async (loc) => {
          const res = await fetchServerAirQuality(loc.lat, loc.lon);
          if (!res.ok) return null;
          return {
            aqi: res.data.current.aqi,
            observedAt: res.data.observedAt,
            components: res.data.current.components,
            weather: res.data.weather,
          };
        })
      )
    : Promise.resolve(validLocations.map(() => null));

  const [usAqiList, cpcbList, owList] = await Promise.all([
    usAqiBatchPromise,
    cpcbBatchPromise,
    owBatchPromise,
  ]);

  const markers: MapMarkerReading[] = validLocations.map((loc, idx) => ({
    ...loc,
    usAqi: usAqiList[idx] ?? null,
    cpcbAqi: cpcbList[idx] ?? null,
    openWeather: owList[idx] ?? null,
  }));

  return NextResponse.json<MapMarkersApiResponse>(
    {
      fetchedAt: new Date().toISOString(),
      markers,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=120",
      },
    }
  );
}
