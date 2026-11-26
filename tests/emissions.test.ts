import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ASSUMED_COMMUTE_WEEKS_PER_YEAR,
  calculateWhatIfComparison,
  getEffectiveGramsPerKm,
} from "@/lib/emissions";

describe("What-If Simulator Deterministic Emissions", () => {
  it("computes exact per-trip, weekly, and 50-week annualized savings", () => {
    const result = calculateWhatIfComparison(
      {
        distanceKm: 10,
        tripsPerWeek: 10,
        baselineMode: "car_solo",
        alternativeMode: "public_rail",
        carpoolRiders: 2,
      },
      2
    );

    // Solo car: 170 g/km * 10 km = 1700 g = 1.7 kg/trip; 17 kg/wk; 850 kg/yr
    assert.equal(result.baseline.perTripGrams, 1700);
    assert.equal(result.baseline.weeklyKg, 17);
    assert.equal(result.baseline.annualKg, 850);

    // Metro/rail: 35 g/km * 10 km = 350 g = 0.35 kg/trip; 3.5 kg/wk; 175 kg/yr
    assert.equal(result.alternative.perTripGrams, 350);
    assert.equal(result.alternative.weeklyKg, 3.5);
    assert.equal(result.alternative.annualKg, 175);

    assert.equal(result.delta.perTripKgSaved, 1.35);
    assert.equal(result.delta.weeklyKgSaved, 13.5);
    assert.equal(result.delta.annualKgSaved, 675);
    assert.equal(result.delta.percentChange, -79);
    assert.equal(
      result.assumptions.weeksPerYear,
      ASSUMED_COMMUTE_WEEKS_PER_YEAR
    );
  });

  it("divides carpool vehicle emissions accurately by rider count and clamps extremes", () => {
    assert.equal(getEffectiveGramsPerKm("carpool", 2), 85);
    assert.equal(getEffectiveGramsPerKm("carpool", 4), 42.5);
    assert.equal(getEffectiveGramsPerKm("carpool", 1), 85); // clamped to min 2
    assert.equal(getEffectiveGramsPerKm("carpool", 99), 34); // clamped to max 5
  });

  it("warns about outdoor inhalation exposure for active transport when AQI is poor (4–5)", () => {
    const poorAir = calculateWhatIfComparison(
      {
        distanceKm: 4,
        tripsPerWeek: 10,
        baselineMode: "car_solo",
        alternativeMode: "cycling",
        carpoolRiders: 2,
      },
      5
    );

    assert.equal(poorAir.alternative.perTripGrams, 0);
    assert.match(poorAir.alternative.suitabilityNote, /inhalation/i);
    assert.match(
      poorAir.assumptions.aqiImpactDisclaimer,
      /does not directly produce a measurable change in city-wide AQI/i
    );
  });
});
