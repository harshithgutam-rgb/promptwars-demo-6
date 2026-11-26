import { NextRequest, NextResponse } from "next/server";
import {
  type AirQualityData,
  type AirQualityErrorResponse,
} from "@/lib/air-quality";
import {
  fetchServerAirQuality,
  parseCoordinate,
} from "@/lib/openweather-server";
import {
  extractClientKey,
  SlidingWindowRateLimiter,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const airQualityLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
});

export async function GET(request: NextRequest) {
  const rate = airQualityLimiter.consume(extractClientKey(request.headers));
  if (!rate.allowed) {
    return NextResponse.json<AirQualityErrorResponse>(
      {
        error: `Too many air quality requests. Please retry in ${rate.retryAfterSeconds}s.`,
        code: "RATE_LIMITED",
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
  const lat = parseCoordinate(searchParams.get("lat"), -90, 90);
  const lon = parseCoordinate(searchParams.get("lon"), -180, 180);

  if (lat === null || lon === null) {
    return NextResponse.json<AirQualityErrorResponse>(
      {
        error:
          "Valid latitude (-90 to 90) and longitude (-180 to 180) are required.",
        code: "INVALID_COORDINATES",
      },
      { status: 400 }
    );
  }

  const refresh = searchParams.get("refresh") === "1";

  const result = await fetchServerAirQuality(lat, lon, {
    bypassCache: refresh,
  });
  if (!result.ok) {
    return NextResponse.json<AirQualityErrorResponse>(result.error, {
      status: result.status,
    });
  }

  return NextResponse.json<AirQualityData>(result.data, {
    status: 200,
    headers: {
      "Cache-Control": refresh ? "no-store" : "private, max-age=120",
    },
  });
}
