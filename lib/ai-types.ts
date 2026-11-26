import type { TransportModeId } from "@/lib/emissions";

export type AiRecommendationMode =
  | "advisor"
  | "daily-routine"
  | "indoor-rescue"
  | "what-if";

export type RecommendationPriority = "high" | "medium" | "low";
export type DataBasisTag = "observed" | "forecast" | "estimate" | "general_advice";

export interface AiRecommendationItem {
  title: string;
  priority: RecommendationPriority;
  category: string;
  action: string;
  explanation: string;
  basis: DataBasisTag;
}

export interface DailyRoutineBlock {
  period: "Morning" | "Afternoon" | "Evening";
  headline: string;
  dataBasis: "current_observed" | "provider_forecast" | "general_guidance";
  outdoorGuidance: string;
  commuteTip: string;
  exerciseTip: string;
  familyNote: string;
}

export interface AiRecommendationPayload {
  summary: string;
  directAnswer?: string;
  recommendations: AiRecommendationItem[];
  routineBlocks?: DailyRoutineBlock[];
  caveats: string[];
}

export interface AiRecommendationApiResponse {
  mode: AiRecommendationMode;
  model: string;
  generatedAt: string;
  contextMeta: {
    locationLabel: string;
    observedAt: string;
    aqi: 1 | 2 | 3 | 4 | 5;
    aqiScale: "OpenWeather AQI (1–5)";
    usAqi: number | null;
    usAqiValidAt: string | null;
    usAqiDominantPollutant: string | null;
    primaryAqiStandard?: "IND_CPCB" | "US_EPA" | null;
    primaryAqiValue?: number | null;
    primaryAqiSource?: string | null;
    stationName?: string | null;
    stationDistanceKm?: number | null;
    pm2_5: number | null;
    pm10: number | null;
    o3: number | null;
    no2: number | null;
    hasForecast: boolean;
    hasWeather: boolean;
    verifiedServerSide: true;
  };
  result: AiRecommendationPayload;
}

export type AiErrorCode =
  | "INVALID_REQUEST"
  | "APP_RATE_LIMITED"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_OVERLOADED"
  | "GEMINI_KEY_MISSING"
  | "AUTH_ERROR"
  | "OPENWEATHER_UNAVAILABLE"
  | "MODEL_ERROR"
  | "INVALID_AI_OUTPUT"
  | "TIMEOUT";

export interface AiErrorResponse {
  error: string;
  code: AiErrorCode;
  retryAfterSeconds?: number;
  retryable?: boolean;
}

export interface AiAdvisorPreferences {
  activity?: string;
  commuteType?: string;
  household?: string;
  constraints?: string;
  question?: string;
}

export interface DailyRoutinePreferences {
  activityLevel?: string;
  commuteType?: string;
  household?: string;
  scheduleNotes?: string;
}

export interface IndoorRescuePreferences {
  homeType?: string;
  hasAirPurifier?: string;
  cookingFuel?: string;
  budgetFocus?: string;
  householdNeeds?: string;
  notes?: string;
}

export interface WhatIfAiPreferences {
  distanceKm: number;
  tripsPerWeek: number;
  baselineMode: TransportModeId;
  alternativeMode: TransportModeId;
  carpoolRiders: number;
  notes?: string;
}

export interface AiRecommendationRequestBody {
  mode: AiRecommendationMode;
  location: {
    name: string;
    region?: string;
    country?: string;
    lat: number;
    lon: number;
  };
  advisor?: AiAdvisorPreferences;
  dailyRoutine?: DailyRoutinePreferences;
  indoorRescue?: IndoorRescuePreferences;
  whatIf?: WhatIfAiPreferences;
}

function isPriority(value: unknown): value is RecommendationPriority {
  return value === "high" || value === "medium" || value === "low";
}

function isDataBasis(value: unknown): value is DataBasisTag {
  return (
    value === "observed" ||
    value === "forecast" ||
    value === "estimate" ||
    value === "general_advice"
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Strictly validates structured JSON returned from Gemini before rendering.
 */
export function validateAiRecommendationPayload(
  raw: unknown,
  mode: AiRecommendationMode
): AiRecommendationPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (!isNonEmptyString(obj.summary)) return null;

  if (!Array.isArray(obj.recommendations) || obj.recommendations.length === 0) {
    return null;
  }

  const recommendations: AiRecommendationItem[] = [];
  for (const item of obj.recommendations.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (
      !isNonEmptyString(rec.title) ||
      !isPriority(rec.priority) ||
      !isNonEmptyString(rec.category) ||
      !isNonEmptyString(rec.action) ||
      !isNonEmptyString(rec.explanation) ||
      !isDataBasis(rec.basis)
    ) {
      continue;
    }
    recommendations.push({
      title: rec.title.trim(),
      priority: rec.priority,
      category: rec.category.trim(),
      action: rec.action.trim(),
      explanation: rec.explanation.trim(),
      basis: rec.basis,
    });
  }

  if (recommendations.length === 0) return null;

  const caveats: string[] = Array.isArray(obj.caveats)
    ? obj.caveats
        .filter((c): c is string => isNonEmptyString(c))
        .map((c) => c.trim())
        .slice(0, 5)
    : [];

  let routineBlocks: DailyRoutineBlock[] | undefined;
  if (mode === "daily-routine") {
    if (!Array.isArray(obj.routineBlocks) || obj.routineBlocks.length === 0) {
      return null;
    }
    const validBlocks: DailyRoutineBlock[] = [];
    for (const block of obj.routineBlocks.slice(0, 3)) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (
        (b.period === "Morning" ||
          b.period === "Afternoon" ||
          b.period === "Evening") &&
        isNonEmptyString(b.headline) &&
        (b.dataBasis === "current_observed" ||
          b.dataBasis === "provider_forecast" ||
          b.dataBasis === "general_guidance") &&
        isNonEmptyString(b.outdoorGuidance) &&
        isNonEmptyString(b.commuteTip) &&
        isNonEmptyString(b.exerciseTip) &&
        isNonEmptyString(b.familyNote)
      ) {
        validBlocks.push({
          period: b.period,
          headline: b.headline.trim(),
          dataBasis: b.dataBasis,
          outdoorGuidance: b.outdoorGuidance.trim(),
          commuteTip: b.commuteTip.trim(),
          exerciseTip: b.exerciseTip.trim(),
          familyNote: b.familyNote.trim(),
        });
      }
    }
    if (validBlocks.length === 0) return null;
    routineBlocks = validBlocks;
  }

  const directAnswer = isNonEmptyString(obj.directAnswer)
    ? obj.directAnswer.trim()
    : undefined;

  return {
    summary: obj.summary.trim(),
    directAnswer,
    recommendations,
    routineBlocks,
    caveats,
  };
}
