import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  classifyCpcbAqi,
  evaluateCpcbStationAqi,
  isWithinIndiaBounds,
  parseCpcbSubIndexValue,
  parseCpcbTimestampToUtcIso,
} from "@/lib/cpcb-aqi";
import { clearCpcbCache, fetchNearestCpcbStation } from "@/lib/cpcb-server";
import {
  clearOpenMeteoCache,
  fetchOpenMeteoUsAqi,
  fetchOpenMeteoUsAqiBatch,
} from "@/lib/open-meteo-server";

const originalFetch = globalThis.fetch;
const originalCpcbKey = process.env.DATA_GOV_IN_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCpcbKey === undefined) {
    delete process.env.DATA_GOV_IN_API_KEY;
  } else {
    process.env.DATA_GOV_IN_API_KEY = originalCpcbKey;
  }
  clearCpcbCache();
  clearOpenMeteoCache();
});

describe("India CPCB IND-NAQI Classification, Parsing & Validity Rules", () => {
  it("classifies all official 6 CPCB IND-NAQI bands plus >500 overflow", () => {
    assert.equal(classifyCpcbAqi(25).label, "Good");
    assert.equal(classifyCpcbAqi(50).label, "Good");
    assert.equal(classifyCpcbAqi(51).label, "Satisfactory");
    assert.equal(classifyCpcbAqi(100).label, "Satisfactory");
    assert.equal(classifyCpcbAqi(101).label, "Moderate");
    assert.equal(classifyCpcbAqi(200).label, "Moderate");
    assert.equal(classifyCpcbAqi(201).label, "Poor");
    assert.equal(classifyCpcbAqi(300).label, "Poor");
    assert.equal(classifyCpcbAqi(301).label, "Very Poor");
    assert.equal(classifyCpcbAqi(400).label, "Very Poor");
    assert.equal(classifyCpcbAqi(401).label, "Severe");
    assert.equal(classifyCpcbAqi(500).label, "Severe");
    assert.equal(classifyCpcbAqi(540).isBeyondScale, true);
  });

  it("parses IST CPCB timestamps accurately into UTC ISO strings", () => {
    assert.equal(
      parseCpcbTimestampToUtcIso("25-11-2026 03:00:00"),
      "2026-11-24T21:30:00.000Z"
    );
    assert.equal(parseCpcbTimestampToUtcIso("not-a-date"), null);
  });

  it("preserves valid zero sub-indices while rejecting NA, null, and negative readings", () => {
    assert.equal(parseCpcbSubIndexValue("NA", "pm2_5"), null);
    assert.equal(parseCpcbSubIndexValue("", "pm10"), null);
    assert.equal(parseCpcbSubIndexValue(null, "pm2_5"), null);
    assert.equal(parseCpcbSubIndexValue("-5", "no2"), null);
    // Valid zero sub-indices (e.g., NH3=0, O3=0) must NOT be rejected
    assert.equal(parseCpcbSubIndexValue("0", "nh3"), 0);
    assert.equal(parseCpcbSubIndexValue("0", "o3"), 0);
    assert.equal(parseCpcbSubIndexValue("292", "pm2_5"), 292);
  });

  it("enforces official CPCB minimum-3-pollutants + PM2.5/PM10 validity rule (counting valid zeros, rejecting all-zero dead sensors)", () => {
    // Only CO present (like City Railway Station, Bengaluru) -> INVALID
    const coOnly = evaluateCpcbStationAqi({
      pm2_5: null,
      pm10: null,
      no2: null,
      so2: null,
      co: 101,
      o3: null,
      nh3: null,
    });
    assert.equal(coOnly, null);

    // 3 gases without PM2.5 or PM10 -> INVALID
    const noParticulates = evaluateCpcbStationAqi({
      pm2_5: null,
      pm10: null,
      no2: 30,
      so2: 12,
      co: 45,
      o3: 28,
      nh3: null,
    });
    assert.equal(noParticulates, null);

    // All-zero dead sensor -> INVALID (overall AQI must be >= 1)
    const allZero = evaluateCpcbStationAqi({
      pm2_5: 0,
      pm10: 0,
      no2: 0,
      so2: null,
      co: null,
      o3: null,
      nh3: null,
    });
    assert.equal(allZero, null);

    // Valid station with PM2.5 + two 0-value gases -> VALID (3 valid pollutants, AQI 42)
    const withValidZeros = evaluateCpcbStationAqi({
      pm2_5: 42,
      pm10: null,
      no2: 0,
      so2: null,
      co: null,
      o3: null,
      nh3: 0,
    });
    assert.ok(withValidZeros);
    assert.equal(withValidZeros.value, 42);
    assert.equal(withValidZeros.validPollutantCount, 3);

    // Valid station (matches Hombegowda Nagar, Bengaluru)
    const valid = evaluateCpcbStationAqi({
      pm2_5: 21,
      pm10: 25,
      no2: 23,
      so2: 10,
      co: 17,
      o3: 21,
      nh3: 1,
    });
    assert.ok(valid);
    assert.equal(valid.value, 25);
    assert.equal(valid.dominantPollutant.label, "PM10");
    assert.equal(valid.validPollutantCount, 7);
  });
});

describe("CPCB Server Station Selection, Distance Cap, Freshness & Fallback", () => {
  const sampleRecords = [
    // Nearer Bangalore station with only CO (invalid under CPCB rules)
    {
      station: "City Railway Station, Bengaluru - KSPCB",
      city: "Bengaluru",
      state: "Karnataka",
      latitude: "12.9756843",
      longitude: "77.5660749",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "PM2.5",
      avg_value: "NA",
    },
    {
      station: "City Railway Station, Bengaluru - KSPCB",
      city: "Bengaluru",
      state: "Karnataka",
      latitude: "12.9756843",
      longitude: "77.5660749",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "CO",
      avg_value: "101",
    },
    // Slightly farther valid Bangalore station (3.7 km)
    {
      station: "Hombegowda Nagar, Bengaluru - KSPCB",
      city: "Bengaluru",
      state: "Karnataka",
      latitude: "12.938539",
      longitude: "77.5901",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "PM2.5",
      avg_value: "21",
    },
    {
      station: "Hombegowda Nagar, Bengaluru - KSPCB",
      city: "Bengaluru",
      state: "Karnataka",
      latitude: "12.938539",
      longitude: "77.5901",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "PM10",
      avg_value: "25",
    },
    {
      station: "Hombegowda Nagar, Bengaluru - KSPCB",
      city: "Bengaluru",
      state: "Karnataka",
      latitude: "12.938539",
      longitude: "77.5901",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "NO2",
      avg_value: "23",
    },
    // Hyderabad station (~122 km from Warangal)
    {
      station: "ECIL Kapra, Hyderabad - TSPCB",
      city: "Hyderabad",
      state: "Telangana",
      latitude: "17.470431",
      longitude: "78.566959",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "PM10",
      avg_value: "65",
    },
    {
      station: "ECIL Kapra, Hyderabad - TSPCB",
      city: "Hyderabad",
      state: "Telangana",
      latitude: "17.470431",
      longitude: "78.566959",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "PM2.5",
      avg_value: "47",
    },
    {
      station: "ECIL Kapra, Hyderabad - TSPCB",
      city: "Hyderabad",
      state: "Telangana",
      latitude: "17.470431",
      longitude: "78.566959",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "CO",
      avg_value: "22",
    },
  ];

  it("skips invalid nearer station, enforces 25 km Warangal fallback, rejects stale data, and skips non-India calls", async () => {
    process.env.DATA_GOV_IN_API_KEY = "test-cpcb-key";
    let fetchCalls = 0;

    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({ total: sampleRecords.length, records: sampleRecords }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const freshNowMs = Date.parse("2026-11-24T22:15:00.000Z"); // 45m after 03:00 IST

    // 1. London (outside India) triggers ZERO data.gov.in fetches
    assert.equal(isWithinIndiaBounds(51.5074, -0.1278), false);
    const london = await fetchNearestCpcbStation(51.5074, -0.1278, {
      nowMs: freshNowMs,
    });
    assert.equal(london.ok, false);
    assert.equal(fetchCalls, 0);

    // 2. Bangalore skips CO-only City Railway Station and picks Hombegowda Nagar (<= 10 km local)
    const blr = await fetchNearestCpcbStation(12.9716, 77.5946, {
      nowMs: freshNowMs,
    });
    assert.equal(blr.ok, true);
    assert.equal(blr.data.stationName, "Hombegowda Nagar, Bengaluru - KSPCB");
    assert.equal(blr.data.distanceBand, "local_10km");
    assert.equal(blr.data.usageRole, "primary");
    assert.equal(blr.data.value, 25);
    assert.equal(blr.data.dominantPollutant.label, "PM10");
    assert.equal(blr.data.freshnessMinutes, 45);
    assert.equal(blr.data.isStale, false);
    assert.equal(fetchCalls, 1);

    // 3. 10–25 km point (~15 km south of Hombegowda Nagar) uses primary CPCB with extended_25km band
    const blrExtended = await fetchNearestCpcbStation(12.805, 77.5901, {
      nowMs: freshNowMs,
    });
    assert.equal(blrExtended.ok, true);
    assert.equal(blrExtended.data.distanceBand, "extended_25km");
    assert.equal(blrExtended.data.usageRole, "primary");
    assert.equal(fetchCalls, 1);

    // 4. 25–50 km point (~35 km south of Hombegowda Nagar) retains Open-Meteo primary + regional CPCB reference
    const blrRegional = await fetchNearestCpcbStation(12.625, 77.5901, {
      nowMs: freshNowMs,
    });
    assert.equal(blrRegional.ok, false);
    assert.equal(blrRegional.fallbackCode, "regional_only_25_to_50km");
    assert.ok(blrRegional.regionalReference);
    assert.equal(blrRegional.regionalReference.distanceBand, "regional_50km");
    assert.equal(blrRegional.regionalReference.usageRole, "regional_reference");
    assert.equal(blrRegional.regionalReference.value, 25);
    assert.equal(fetchCalls, 1);

    // 5. Warangal (122 km from Hyderabad station, > 50 km) cleanly falls back with no regional reference
    const wgl = await fetchNearestCpcbStation(17.9689, 79.5941, {
      nowMs: freshNowMs,
    });
    assert.equal(wgl.ok, false);
    assert.equal(wgl.fallbackCode, "no_nearby_station");
    assert.equal(wgl.regionalReference, null);
    assert.match(wgl.reason, /within 50 km/i);
    assert.equal(fetchCalls, 1);

    // 6. Stale (>3h old) reading for Bangalore is rejected with station_stale code
    const staleNowMs = Date.parse("2026-11-25T02:00:00.000Z"); // 4.5h old
    const staleBlr = await fetchNearestCpcbStation(12.9716, 77.5946, {
      nowMs: staleNowMs,
    });
    assert.equal(staleBlr.ok, false);
    assert.equal(staleBlr.fallbackCode, "station_stale");
    assert.match(staleBlr.reason, /stale/i);
  });

  it("paginates cleanly beyond 4,000 records and distinguishes provider_unavailable", async () => {
    process.env.DATA_GOV_IN_API_KEY = "test-cpcb-key";

    // Page 1 returns 4,000 dummy records (total=4003), Page 2 returns Pune station (3 records)
    const page1 = Array.from({ length: 4000 }, (_, i) => ({
      station: `Dummy Station ${i}`,
      city: "Shimla",
      state: "HP",
      latitude: "31.1048",
      longitude: "77.1734",
      last_update: "25-11-2026 03:00:00",
      pollutant_id: "PM2.5",
      avg_value: "30",
    }));
    const page2 = [
      {
        station: "Shivajinagar, Pune - IITM",
        city: "Pune",
        state: "Maharashtra",
        latitude: "18.5204",
        longitude: "73.8567",
        last_update: "25-11-2026 03:00:00",
        pollutant_id: "PM2.5",
        avg_value: "216",
      },
      {
        station: "Shivajinagar, Pune - IITM",
        city: "Pune",
        state: "Maharashtra",
        latitude: "18.5204",
        longitude: "73.8567",
        last_update: "25-11-2026 03:00:00",
        pollutant_id: "PM10",
        avg_value: "160",
      },
      {
        station: "Shivajinagar, Pune - IITM",
        city: "Pune",
        state: "Maharashtra",
        latitude: "18.5204",
        longitude: "73.8567",
        last_update: "25-11-2026 03:00:00",
        pollutant_id: "NO2",
        avg_value: "45",
      },
    ];

    let pagesCalled = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      pagesCalled += 1;
      const url = typeof input === "string" ? input : input.toString();
      const records = url.includes("offset=4000") ? page2 : page1;
      return new Response(
        JSON.stringify({ total: 4003, records }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const pune = await fetchNearestCpcbStation(18.5204, 73.8567, {
      nowMs: Date.parse("2026-11-24T22:00:00.000Z"),
    });
    assert.equal(pagesCalled, 2);
    assert.equal(pune.ok, true);
    assert.equal(pune.data.stationName, "Shivajinagar, Pune - IITM");
    assert.equal(pune.data.value, 216);

    // Provider outage returns provider_unavailable
    clearCpcbCache();
    globalThis.fetch = (async () =>
      new Response("Service Unavailable", { status: 503 })) as typeof fetch;
    const outage = await fetchNearestCpcbStation(18.5204, 73.8567);
    assert.equal(outage.ok, false);
    assert.equal(outage.fallbackCode, "provider_unavailable");
  });
});

describe("Open-Meteo Map-to-Dashboard Cache Isolation", () => {
  it("prevents batch current-only map fetches from blanking out Dashboard 24h US AQI forecast", async () => {
    let calls = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls += 1;
      const url = typeof input === "string" ? input : input.toString();
      const hasHourly = url.includes("hourly=us_aqi");
      return new Response(
        JSON.stringify({
          latitude: 28.6,
          longitude: 77.2,
          current: {
            time: "2026-11-24T21:00",
            us_aqi: 158,
            us_aqi_pm2_5: 158,
          },
          ...(hasHourly
            ? {
                hourly: {
                  time: ["2026-11-24T21:00", "2026-11-24T22:00"],
                  us_aqi: [158, 162],
                },
              }
            : {}),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    // 1. Global Map calls batch first (no hourly forecast)
    const batch = await fetchOpenMeteoUsAqiBatch([
      { lat: 28.6139, lon: 77.209 },
    ]);
    assert.equal(batch[0]?.value, 158);
    assert.equal(batch[0]?.hourlyForecast24h.length, 0);
    assert.equal(calls, 1);

    // 2. Dashboard calls fetchOpenMeteoUsAqi -> must NOT reuse forecast-less batch entry!
    const full = await fetchOpenMeteoUsAqi(28.6139, 77.209);
    assert.equal(full.ok, true);
    assert.equal(full.data.hourlyForecast24h.length, 2);
    assert.deepEqual(full.data.returnedCoordinates, { lat: 28.6, lon: 77.2 });
    assert.equal(calls, 2);
  });
});
