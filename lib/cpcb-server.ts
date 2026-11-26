import {
  CPCB_POLICY,
  CPCB_STANDARD_DISCLOSURE,
  evaluateCpcbStationAqi,
  haversineDistanceKm,
  isWithinIndiaBounds,
  normalizeCpcbPollutantId,
  parseCpcbSubIndexValue,
  parseCpcbTimestampToUtcIso,
  type CpcbAqiTelemetry,
  type CpcbDistanceBand,
  type CpcbFallbackCode,
  type CpcbNearestStationMeta,
  type CpcbSubIndices,
  type CpcbUsageRole,
} from "@/lib/cpcb-aqi";

const CPCB_RESOURCE_URL =
  "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";

const CPCB_SNAPSHOT_TTL_MS = 15 * 60 * 1000; // 15-minute shared snapshot cache
const PAGE_LIMIT = 4000;
const MAX_PAGES = 10; // Supports up to 40,000 records cleanly if CPCB expands >4,000 rows

interface RawCpcbRecord {
  country?: unknown;
  state?: unknown;
  city?: unknown;
  station?: unknown;
  last_update?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  pollutant_id?: unknown;
  avg_value?: unknown;
  pollutant_avg?: unknown;
}

interface RawCpcbApiResponse {
  total?: unknown;
  records?: unknown;
}

interface ParsedCpcbStation {
  stationName: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  observedAt: string;
  subIndices: CpcbSubIndices;
}

interface SnapshotCacheEntry {
  expiresAt: number;
  fetchedAt: string;
  totalRecords: number;
  stations: ParsedCpcbStation[];
}

export type CpcbLookupResult =
  | {
      ok: true;
      data: CpcbAqiTelemetry;
      regionalReference: null;
      fallbackCode: null;
      nearestStationMeta: CpcbNearestStationMeta;
    }
  | {
      ok: false;
      fallbackCode: CpcbFallbackCode;
      reason: string;
      regionalReference: CpcbAqiTelemetry | null;
      nearestStationDistanceKm?: number | null;
      nearestStationMeta?: CpcbNearestStationMeta | null;
    };

let cpcbSnapshotCache: SnapshotCacheEntry | null = null;
let cpcbSnapshotInFlight: Promise<SnapshotCacheEntry | null> | null = null;

/** Clears in-memory CPCB snapshot cache (intended for automated unit tests). */
export function clearCpcbCache(): void {
  cpcbSnapshotCache = null;
  cpcbSnapshotInFlight = null;
}

function createEmptySubIndices(): CpcbSubIndices {
  return {
    pm2_5: null,
    pm10: null,
    no2: null,
    so2: null,
    co: null,
    o3: null,
    nh3: null,
  };
}

function groupCpcbRecordsToStations(
  records: RawCpcbRecord[]
): ParsedCpcbStation[] {
  const byStation = new Map<string, ParsedCpcbStation>();

  for (const rec of records) {
    if (!rec || typeof rec !== "object") continue;
    const stationName =
      typeof rec.station === "string" ? rec.station.trim() : "";
    if (!stationName) continue;

    const lat = Number(rec.latitude);
    const lon = Number(rec.longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      (lat === 0 && lon === 0) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      continue;
    }

    const observedAt = parseCpcbTimestampToUtcIso(rec.last_update);
    if (!observedAt) continue;

    // Deduplicate cleanly by station name + rounded coordinates
    const stationKey = `${stationName}|${lat.toFixed(4)},${lon.toFixed(4)}`;
    let entry = byStation.get(stationKey);
    if (!entry) {
      entry = {
        stationName,
        city: typeof rec.city === "string" ? rec.city.trim() : "",
        state: typeof rec.state === "string" ? rec.state.trim() : "",
        lat,
        lon,
        observedAt,
        subIndices: createEmptySubIndices(),
      };
      byStation.set(stationKey, entry);
    } else if (observedAt > entry.observedAt) {
      entry.observedAt = observedAt;
    }

    const polKey = normalizeCpcbPollutantId(rec.pollutant_id);
    if (!polKey) continue;

    // Live data.gov.in JSON uses `avg_value`; also support `pollutant_avg` alias
    const rawVal = rec.avg_value ?? rec.pollutant_avg;
    const parsedVal = parseCpcbSubIndexValue(rawVal, polKey);
    if (parsedVal !== null) {
      entry.subIndices[polKey] = parsedVal;
    }
  }

  return Array.from(byStation.values());
}

async function fetchIndiaCpcbSnapshot(
  apiKey: string,
  bypassCache: boolean
): Promise<SnapshotCacheEntry | null> {
  if (
    !bypassCache &&
    cpcbSnapshotCache &&
    Date.now() < cpcbSnapshotCache.expiresAt
  ) {
    return cpcbSnapshotCache;
  }

  if (!bypassCache && cpcbSnapshotInFlight) {
    return cpcbSnapshotInFlight;
  }

  const flight = (async (): Promise<SnapshotCacheEntry | null> => {
    try {
      const allRecords: RawCpcbRecord[] = [];
      let totalExpected = 0;

      for (let page = 0; page < MAX_PAGES; page++) {
        const url = new URL(CPCB_RESOURCE_URL);
        url.searchParams.set("api-key", apiKey);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", String(PAGE_LIMIT));
        url.searchParams.set("offset", String(page * PAGE_LIMIT));

        // Use cache: "no-store" here because the full India snapshot (~2.2 MB)
        // exceeds Next.js's 2 MB Data Cache cap (which would fail & log the URL).
        // Caching is handled cleanly in-memory by cpcbSnapshotCache (15 min TTL).
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });

        if (!res.ok) {
          return null;
        }

        const payload = (await res.json()) as RawCpcbApiResponse;
        const pageRecords = Array.isArray(payload.records)
          ? (payload.records as RawCpcbRecord[])
          : [];
        allRecords.push(...pageRecords);

        const parsedTotal = Number(payload.total);
        if (Number.isFinite(parsedTotal) && parsedTotal > totalExpected) {
          totalExpected = parsedTotal;
        }

        if (
          pageRecords.length === 0 ||
          pageRecords.length < PAGE_LIMIT ||
          (totalExpected > 0 && allRecords.length >= totalExpected)
        ) {
          break;
        }
      }

      if (allRecords.length === 0) {
        return null;
      }

      const fetchedAt = new Date().toISOString();
      const stations = groupCpcbRecordsToStations(allRecords);
      if (stations.length === 0) {
        return null;
      }

      const entry: SnapshotCacheEntry = {
        expiresAt: Date.now() + CPCB_SNAPSHOT_TTL_MS,
        fetchedAt,
        totalRecords: allRecords.length,
        stations,
      };
      cpcbSnapshotCache = entry;
      return entry;
    } catch {
      return null;
    } finally {
      cpcbSnapshotInFlight = null;
    }
  })();

  if (!bypassCache) {
    cpcbSnapshotInFlight = flight;
  }
  return flight;
}

function buildCpcbTelemetry(
  station: ParsedCpcbStation,
  distKm: number,
  freshnessMinutes: number,
  fetchedAt: string,
  evaluated: NonNullable<ReturnType<typeof evaluateCpcbStationAqi>>,
  distanceBand: CpcbDistanceBand,
  usageRole: CpcbUsageRole
): CpcbAqiTelemetry {
  return {
    provider: "Central Pollution Control Board (CPCB) via data.gov.in",
    attributionName: "CPCB / data.gov.in",
    attributionUrl: "https://data.gov.in/",
    license: "GODL-India",
    label:
      usageRole === "regional_reference"
        ? "Regional CPCB Reference Station (25–50 km)"
        : distanceBand === "extended_25km"
          ? "India AQI (CPCB) — Nearby Station (10–25 km)"
          : "India AQI (CPCB) — Ground Monitoring Station",
    dataType: "ground_station",
    standardName: "India CPCB National AQI (0–500)",
    standardNote: CPCB_STANDARD_DISCLOSURE,
    stationName: station.stationName,
    city: station.city,
    state: station.state,
    stationCoordinates: {
      lat: station.lat,
      lon: station.lon,
    },
    stationDistanceKm: distKm,
    distanceBand,
    usageRole,
    observedAt: station.observedAt,
    fetchedAt,
    freshnessMinutes,
    isStale: freshnessMinutes > CPCB_POLICY.STALE_WARNING_MINUTES,
    value: evaluated.value,
    validPollutantCount: evaluated.validPollutantCount,
    subIndices: station.subIndices,
    dominantPollutant: evaluated.dominantPollutant,
  };
}

function buildNearestStationMeta(
  station: ParsedCpcbStation,
  distKm: number,
  freshnessMinutes: number,
  evaluated: ReturnType<typeof evaluateCpcbStationAqi>
): CpcbNearestStationMeta {
  const validCount = Object.values(station.subIndices).filter(
    (v) => v !== null && Number.isFinite(v)
  ).length;
  return {
    stationName: station.stationName,
    city: station.city,
    state: station.state,
    distanceKm: distKm,
    observedAt: station.observedAt,
    freshnessMinutes,
    valid: Boolean(evaluated),
    validPollutantCount: evaluated?.validPollutantCount ?? validCount,
    value: evaluated?.value ?? null,
    dominantPollutantLabel: evaluated?.dominantPollutant.label ?? null,
  };
}

/**
 * Finds the nearest fresh, CPCB-valid official Indian monitoring station using
 * geographical coordinates and Haversine distance (never exact city-name matching):
 * - <= 10 km: Primary CPCB (local)
 * - 10–25 km: Primary CPCB with explicit station-distance disclosure
 * - 25–50 km: Retain Open-Meteo primary; return nearest valid CPCB station as regional reference ONLY
 * - > 50 km: Retain Open-Meteo primary with structured fallback reason
 */
export async function fetchNearestCpcbStation(
  lat: number,
  lon: number,
  options?: { bypassCache?: boolean; nowMs?: number }
): Promise<CpcbLookupResult> {
  if (!isWithinIndiaBounds(lat, lon)) {
    return {
      ok: false,
      fallbackCode: "outside_india",
      regionalReference: null,
      reason: "Coordinates are outside India's CPCB monitoring network.",
    };
  }

  const apiKey = process.env.DATA_GOV_IN_API_KEY?.trim();
  if (
    !apiKey ||
    apiKey.startsWith("REPLACE_WITH_") ||
    apiKey.startsWith("your_")
  ) {
    return {
      ok: false,
      fallbackCode: "key_missing",
      regionalReference: null,
      reason:
        "DATA_GOV_IN_API_KEY is not configured; using Open-Meteo US AQI modeled estimate.",
    };
  }

  const snapshot = await fetchIndiaCpcbSnapshot(
    apiKey,
    Boolean(options?.bypassCache)
  );
  if (!snapshot) {
    return {
      ok: false,
      fallbackCode: "provider_unavailable",
      regionalReference: null,
      reason:
        "CPCB monitoring feed via data.gov.in is temporarily unavailable; showing Open-Meteo US AQI modeled estimate.",
    };
  }

  const nowMs = options?.nowMs ?? Date.now();
  const candidates = snapshot.stations
    .map((station) => {
      const distKm = haversineDistanceKm(lat, lon, station.lat, station.lon);
      const observedMs = Date.parse(station.observedAt);
      const freshnessMinutes = Number.isFinite(observedMs)
        ? Math.max(0, Math.round((nowMs - observedMs) / 60_000))
        : Number.POSITIVE_INFINITY;
      const evaluated = evaluateCpcbStationAqi(station.subIndices);
      return { station, distKm, freshnessMinutes, evaluated };
    })
    .sort((a, b) => a.distKm - b.distKm);

  const absoluteNearest = candidates[0] ?? null;
  const absoluteNearestMeta = absoluteNearest
    ? buildNearestStationMeta(
        absoluteNearest.station,
        absoluteNearest.distKm,
        absoluteNearest.freshnessMinutes,
        absoluteNearest.evaluated
      )
    : null;

  let sawStaleWithin25: (typeof candidates)[number] | null = null;
  let sawInvalidWithin25: (typeof candidates)[number] | null = null;
  let regionalRefCandidate: (typeof candidates)[number] | null = null;

  for (const cand of candidates) {
    if (cand.distKm > CPCB_POLICY.REGIONAL_REFERENCE_MAX_KM) break;

    const isPrimaryRadius = cand.distKm <= CPCB_POLICY.EXTENDED_PRIMARY_MAX_KM;
    const isFresh = cand.freshnessMinutes <= CPCB_POLICY.MAX_AGE_MINUTES;

    if (!isFresh) {
      if (isPrimaryRadius && !sawStaleWithin25) sawStaleWithin25 = cand;
      continue;
    }

    if (!cand.evaluated) {
      if (isPrimaryRadius && !sawInvalidWithin25) sawInvalidWithin25 = cand;
      continue;
    }

    // Valid, fresh CPCB station within 25 km -> PRIMARY
    if (isPrimaryRadius) {
      const distanceBand: CpcbDistanceBand =
        cand.distKm <= CPCB_POLICY.LOCAL_PRIMARY_MAX_KM
          ? "local_10km"
          : "extended_25km";
      const data = buildCpcbTelemetry(
        cand.station,
        cand.distKm,
        cand.freshnessMinutes,
        snapshot.fetchedAt,
        cand.evaluated,
        distanceBand,
        "primary"
      );
      return {
        ok: true,
        data,
        regionalReference: null,
        fallbackCode: null,
        nearestStationMeta: buildNearestStationMeta(
          cand.station,
          cand.distKm,
          cand.freshnessMinutes,
          cand.evaluated
        ),
      };
    }

    // Valid, fresh CPCB station between 25 and 50 km -> REGIONAL REFERENCE ONLY
    if (!regionalRefCandidate) {
      regionalRefCandidate = cand;
    }
  }

  const regionalReference =
    regionalRefCandidate && regionalRefCandidate.evaluated
      ? buildCpcbTelemetry(
          regionalRefCandidate.station,
          regionalRefCandidate.distKm,
          regionalRefCandidate.freshnessMinutes,
          snapshot.fetchedAt,
          regionalRefCandidate.evaluated,
          "regional_50km",
          "regional_reference"
        )
      : null;

  if (sawStaleWithin25) {
    return {
      ok: false,
      fallbackCode: "station_stale",
      regionalReference,
      nearestStationDistanceKm: sawStaleWithin25.distKm,
      nearestStationMeta: buildNearestStationMeta(
        sawStaleWithin25.station,
        sawStaleWithin25.distKm,
        sawStaleWithin25.freshnessMinutes,
        sawStaleWithin25.evaluated
      ),
      reason: `Nearest CPCB station (${sawStaleWithin25.station.stationName}, ${sawStaleWithin25.distKm.toFixed(1)} km) has stale data (>3h old); showing Open-Meteo US AQI modeled estimate.`,
    };
  }

  if (sawInvalidWithin25) {
    return {
      ok: false,
      fallbackCode: "insufficient_pollutants",
      regionalReference,
      nearestStationDistanceKm: sawInvalidWithin25.distKm,
      nearestStationMeta: buildNearestStationMeta(
        sawInvalidWithin25.station,
        sawInvalidWithin25.distKm,
        sawInvalidWithin25.freshnessMinutes,
        sawInvalidWithin25.evaluated
      ),
      reason: `Nearest CPCB station (${sawInvalidWithin25.station.stationName}, ${sawInvalidWithin25.distKm.toFixed(1)} km) lacks sufficient valid pollutants (requires PM2.5/PM10 and ≥3 metrics); showing Open-Meteo US AQI modeled estimate.`,
    };
  }

  if (regionalReference) {
    return {
      ok: false,
      fallbackCode: "regional_only_25_to_50km",
      regionalReference,
      nearestStationDistanceKm: regionalReference.stationDistanceKm,
      nearestStationMeta: absoluteNearestMeta,
      reason: `No CPCB station within 25 km — showing Open-Meteo US AQI as primary. Nearest regional CPCB reference is ${regionalReference.stationName} (${regionalReference.stationDistanceKm.toFixed(1)} km away).`,
    };
  }

  return {
    ok: false,
    fallbackCode: "no_nearby_station",
    regionalReference: null,
    nearestStationDistanceKm: absoluteNearest?.distKm ?? null,
    nearestStationMeta: absoluteNearestMeta,
    reason:
      absoluteNearest !== null
        ? `No nearby CPCB monitoring station within 50 km (nearest is ${absoluteNearest.station.stationName}, ${absoluteNearest.distKm.toFixed(1)} km away); showing Open-Meteo US AQI modeled estimate.`
        : "No nearby CPCB monitoring station available; showing Open-Meteo US AQI modeled estimate.",
  };
}
