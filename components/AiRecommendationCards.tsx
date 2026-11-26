"use client";

import {
  formatTimestampReadable,
  OPENWEATHER_AQI_SCALE,
} from "@/lib/air-quality";
import { classifyUsAqi } from "@/lib/us-aqi";
import { classifyCpcbAqi } from "@/lib/cpcb-aqi";
import type {
  AiRecommendationApiResponse,
  DataBasisTag,
  RecommendationPriority,
} from "@/lib/ai-types";
import type { AiErrorState } from "@/components/useAiRecommendation";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  RefreshIcon,
  SparklesIcon,
} from "@/components/Icons";

interface AiRecommendationCardsProps {
  loading: boolean;
  error: AiErrorState | null;
  cooldownSeconds: number;
  response: AiRecommendationApiResponse | null;
  onRetry: () => void;
  loadingLabel?: string;
}

const PRIORITY_STYLES: Record<
  RecommendationPriority,
  { label: string; classes: string }
> = {
  high: {
    label: "High Priority",
    classes: "border-rose-400/35 text-rose-200 bg-rose-500/15",
  },
  medium: {
    label: "Medium Priority",
    classes: "border-amber-400/35 text-amber-200 bg-amber-500/15",
  },
  low: {
    label: "Low Priority",
    classes: "border-secondary/35 text-secondary bg-secondary/15",
  },
};

const BASIS_LABELS: Record<DataBasisTag, { label: string; classes: string }> = {
  observed: {
    label: "Observed Data",
    classes: "border-secondary/30 text-secondary",
  },
  forecast: {
    label: "Provider Forecast",
    classes: "border-primary/30 text-primary",
  },
  estimate: {
    label: "Estimate",
    classes: "border-tertiary/30 text-tertiary",
  },
  general_advice: {
    label: "General Advice",
    classes: "border-white/20 text-on-surface-variant",
  },
};

const ERROR_TITLE_MAP: Record<
  AiErrorState["code"],
  { badge: string; heading: string; accent: string }
> = {
  APP_RATE_LIMITED: {
    badge: "App Cooldown",
    heading: "Too Many Recent Requests",
    accent: "border-amber-400/35 text-amber-200",
  },
  PROVIDER_QUOTA_EXCEEDED: {
    badge: "Gemini Quota",
    heading: "Gemini API Quota Reached",
    accent: "border-amber-400/35 text-amber-200",
  },
  PROVIDER_OVERLOADED: {
    badge: "Provider Busy",
    heading: "Gemini Temporarily Overloaded",
    accent: "border-amber-400/35 text-amber-200",
  },
  TIMEOUT: {
    badge: "Request Timeout",
    heading: "Gemini Response Timed Out",
    accent: "border-amber-400/35 text-amber-200",
  },
  GEMINI_KEY_MISSING: {
    badge: "Config Required",
    heading: "Gemini API Key Missing",
    accent: "border-rose-400/35 text-rose-200",
  },
  AUTH_ERROR: {
    badge: "Auth Error",
    heading: "Gemini Credentials Rejected",
    accent: "border-rose-400/35 text-rose-200",
  },
  OPENWEATHER_UNAVAILABLE: {
    badge: "Telemetry Offline",
    heading: "OpenWeather Telemetry Required",
    accent: "border-amber-400/35 text-amber-200",
  },
  INVALID_REQUEST: {
    badge: "Validation",
    heading: "Invalid Request Parameters",
    accent: "border-rose-400/35 text-rose-200",
  },
  INVALID_AI_OUTPUT: {
    badge: "Schema Validation",
    heading: "Unexpected AI Output Format",
    accent: "border-rose-400/35 text-rose-200",
  },
  MODEL_ERROR: {
    badge: "Provider Error",
    heading: "Gemini Service Error",
    accent: "border-rose-400/35 text-rose-200",
  },
  NETWORK_ERROR: {
    badge: "Network Error",
    heading: "Connection Interrupted",
    accent: "border-rose-400/35 text-rose-200",
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export function AiRecommendationCards({
  loading,
  error,
  cooldownSeconds,
  response,
  onRetry,
  loadingLabel = "Generating grounded recommendations with Gemini AI…",
}: AiRecommendationCardsProps) {
  if (loading) {
    return (
      <section
        aria-live="polite"
        aria-busy="true"
        className="liquid-glass rounded-3xl p-5 sm:p-6"
      >
        <div className="flex items-center gap-3">
          <div className="liquid-pill flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 text-primary">
            <SparklesIcon size={18} className="animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{loadingLabel}</p>
            <p className="text-xs text-on-surface-variant">
              Verifying current OpenWeather readings on the server and validating
              structured JSON output…
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    const meta = ERROR_TITLE_MAP[error.code] ?? ERROR_TITLE_MAP.MODEL_ERROR;
    const isCooldownActive = cooldownSeconds > 0;
    const retryDisabled = loading || isCooldownActive;

    return (
      <section
        role="alert"
        className={`liquid-glass rounded-2xl border p-5 ${meta.accent.split(" ")[0]}`}
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div
              className={`liquid-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${meta.accent}`}
            >
              <AlertTriangleIcon size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`liquid-pill tabular-telemetry rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${meta.accent}`}
                >
                  {meta.badge}
                </span>
                <h3 className="text-sm font-bold text-white sm:text-base">
                  {meta.heading}
                </h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant sm:text-[13px]">
                {error.message}
              </p>
              {error.retryAfterSeconds !== undefined &&
                error.retryAfterSeconds > 0 && (
                  <p className="tabular-telemetry mt-1.5 text-[11px] font-medium text-amber-200/90">
                    {isCooldownActive
                      ? `Cooldown active — retry available in ${cooldownSeconds}s.`
                      : `Suggested wait window: ~${formatDuration(error.retryAfterSeconds)}.`}
                  </p>
                )}
            </div>
          </div>

          <button
            type="button"
            disabled={retryDisabled}
            onClick={onRetry}
            className="liquid-cta inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshIcon size={15} />
            <span>
              {isCooldownActive ? `Wait ${cooldownSeconds}s` : "Retry"}
            </span>
          </button>
        </div>
      </section>
    );
  }

  if (!response) return null;

  const { result, contextMeta, model } = response;
  const aqiMeta = OPENWEATHER_AQI_SCALE[contextMeta.aqi];
  const usMeta =
    contextMeta.usAqi !== null ? classifyUsAqi(contextMeta.usAqi) : null;
  const cpcbMeta =
    contextMeta.primaryAqiStandard === "IND_CPCB" &&
    typeof contextMeta.primaryAqiValue === "number"
      ? classifyCpcbAqi(contextMeta.primaryAqiValue)
      : null;

  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      {/* Executive Summary & Optional Direct Answer */}
      <section className="liquid-glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary-container/15 blur-[90px]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="liquid-pill flex h-8 w-8 items-center justify-center rounded-xl border border-primary/35 text-primary">
                <SparklesIcon size={17} />
              </span>
              <h2 className="text-lg font-bold text-white">
                AirWise AI Synthesis
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {cpcbMeta && typeof contextMeta.primaryAqiValue === "number" && (
                <span
                  className={`liquid-pill tabular-telemetry rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cpcbMeta.badgeBorderClass} ${cpcbMeta.textClass}`}
                >
                  CPCB {contextMeta.primaryAqiValue} ({cpcbMeta.shortLabel})
                </span>
              )}
              {contextMeta.usAqi !== null && usMeta && (
                <span
                  className={`liquid-pill tabular-telemetry rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${usMeta.badgeBorderClass} ${usMeta.textClass}`}
                >
                  US AQI {contextMeta.usAqi} ({usMeta.shortLabel})
                </span>
              )}
              <span
                className={`liquid-pill tabular-telemetry rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${aqiMeta.badgeBorderClass} ${aqiMeta.textClass}`}
              >
                OW {contextMeta.aqi}/5 ({aqiMeta.label})
              </span>
              <span className="liquid-pill tabular-telemetry rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] text-on-surface-variant">
                {model}
              </span>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-on-surface sm:text-[15px]">
            {result.summary}
          </p>

          {result.directAnswer && (
            <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 p-4">
              <span className="tabular-telemetry block text-[10px] font-bold tracking-wider text-primary uppercase">
                Direct Answer
              </span>
              <p className="mt-1 text-sm leading-relaxed text-white">
                {result.directAnswer}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Actionable Priority Cards */}
      <section
        aria-label="Actionable recommendations"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {result.recommendations.map((rec, index) => {
          const priorityStyle = PRIORITY_STYLES[rec.priority];
          const basisStyle = BASIS_LABELS[rec.basis];
          return (
            <article
              key={`${rec.title}-${index}`}
              className="liquid-glass liquid-glass-interactive flex flex-col justify-between rounded-2xl p-5"
            >
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`tabular-telemetry rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${priorityStyle.classes}`}
                  >
                    {priorityStyle.label}
                  </span>
                  <span
                    className={`liquid-pill tabular-telemetry rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${basisStyle.classes}`}
                  >
                    {basisStyle.label}
                  </span>
                </div>

                <span className="tabular-telemetry text-[10px] font-semibold tracking-wider text-primary/90 uppercase">
                  {rec.category}
                </span>
                <h3 className="mt-0.5 text-base font-bold text-white sm:text-lg">
                  {rec.title}
                </h3>

                <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <CheckCircleIcon
                    size={16}
                    className="mt-0.5 shrink-0 text-secondary"
                  />
                  <p className="text-xs font-medium leading-relaxed text-white sm:text-[13px]">
                    {rec.action}
                  </p>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-on-surface-variant sm:text-[13px]">
                  {rec.explanation}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      {/* Transparent Caveats & Verification Footer */}
      {result.caveats.length > 0 && (
        <section
          aria-label="Data notes and caveats"
          className="liquid-glass rounded-2xl p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="tabular-telemetry text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
              Transparency &amp; Limitations
            </span>
            <span className="tabular-telemetry text-[11px] text-on-surface-variant">
              Server-verified OpenWeather observation:{" "}
              {formatTimestampReadable(contextMeta.observedAt)}
            </span>
          </div>
          <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
            {result.caveats.map((caveat, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{caveat}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
