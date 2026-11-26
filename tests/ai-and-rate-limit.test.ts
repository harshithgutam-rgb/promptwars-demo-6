import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAiRecommendationPayload,
  type AiRecommendationMode,
} from "@/lib/ai-types";
import {
  buildResponseSchema,
  classifyGeminiError,
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
  supportsZeroThinkingBudget,
} from "@/lib/gemini-config";
import { extractClientKey, SlidingWindowRateLimiter } from "@/lib/rate-limit";
import { parseCoordinate } from "@/lib/openweather-server";

describe("AI Structured Payload Validation (All 4 Feature Modes)", () => {
  const validRec = {
    title: "Limit vigorous outdoor cardio",
    priority: "high",
    category: "Exercise",
    action: "Move intense workouts indoors until particulate levels ease.",
    explanation: "Observed PM2.5 is elevated.",
    basis: "observed",
  };

  it("validates mocked structured JSON responses for advisor, daily-routine, indoor-rescue, and what-if", () => {
    const mockedResponses: Record<AiRecommendationMode, unknown> = {
      advisor: {
        summary: "Fair air quality right now (OpenWeather AQI 2/5).",
        directAnswer: "A light walk is reasonable; avoid heavy roadside traffic.",
        recommendations: [validRec],
        caveats: ["General guidance only; not medical advice."],
      },
      "daily-routine": {
        summary: "Plan lighter outdoor exposure midday when PM2.5 peaks.",
        recommendations: [
          {
            ...validRec,
            basis: "forecast",
          },
        ],
        routineBlocks: [
          {
            period: "Morning",
            headline: "Moderate morning air",
            dataBasis: "provider_forecast",
            outdoorGuidance: "Short walks are fine.",
            commuteTip: "Prefer transit.",
            exerciseTip: "Keep pace moderate.",
            familyNote: "Monitor sensitive children.",
          },
          {
            period: "Afternoon",
            headline: "Elevated particulate window",
            dataBasis: "provider_forecast",
            outdoorGuidance: "Limit prolonged exertion outdoors.",
            commuteTip: "Keep car cabin air on recirculation.",
            exerciseTip: "Shift high-intensity cardio indoors.",
            familyNote: "Encourage indoor hydration and rest.",
          },
          {
            period: "Evening",
            headline: "Gradual dispersion expected",
            dataBasis: "provider_forecast",
            outdoorGuidance: "Brief errands are comfortable.",
            commuteTip: "Choose lower-traffic side streets.",
            exerciseTip: "Light stretching or indoor session.",
            familyNote: "Check live AQI before evening play.",
          },
        ],
        caveats: ["Forecast values are modeled provider estimates."],
      },
      "indoor-rescue": {
        summary: "Outdoor PM2.5 is elevated; keep windows closed during peak traffic.",
        recommendations: [
          {
            title: "Run HEPA filtration on medium-high",
            priority: "high",
            category: "Filtration",
            action: "Keep bedroom and living room purifiers running continuously.",
            explanation: "Reduces fine particles infiltrating from outdoors.",
            basis: "general_advice",
          },
          {
            title: "Ventilate kitchen while cooking",
            priority: "medium",
            category: "Source Control",
            action: "Use the range hood exhaust on high when frying or searing.",
            explanation: "Prevents indoor PM2.5 buildup while windows stay shut.",
            basis: "general_advice",
          },
        ],
        caveats: [
          "Outdoor OpenWeather AQI does not measure actual indoor air quality and AirWise AI has no connected indoor sensors.",
        ],
      },
      "what-if": {
        summary: "Switching a 10 km car commute to metro cuts estimated CO2e by ~82%.",
        recommendations: [
          {
            title: "Prefer rail transit on high-PM2.5 days",
            priority: "high",
            category: "Commute",
            action: "Use metro or bus rather than cycling along arterial roads.",
            explanation: "Balances lower emissions with reduced personal inhalation.",
            basis: "estimate",
          },
        ],
        caveats: [
          "Emission savings are deterministic estimates; personal trip changes do not directly alter city-wide AQI.",
        ],
      },
    };

    const modes: AiRecommendationMode[] = [
      "advisor",
      "daily-routine",
      "indoor-rescue",
      "what-if",
    ];

    for (const mode of modes) {
      const schema = buildResponseSchema(mode);
      assert.ok(schema.properties?.summary, `${mode} schema requires summary`);
      assert.ok(
        schema.properties?.recommendations,
        `${mode} schema requires recommendations`
      );
      assert.ok(schema.properties?.caveats, `${mode} schema requires caveats`);

      if (mode === "advisor") {
        assert.ok(schema.properties?.directAnswer);
      }
      if (mode === "daily-routine") {
        assert.ok(schema.properties?.routineBlocks);
        assert.ok(schema.required?.includes("routineBlocks"));
      }

      // Simulate JSON.parse of Gemini responseText and validate
      const parsed = JSON.parse(JSON.stringify(mockedResponses[mode]));
      const validated = validateAiRecommendationPayload(parsed, mode);
      assert.ok(validated, `${mode} mocked payload should pass validation`);
      assert.ok(validated.recommendations.length >= 1);
      assert.ok(validated.caveats.length >= 1);
      if (mode === "daily-routine") {
        assert.equal(validated.routineBlocks?.length, 3);
      }
    }
  });

  it("rejects malformed payloads, invalid enums, and daily-routine without routineBlocks", () => {
    assert.equal(validateAiRecommendationPayload(null, "advisor"), null);
    assert.equal(
      validateAiRecommendationPayload({ summary: "", recommendations: [validRec] }, "advisor"),
      null
    );
    assert.equal(
      validateAiRecommendationPayload(
        {
          summary: "Valid summary",
          recommendations: [{ ...validRec, priority: "urgent" }],
        },
        "advisor"
      ),
      null
    );
    assert.equal(
      validateAiRecommendationPayload(
        {
          summary: "Missing routine blocks",
          recommendations: [validRec],
        },
        "daily-routine"
      ),
      null
    );
    assert.equal(
      validateAiRecommendationPayload(
        {
          summary: "Invalid basis enum",
          recommendations: [{ ...validRec, basis: "guessed" }],
        },
        "what-if"
      ),
      null
    );
  });
});

describe("Gemini Model Config & Upstream Error Classification", () => {
  it("resolves GEMINI_MODEL override and flash-lite thinkingConfig support", () => {
    assert.equal(resolveGeminiModel(undefined), DEFAULT_GEMINI_MODEL);
    assert.equal(resolveGeminiModel("   "), DEFAULT_GEMINI_MODEL);
    assert.equal(
      resolveGeminiModel(" gemini-3.5-flash-lite "),
      "gemini-3.5-flash-lite"
    );

    assert.equal(supportsZeroThinkingBudget("gemini-3.1-flash-lite"), false);
    assert.equal(supportsZeroThinkingBudget("gemini-3.5-flash-lite"), false);
    assert.equal(supportsZeroThinkingBudget("gemini-3.5-flash"), true);
    assert.equal(supportsZeroThinkingBudget("gemini-3.7-flash"), true);
  });

  it("distinguishes 503 overload, 429 quota, 404 model unavailable, 401 auth, timeout, and generic errors", () => {
    // 1. Genuine 503 UNAVAILABLE high demand
    const err503 = Object.assign(
      new Error(
        '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'
      ),
      { status: 503 }
    );
    const c503 = classifyGeminiError(err503, "gemini-3.1-flash-lite");
    assert.equal(c503.status, 503);
    assert.equal(c503.code, "PROVIDER_OVERLOADED");
    assert.equal(c503.upstreamStatus, 503);
    assert.equal(c503.upstreamRpcStatus, "UNAVAILABLE");
    assert.equal(c503.retryable, true);
    assert.equal(c503.retryAfterSeconds, 5);

    // 2. 429 per-minute rate limit
    const err429Min = Object.assign(
      new Error(
        '{"error":{"code":429,"message":"Quota exceeded. Please retry in 24s.","status":"RESOURCE_EXHAUSTED"}}'
      ),
      { status: 429 }
    );
    const c429Min = classifyGeminiError(err429Min, "gemini-3.5-flash-lite");
    assert.equal(c429Min.status, 429);
    assert.equal(c429Min.code, "PROVIDER_QUOTA_EXCEEDED");
    assert.equal(c429Min.retryAfterSeconds, 24);
    assert.equal(c429Min.retryable, true);

    // 3. 429 free-tier daily quota exhausted
    const err429Day = Object.assign(
      new Error(
        '{"error":{"code":429,"message":"GenerateRequestsPerDayPerProjectPerModel-FreeTier exceeded","status":"RESOURCE_EXHAUSTED","details":[{"retryDelay":"22000s"}]}}'
      ),
      { status: 429 }
    );
    const c429Day = classifyGeminiError(err429Day, "gemini-3.8-flash");
    assert.equal(c429Day.status, 429);
    assert.equal(c429Day.code, "PROVIDER_QUOTA_EXCEEDED");
    assert.equal(c429Day.retryAfterSeconds, 22000);
    assert.equal(c429Day.retryable, false);

    // 4. 404 model unavailable (even when error message contains "unavailable"!)
    const err404 = Object.assign(
      new Error(
        '{"error":{"code":404,"message":"Model is unavailable for new users.","status":"NOT_FOUND"}}'
      ),
      { status: 404 }
    );
    const c404 = classifyGeminiError(err404, "gemini-2.5-flash");
    assert.equal(c404.status, 502);
    assert.equal(c404.code, "MODEL_ERROR");
    assert.equal(c404.upstreamStatus, 404);
    assert.equal(c404.upstreamRpcStatus, "NOT_FOUND");
    assert.equal(c404.retryable, false);

    // 5. 401/403 credentials rejected
    const err403 = Object.assign(
      new Error('{"error":{"code":403,"message":"API key not valid","status":"PERMISSION_DENIED"}}'),
      { status: 403 }
    );
    const c403 = classifyGeminiError(err403, "gemini-3.5-flash-lite");
    assert.equal(c403.status, 502);
    assert.equal(c403.code, "AUTH_ERROR");
    assert.equal(c403.retryable, false);

    // 6. Timeout / Abort
    const errTimeout = new DOMException("Overall AI deadline exceeded", "TimeoutError");
    const cTimeout = classifyGeminiError(errTimeout, "gemini-3.5-flash-lite");
    assert.equal(cTimeout.status, 504);
    assert.equal(cTimeout.code, "TIMEOUT");
    assert.equal(cTimeout.retryable, true);

    // 7. Generic upstream error
    const errGeneric = Object.assign(new Error("Internal server error"), { status: 500 });
    const cGeneric = classifyGeminiError(errGeneric, "gemini-3.5-flash-lite");
    assert.equal(cGeneric.status, 502);
    assert.equal(cGeneric.code, "MODEL_ERROR");
    assert.equal(cGeneric.upstreamStatus, 500);
    assert.equal(cGeneric.retryable, true);
  });
});

describe("SlidingWindowRateLimiter & Coordinate Validation", () => {
  it("enforces request limits with Retry-After and resets after window expires", () => {
    const limiter = new SlidingWindowRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
    });

    const t0 = 1_000_000;
    assert.equal(limiter.consume("ip-a", t0).allowed, true);
    assert.equal(limiter.consume("ip-a", t0 + 5_000).allowed, true);

    const blocked = limiter.consume("ip-a", t0 + 10_000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 50);

    // Separate client key is unaffected
    assert.equal(limiter.consume("ip-b", t0 + 10_000).allowed, true);

    // After window passes, ip-a is allowed again
    assert.equal(limiter.consume("ip-a", t0 + 61_000).allowed, true);
  });

  it("extracts client keys safely from headers", () => {
    const h1 = new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" });
    assert.equal(extractClientKey(h1), "203.0.113.10");

    const h2 = new Headers({ "x-real-ip": "198.51.100.4" });
    assert.equal(extractClientKey(h2), "198.51.100.4");

    assert.equal(extractClientKey(new Headers()), "local");
  });

  it("validates worldwide coordinates strictly", () => {
    assert.equal(parseCoordinate("28.6139", -90, 90), 28.6139);
    assert.equal(parseCoordinate("-33.8688", -90, 90), -33.8688);
    assert.equal(parseCoordinate("0", -180, 180), 0);
    assert.equal(parseCoordinate("91", -90, 90), null);
    assert.equal(parseCoordinate("-181", -180, 180), null);
    assert.equal(parseCoordinate("NaN", -90, 90), null);
    assert.equal(parseCoordinate("", -90, 90), null);
  });
});
