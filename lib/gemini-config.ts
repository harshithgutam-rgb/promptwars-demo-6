import { Type, type Schema } from "@google/genai";
import type { AiErrorCode, AiRecommendationMode } from "@/lib/ai-types";

/**
 * Default Gemini Flash model used when GEMINI_MODEL is not set in the environment.
 * Overridable via process.env.GEMINI_MODEL without changing application code.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export function resolveGeminiModel(envModel?: string): string {
  const trimmed = envModel?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_GEMINI_MODEL;
}

export function supportsZeroThinkingBudget(modelName: string): boolean {
  const normalized = modelName.toLowerCase();
  // Flash-Lite models reject thinkingConfig; standard 2.5/3.x Flash models support it
  return normalized.includes("flash") && !normalized.includes("lite");
}

export function buildResponseSchema(mode: AiRecommendationMode): Schema {
  const recommendationItemSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      priority: {
        type: Type.STRING,
        enum: ["high", "medium", "low"],
      },
      category: { type: Type.STRING },
      action: { type: Type.STRING },
      explanation: { type: Type.STRING },
      basis: {
        type: Type.STRING,
        enum: ["observed", "forecast", "estimate", "general_advice"],
      },
    },
    required: [
      "title",
      "priority",
      "category",
      "action",
      "explanation",
      "basis",
    ],
  };

  const properties: Record<string, Schema> = {
    summary: { type: Type.STRING },
    recommendations: {
      type: Type.ARRAY,
      items: recommendationItemSchema,
    },
    caveats: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  };

  if (mode === "advisor") {
    properties.directAnswer = { type: Type.STRING };
  }

  const required = ["summary", "recommendations", "caveats"];

  if (mode === "daily-routine") {
    properties.routineBlocks = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          period: {
            type: Type.STRING,
            enum: ["Morning", "Afternoon", "Evening"],
          },
          headline: { type: Type.STRING },
          dataBasis: {
            type: Type.STRING,
            enum: [
              "current_observed",
              "provider_forecast",
              "general_guidance",
            ],
          },
          outdoorGuidance: { type: Type.STRING },
          commuteTip: { type: Type.STRING },
          exerciseTip: { type: Type.STRING },
          familyNote: { type: Type.STRING },
        },
        required: [
          "period",
          "headline",
          "dataBasis",
          "outdoorGuidance",
          "commuteTip",
          "exerciseTip",
          "familyNote",
        ],
      },
    };
    required.push("routineBlocks");
  }

  return {
    type: Type.OBJECT,
    properties,
    required,
  };
}

export function extractRetrySecondsFromMessage(
  rawMsg: string
): number | undefined {
  // Match Google RPC retryDelay like "retryDelay":"22209s" or "retry in 42s"
  const rpcMatch = rawMsg.match(/"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s"/i);
  if (rpcMatch) {
    const secs = Number(rpcMatch[1]);
    if (Number.isFinite(secs) && secs > 0) return secs;
  }

  const humanSecMatch = rawMsg.match(/retry in\s+(\d+)(?:\.\d+)?s/i);
  if (humanSecMatch) {
    const secs = Number(humanSecMatch[1]);
    if (Number.isFinite(secs) && secs > 0) return secs;
  }

  return undefined;
}

export function extractHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const val = (err as { status?: unknown }).status;
    if (typeof val === "number" && Number.isFinite(val)) return val;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const codeMatch = msg.match(/"code"\s*:\s*(\d{3})/);
  if (codeMatch) return Number(codeMatch[1]);
  return undefined;
}

export function extractUpstreamRpcStatus(err: unknown): string | undefined {
  const msg = err instanceof Error ? err.message : String(err);
  const statusMatch = msg.match(/"status"\s*:\s*"([A-Z_]{3,40})"/);
  if (statusMatch) return statusMatch[1];
  return undefined;
}

export function isAbortOrTimeoutError(err: unknown): boolean {
  if (
    err instanceof DOMException &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  ) {
    return true;
  }
  const msg =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("aborted") ||
    msg.includes("timeout") ||
    msg.includes("timed out")
  );
}

export interface ClassifiedGeminiError {
  status: number;
  code: AiErrorCode;
  message: string;
  retryAfterSeconds?: number;
  retryable: boolean;
  upstreamStatus?: number;
  upstreamRpcStatus?: string;
}

export function classifyGeminiError(
  err: unknown,
  modelName: string
): ClassifiedGeminiError {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();
  const httpStatus = extractHttpStatus(err);
  const rpcStatus = extractUpstreamRpcStatus(err);

  if (isAbortOrTimeoutError(err)) {
    return {
      status: 504,
      code: "TIMEOUT",
      message:
        "Gemini AI did not respond within the 22-second request deadline. Your OpenWeather telemetry remains active — please retry.",
      retryable: true,
      upstreamStatus: httpStatus,
      upstreamRpcStatus: rpcStatus,
    };
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    rpcStatus === "UNAUTHENTICATED" ||
    rpcStatus === "PERMISSION_DENIED" ||
    lower.includes("api key") ||
    lower.includes("permission") ||
    lower.includes("unauthenticated")
  ) {
    return {
      status: 502,
      code: "AUTH_ERROR",
      message:
        "Gemini API credentials were rejected. Verify GEMINI_API_KEY in .env.local.",
      retryable: false,
      upstreamStatus: httpStatus,
      upstreamRpcStatus: rpcStatus,
    };
  }

  // Check 404 / NOT_FOUND before 503 string heuristics so a 404 message saying
  // "model is unavailable" is never misclassified as transient 503 overload.
  if (
    httpStatus === 404 ||
    rpcStatus === "NOT_FOUND" ||
    lower.includes("not_found")
  ) {
    return {
      status: 502,
      code: "MODEL_ERROR",
      message: `Configured Gemini model (${modelName}) is unavailable for this API key. Update GEMINI_MODEL in .env.local.`,
      retryable: false,
      upstreamStatus: httpStatus,
      upstreamRpcStatus: rpcStatus,
    };
  }

  if (
    httpStatus === 429 ||
    rpcStatus === "RESOURCE_EXHAUSTED" ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    const retryAfterSeconds = extractRetrySecondsFromMessage(rawMsg);
    const isDailyExhausted =
      lower.includes("perday") ||
      lower.includes("per day") ||
      (retryAfterSeconds !== undefined && retryAfterSeconds > 600);

    return {
      status: 429,
      code: "PROVIDER_QUOTA_EXCEEDED",
      message: isDailyExhausted
        ? `Google Gemini API free-tier daily quota was exhausted for ${modelName}. Check your Google AI Studio quota or set a different GEMINI_MODEL in .env.local.`
        : `Google Gemini API rate limit was reached for ${modelName}. Please wait briefly before retrying.`,
      retryAfterSeconds: retryAfterSeconds ?? 30,
      retryable: !isDailyExhausted,
      upstreamStatus: httpStatus,
      upstreamRpcStatus: rpcStatus,
    };
  }

  if (
    httpStatus === 503 ||
    rpcStatus === "UNAVAILABLE" ||
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    (httpStatus === undefined && lower.includes("unavailable"))
  ) {
    return {
      status: 503,
      code: "PROVIDER_OVERLOADED",
      message: `Google Gemini (${modelName}) is temporarily experiencing high demand. Please retry in a few seconds.`,
      retryAfterSeconds: 5,
      retryable: true,
      upstreamStatus: httpStatus,
      upstreamRpcStatus: rpcStatus,
    };
  }

  return {
    status: 502,
    code: "MODEL_ERROR",
    message:
      "Gemini AI encountered an unexpected upstream error. Please retry in a moment.",
    retryable: true,
    upstreamStatus: httpStatus,
    upstreamRpcStatus: rpcStatus,
  };
}
