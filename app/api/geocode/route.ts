import { NextRequest, NextResponse } from "next/server";
import { type GeocodeApiResponse, type GeocodeResult } from "@/lib/air-quality";
import { parseCoordinate } from "@/lib/openweather-server";
import {
  extractClientKey,
  SlidingWindowRateLimiter,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const geocodeLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
});

interface RawOpenWeatherGeoItem {
  name?: unknown;
  state?: unknown;
  country?: unknown;
  lat?: unknown;
  lon?: unknown;
}

interface RawOpenMeteoGeoResponse {
  results?: Array<{
    id?: unknown;
    name?: unknown;
    admin1?: unknown;
    country_code?: unknown;
    country?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  }>;
}

function makeGeoId(name: string, lat: number, lon: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "loc"}-${lat.toFixed(3)}-${lon.toFixed(3)}`;
}

async function searchWithOpenWeather(
  query: string,
  apiKey: string
): Promise<GeocodeResult[] | null> {
  const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  url.searchParams.set("appid", apiKey);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return null;

  const results: GeocodeResult[] = [];
  for (const item of data as RawOpenWeatherGeoItem[]) {
    if (
      typeof item?.name !== "string" ||
      typeof item?.lat !== "number" ||
      !Number.isFinite(item.lat) ||
      typeof item?.lon !== "number" ||
      !Number.isFinite(item.lon)
    ) {
      continue;
    }
    results.push({
      id: makeGeoId(item.name, item.lat, item.lon),
      name: item.name,
      region: typeof item.state === "string" && item.state ? item.state : undefined,
      country: typeof item.country === "string" && item.country ? item.country : undefined,
      lat: item.lat,
      lon: item.lon,
    });
  }
  return results;
}

async function searchWithOpenMeteo(query: string): Promise<GeocodeResult[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo geocoding returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as RawOpenMeteoGeoResponse;
  const items = Array.isArray(data?.results) ? data.results : [];
  const results: GeocodeResult[] = [];

  for (const item of items) {
    if (
      typeof item?.name !== "string" ||
      typeof item?.latitude !== "number" ||
      !Number.isFinite(item.latitude) ||
      typeof item?.longitude !== "number" ||
      !Number.isFinite(item.longitude)
    ) {
      continue;
    }
    results.push({
      id: makeGeoId(item.name, item.latitude, item.longitude),
      name: item.name,
      region: typeof item.admin1 === "string" && item.admin1 ? item.admin1 : undefined,
      country:
        typeof item.country_code === "string" && item.country_code
          ? item.country_code
          : typeof item.country === "string"
            ? item.country
            : undefined,
      lat: item.latitude,
      lon: item.longitude,
    });
  }

  return results;
}

async function reverseWithOpenWeather(
  lat: number,
  lon: number,
  apiKey: string
): Promise<GeocodeResult | null> {
  const url = new URL("https://api.openweathermap.org/geo/1.0/reverse");
  url.searchParams.set("lat", lat.toFixed(4));
  url.searchParams.set("lon", lon.toFixed(4));
  url.searchParams.set("limit", "1");
  url.searchParams.set("appid", apiKey);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0] as RawOpenWeatherGeoItem;
  if (typeof first?.name !== "string") return null;

  return {
    id: makeGeoId(first.name, lat, lon),
    name: first.name,
    region: typeof first.state === "string" && first.state ? first.state : undefined,
    country: typeof first.country === "string" && first.country ? first.country : undefined,
    lat,
    lon,
  };
}

export async function GET(request: NextRequest) {
  const rate = geocodeLimiter.consume(extractClientKey(request.headers));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many location searches. Please retry in ${rate.retryAfterSeconds}s.`,
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

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const lat = parseCoordinate(searchParams.get("lat"), -90, 90);
  const lon = parseCoordinate(searchParams.get("lon"), -180, 180);
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();

  // Mode 1: Reverse geocoding for detected GPS coordinates
  if (lat !== null && lon !== null && !query) {
    try {
      if (apiKey) {
        const result = await reverseWithOpenWeather(lat, lon, apiKey);
        if (result) {
          return NextResponse.json<GeocodeApiResponse>({
            provider: "OpenWeather Geocoding API",
            results: [result],
          });
        }
      }

      // Clean fallback with coordinate identity if reverse geocoding is unavailable
      return NextResponse.json<GeocodeApiResponse>({
        provider: "Coordinates Fallback",
        results: [
          {
            id: makeGeoId("my-location", lat, lon),
            name: "Current Location",
            lat,
            lon,
          },
        ],
      });
    } catch {
      return NextResponse.json<GeocodeApiResponse>({
        provider: "Coordinates Fallback",
        results: [
          {
            id: makeGeoId("my-location", lat, lon),
            name: "Current Location",
            lat,
            lon,
          },
        ],
      });
    }
  }

  // Mode 2: Forward worldwide city search
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Enter at least 2 characters to search worldwide cities." },
      { status: 400 }
    );
  }

  if (query.length > 100) {
    return NextResponse.json({ error: "Search query is too long." }, { status: 400 });
  }

  try {
    if (apiKey) {
      const owResults = await searchWithOpenWeather(query, apiKey).catch(() => null);
      if (owResults !== null) {
        return NextResponse.json<GeocodeApiResponse>({
          provider: "OpenWeather Geocoding API",
          results: owResults,
        });
      }
    }

    const fallbackResults = await searchWithOpenMeteo(query);
    return NextResponse.json<GeocodeApiResponse>({
      provider: "Open-Meteo Geocoding API",
      results: fallbackResults,
    });
  } catch {
    return NextResponse.json(
      { error: "Worldwide city search is temporarily unavailable. Please try again." },
      { status: 502 }
    );
  }
}
