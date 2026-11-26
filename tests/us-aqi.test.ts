import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateEpa2024Pm25SubIndex,
  classifyUsAqi,
  identifyDominantUsPollutant,
  US_AQI_LEGEND,
  US_VS_CPCB_DISCLOSURE,
  usAqiArcFraction,
} from "@/lib/us-aqi";
import {
  classifyPollutant,
  isValidAqiIndex,
  OPENWEATHER_AQI_SCALE,
} from "@/lib/air-quality";

describe("US EPA 2024 PM2.5 Breakpoints & Truncation", () => {
  it("matches official 2024 EPA PM2.5 24-hour breakpoint boundaries", () => {
    const referenceCases: Array<[number, number]> = [
      [0.0, 0],
      [9.0, 50], // Revised May 2024 Good upper bound (previously 12.0)
      [9.09, 50], // Official truncation to 1 decimal place -> 9.0
      [9.1, 51],
      [35.4, 100],
      [35.5, 101],
      [55.4, 150],
      [55.5, 151],
      [125.4, 200],
      [125.5, 201],
      [225.4, 300],
      [225.5, 301],
      [325.4, 500],
    ];

    for (const [concentration, expectedAqi] of referenceCases) {
      assert.equal(
        calculateEpa2024Pm25SubIndex(concentration),
        expectedAqi,
        `Expected PM2.5 ${concentration} µg/m³ to equal AQI ${expectedAqi}`
      );
    }
  });

  it("preserves Beyond AQI values > 500 without silent truncation", () => {
    const beyond = calculateEpa2024Pm25SubIndex(350.0);
    assert.ok(beyond !== null && beyond > 500, `Expected >500, got ${beyond}`);
  });

  it("rejects negative or non-finite concentrations", () => {
    assert.equal(calculateEpa2024Pm25SubIndex(-1), null);
    assert.equal(calculateEpa2024Pm25SubIndex(Number.NaN), null);
    assert.equal(calculateEpa2024Pm25SubIndex(Number.POSITIVE_INFINITY), null);
  });
});

describe("US AQI Categories & OpenWeather 1–5 Separation", () => {
  it("classifies all US AQI category boundaries including Beyond AQI", () => {
    const cases: Array<[number, string, boolean]> = [
      [0, "good", false],
      [50, "good", false],
      [51, "moderate", false],
      [100, "moderate", false],
      [101, "usg", false],
      [150, "usg", false],
      [151, "unhealthy", false],
      [200, "unhealthy", false],
      [201, "very_unhealthy", false],
      [300, "very_unhealthy", false],
      [301, "hazardous", false],
      [500, "hazardous", false],
      [501, "beyond_aqi", true],
      [640, "beyond_aqi", true],
    ];

    for (const [value, expectedKey, expectedBeyond] of cases) {
      const cat = classifyUsAqi(value);
      assert.equal(cat.key, expectedKey, `Value ${value}`);
      assert.equal(cat.isBeyondScale, expectedBeyond, `Beyond flag for ${value}`);
    }
  });

  it("caps visual arc fraction cleanly at 1.0 for values > 500", () => {
    assert.equal(usAqiArcFraction(250), 0.5);
    assert.equal(usAqiArcFraction(500), 1);
    assert.equal(usAqiArcFraction(620), 1);
  });

  it("identifies the dominant pollutant from Open-Meteo US AQI sub-indices", () => {
    const dom = identifyDominantUsPollutant({
      pm2_5: 162,
      pm10: 59,
      o3: 23,
      no2: 14,
      so2: 13,
      co: 8,
    });
    assert.deepEqual(dom, { key: "pm2_5", label: "PM2.5", aqi: 162 });

    assert.equal(
      identifyDominantUsPollutant({
        pm2_5: null,
        pm10: null,
        o3: null,
        no2: null,
        so2: null,
        co: null,
      }),
      null
    );
  });

  it("keeps OpenWeather 1–5 strictly separate from US AQI 0–500 and India CPCB", () => {
    assert.equal(Object.keys(OPENWEATHER_AQI_SCALE).length, 5);
    assert.equal(US_AQI_LEGEND.length, 7); // 6 standard bands + Beyond AQI
    assert.equal(isValidAqiIndex(1), true);
    assert.equal(isValidAqiIndex(5), true);
    assert.equal(isValidAqiIndex(0), false);
    assert.equal(isValidAqiIndex(6), false);
    assert.equal(isValidAqiIndex(150), false);
    assert.match(US_VS_CPCB_DISCLOSURE, /CPCB/i);
    assert.equal(classifyPollutant("pm2_5", null).status, "Unavailable");
    assert.equal(classifyPollutant("pm2_5", 8.5).status, "Good");
  });
});
