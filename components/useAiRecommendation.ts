"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AiErrorCode,
  AiErrorResponse,
  AiRecommendationApiResponse,
  AiRecommendationRequestBody,
} from "@/lib/ai-types";

export interface AiErrorState {
  message: string;
  code: AiErrorCode | "NETWORK_ERROR";
  retryAfterSeconds?: number;
  retryable: boolean;
}

const MAX_ACTIVE_COOLDOWN_SECONDS = 120;

function parseRetryAfter(
  res: Response,
  payload: Partial<AiErrorResponse>
): number | undefined {
  if (
    typeof payload.retryAfterSeconds === "number" &&
    Number.isFinite(payload.retryAfterSeconds) &&
    payload.retryAfterSeconds > 0
  ) {
    return Math.ceil(payload.retryAfterSeconds);
  }
  const headerVal = res.headers.get("Retry-After");
  if (headerVal) {
    const parsed = Number(headerVal);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed);
    }
  }
  return undefined;
}

export function useAiRecommendation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiErrorState | null>(null);
  const [response, setResponse] = useState<AiRecommendationApiResponse | null>(
    null
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight browser request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Tick down active Retry-After cooldown timer once per second
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const execute = useCallback(async (body: AiRecommendationRequestBody) => {
    // Strictly prevent duplicate concurrent calls from rapid clicks
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Client-side safety timeout slightly above server 22s deadline
    const clientTimer = window.setTimeout(() => {
      controller.abort();
    }, 26_000);

    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const errPayload = (payload ?? {}) as Partial<AiErrorResponse>;
        const retryAfterSeconds = parseRetryAfter(res, errPayload);
        const code: AiErrorState["code"] = errPayload.code ?? "MODEL_ERROR";
        const message =
          typeof errPayload.error === "string"
            ? errPayload.error
            : `AirWise AI request failed (HTTP ${res.status}).`;

        setError({
          message,
          code,
          retryAfterSeconds,
          retryable: errPayload.retryable ?? true,
        });

        // Apply active button cooldown for short Retry-After windows
        if (
          retryAfterSeconds !== undefined &&
          retryAfterSeconds > 0 &&
          retryAfterSeconds <= MAX_ACTIVE_COOLDOWN_SECONDS
        ) {
          setCooldownSeconds(retryAfterSeconds);
        }
        return;
      }

      setResponse(payload as AiRecommendationApiResponse);
      setCooldownSeconds(0);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError({
          message:
            "Request timed out before Gemini AI finished responding. Your OpenWeather data remains active — please retry.",
          code: "TIMEOUT",
          retryable: true,
        });
      } else {
        setError({
          message:
            "Network error while contacting AirWise AI. Please check your connection and retry.",
          code: "NETWORK_ERROR",
          retryable: true,
        });
      }
    } finally {
      window.clearTimeout(clientTimer);
      abortControllerRef.current = null;
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    response,
    cooldownSeconds,
    isBusy: loading || cooldownSeconds > 0,
    execute,
  };
}
