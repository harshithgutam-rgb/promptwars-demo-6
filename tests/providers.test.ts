import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearOpenMeteoCache,
  fetchOpenMeteoUsAqi,
  fetchOpenMeteoUsAqiBatch,
} from "@/lib/open-meteo-server";
import {
  clearOpenWeatherCache,
  fetchServerAirQuality,
} from "@/lib/openweather-server";

const originalFetch = globalThis.fetch;
const originalOwKey = process.env.OPENWEATHER_API_KEY;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Mocked Air-Quality Providers (Zero Live Quota)", () => {
  beforeEach(() => {
    clearOpenMeteoCache();
    clearOpenWeatherCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalOwKey === undefined) {
      delete process.env.OPENWEATHER_API_KEY;
    } else {
      process.env.OPENWEATHER_API_KEY = originalOwKey;
    }
  });

  it("parses Open-Meteo US AQI for India, preserves >500 Beyond AQI, and coalesces concurrent calls", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return jsonResponse({
        utc_offset_seconds: 0,
        current: {
          time: "2026-11-24T03:00",
          us_aqi: 542,
          us_aqi_pm2_5: 542,
          us_aqi_pm10: 190,
          us_aqi_ozone: 28,
          us_aqi_nitrogen_dioxide: 22,
          us_aqi_sulphur_dioxide: 14,
          us_aqi_carbon_monoxide: 9,
        },
        hourly: {
          time: ["2026-11-24T03:00", "2026-11-24T04:00"],
          us_aqi: [542, 515],
        },
      });
    }) as typeof fetch;

    const [a, b] = await Promise.all([
      fetchOpenMeteoUsAqi(28.6139, 77.209),
      fetchOpenMeteoUsAqi(28.6139, 77.209),
    ]);

    assert.equal(fetchCount, 1, "Concurrent calls should coalesce into 1 fetch");
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok) {
      assert.equal(a.data.value, 542);
      assert.equal(a.data.validAt, "2026-11-24T03:00:00.000Z");
      assert.equal(a.data.label, "US AQI — Open-Meteo modeled estimate");
      assert.equal(a.data.dominantPollutant?.label, "PM2.5");
      assert.equal(a.data.hourlyForecast24h.length, 2);
    }
  });

  it("handles Open-Meteo 429 and malformed payloads gracefully", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ error: true }, 429)) as typeof fetch;
    const rateLimited = await fetchOpenMeteoUsAqi(12.9716, 77.5946);
    assert.equal(rateLimited.ok, false);
    if (!rateLimited.ok) {
      assert.match(rateLimited.reason, /rate limit/i);
    }

    globalThis.fetch = (async () =>
      jsonResponse({ current: { time: "invalid", us_aqi: -5 } })) as typeof fetch;
    const malformed = await fetchOpenMeteoUsAqi(51.5074, -0.1278);
    assert.equal(malformed.ok, false);
  });

  it("batches multiple map coordinates into a single Open-Meteo HTTP call", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse([
        { current: { time: "2026-11-24T03:00", us_aqi: 161, us_aqi_pm2_5: 161 } },
        { current: { time: "2026-11-24T03:00", us_aqi: 53, us_aqi_pm2_5: 53 } },
      ]);
    }) as typeof fetch;

    const batch = await fetchOpenMeteoUsAqiBatch([
      { lat: 28.6139, lon: 77.209 },
      { lat: 51.5074, lon: -0.1278 },
    ]);

    assert.equal(calls, 1);
    assert.equal(batch[0]?.value, 161);
    assert.equal(batch[1]?.value, 53);
  });

  it("returns API_KEY_MISSING when OPENWEATHER_API_KEY is absent", async () => {
    delete process.env.OPENWEATHER_API_KEY;
    const res = await fetchServerAirQuality(51.5074, -0.1278);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 503);
      assert.equal(res.error.code, "API_KEY_MISSING");
    }
  });

  it("returns OpenWeather 1–5 independently even when Open-Meteo fails (never converts 1–5 to 0–500)", async () => {
    process.env.OPENWEATHER_API_KEY = "test-mock-key";
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("open-meteo.com")) {
        return jsonResponse({ error: "unavailable" }, 503);
      }
      if (url.includes("/air_pollution/forecast")) {
        return jsonResponse({ list: [] });
      }
      if (url.includes("/weather")) {
        return jsonResponse({
          main: { temp: 18, humidity: 60, pressure: 1015 },
          wind: { speed: 4.2, deg: 210 },
          weather: [{ description: "clear sky" }],
        });
      }
      return jsonResponse({
        list: [
          {
            dt: 1795489200,
            main: { aqi: 3 },
            components: {
              pm2_5: 36.4,
              pm10: 48.2,
              o3: 55.1,
              no2: 19.0,
              so2: 5.2,
              co: 410,
              nh3: 2.1,
              no: 0.8,
            },
          },
        ],
      });
    }) as typeof fetch;

    const res = await fetchServerAirQuality(12.9716, 77.5946);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.data.current.aqi, 3);
      assert.equal(res.data.current.components.pm2_5, 36.4);
      assert.equal(res.data.usAqi, null);
      assert.ok(res.data.usAqiUnavailableReason);
    }
  });
});
