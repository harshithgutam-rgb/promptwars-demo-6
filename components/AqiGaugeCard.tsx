"use client";

import { useState } from "react";
import {
  formatTimestampReadable,
  formatWindDirection,
  OPENWEATHER_AQI_SCALE,
  type AirQualityData,
} from "@/lib/air-quality";
import {
  classifyUsAqi,
  usAqiArcFraction,
  US_VS_CPCB_DISCLOSURE,
  type UsAqiSubIndices,
} from "@/lib/us-aqi";
import {
  classifyCpcbAqi,
  cpcbAqiArcFraction,
  CPCB_STANDARD_DISCLOSURE,
  type CpcbSubIndices,
} from "@/lib/cpcb-aqi";
import type { AirQualityStatus } from "@/components/LocationContext";
import { DropletIcon, VerifiedIcon, WindIcon } from "@/components/Icons";

interface AqiGaugeCardProps {
  status: AirQualityStatus;
  data: AirQualityData | null;
  onSelectLocation: () => void;
}

const US_SUB_INDEX_ORDER: Array<{ key: keyof UsAqiSubIndices; label: string }> = [
  { key: "pm2_5", label: "PM2.5" },
  { key: "pm10", label: "PM10" },
  { key: "o3", label: "O₃" },
  { key: "no2", label: "NO₂" },
  { key: "so2", label: "SO₂" },
  { key: "co", label: "CO" },
];

const CPCB_SUB_INDEX_ORDER: Array<{
  key: keyof CpcbSubIndices;
  label: string;
}> = [
  { key: "pm2_5", label: "PM2.5" },
  { key: "pm10", label: "PM10" },
  { key: "no2", label: "NO₂" },
  { key: "so2", label: "SO₂" },
  { key: "co", label: "CO" },
  { key: "o3", label: "O₃" },
  { key: "nh3", label: "NH₃" },
];

export function AqiGaugeCard({
  status,
  data,
  onSelectLocation,
}: AqiGaugeCardProps) {
  const [showSubIndices, setShowSubIndices] = useState(false);
  const [showStationInfo, setShowStationInfo] = useState(false);

  const cpcbAqi = data?.cpcbAqi ?? null;
  const cpcbCategory = cpcbAqi ? classifyCpcbAqi(cpcbAqi.value) : null;
  const cpcbRegionalRef = data?.cpcbRegionalReference ?? null;
  const cpcbRegionalCat = cpcbRegionalRef
    ? classifyCpcbAqi(cpcbRegionalRef.value)
    : null;
  const nearestStationMeta = data?.cpcbNearestStationMeta ?? null;
  const usAqi = data?.usAqi ?? null;
  const usCategory = usAqi ? classifyUsAqi(usAqi.value) : null;
  const owLevel = data ? OPENWEATHER_AQI_SCALE[data.current.aqi] : null;

  // Primary gauge prioritizes official India CPCB ground station when fresh & valid,
  // otherwise displays Open-Meteo US EPA AQI (0–500+). Never converts OpenWeather 1–5.
  const isCpcbPrimary = Boolean(cpcbAqi && cpcbCategory);
  const activeValue = isCpcbPrimary
    ? cpcbAqi!.value
    : usAqi
      ? usAqi.value
      : null;
  const activeCategory = isCpcbPrimary ? cpcbCategory : usCategory;

  const circumference = 2 * Math.PI * 50; // r = 50 => ~314.16
  const strokeDashoffset =
    activeValue !== null
      ? circumference *
        (1 -
          (isCpcbPrimary
            ? cpcbAqiArcFraction(activeValue)
            : usAqiArcFraction(activeValue)))
      : circumference;

  const pm25 = data?.current.components.pm2_5 ?? null;
  const weather = data?.weather ?? null;
  const windMph =
    weather !== null ? (weather.windSpeedMs * 2.23694).toFixed(1) : null;
  const windDir = weather !== null ? formatWindDirection(weather.windDeg) : "";
  const tempC = weather !== null ? Math.round(weather.tempC) : null;
  const tempF =
    weather !== null ? Math.round((weather.tempC * 9) / 5 + 32) : null;

  const subIndexEntries: Array<{ key: string; label: string; value: number }> =
    isCpcbPrimary && cpcbAqi
      ? CPCB_SUB_INDEX_ORDER.map((item) => ({
          ...item,
          value: cpcbAqi.subIndices[item.key],
        })).filter(
          (entry): entry is { key: keyof CpcbSubIndices; label: string; value: number } =>
            entry.value !== null
        )
      : usAqi
        ? US_SUB_INDEX_ORDER.map((item) => ({
            ...item,
            value: usAqi.subIndices[item.key],
          })).filter(
            (entry): entry is { key: keyof UsAqiSubIndices; label: string; value: number } =>
              entry.value !== null
          )
        : [];

  return (
    <section
      aria-label="Real-Time Purity Gauge"
      className="liquid-glass relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 sm:p-6 lg:col-span-5"
    >
      {/* Diffuse Backlight Pods (Pure radial gradients for identical optics at zero blur cost) */}
      <div
        className="pointer-events-none absolute -top-28 -left-28 h-96 w-96 rounded-full"
        style={{
          background: activeCategory
            ? `radial-gradient(circle, ${activeCategory.glowRgba} 0%, transparent 68%)`
            : owLevel
              ? `radial-gradient(circle, ${owLevel.glowRgba} 0%, transparent 68%)`
              : "radial-gradient(circle, rgba(56,189,248,0.22) 0%, transparent 68%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-28 -bottom-28 h-96 w-96 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(142,213,255,0.16) 0%, transparent 68%)",
        }}
      />

      {/* Header Label Inside Dial Card */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <div className="mb-0.5 flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                activeCategory
                  ? activeCategory.dotClass
                  : owLevel
                    ? owLevel.dotClass
                    : "bg-primary"
              }`}
            />
            <span
              className={`tabular-telemetry block text-[11px] font-bold tracking-[0.09em] uppercase ${
                activeCategory
                  ? activeCategory.textClass
                  : owLevel
                    ? owLevel.textClass
                    : "text-primary"
              }`}
            >
              {isCpcbPrimary
                ? "India AQI (CPCB) — Ground Station"
                : "US AQI — Open-Meteo Modeled Estimate"}
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Real-Time Purity Gauge
          </h2>
        </div>

        <div
          className={`liquid-pill flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
            activeCategory
              ? `${activeCategory.badgeBorderClass} ${activeCategory.textClass}`
              : "border-white/20 text-primary"
          }`}
          title={
            isCpcbPrimary && cpcbAqi
              ? `${cpcbAqi.label} • ${cpcbAqi.stationName} (${cpcbAqi.stationDistanceKm.toFixed(1)} km) • Observed ${formatTimestampReadable(cpcbAqi.observedAt)} (${cpcbAqi.license})`
              : usAqi
                ? `${usAqi.label} • Valid ${formatTimestampReadable(usAqi.validAt)} (${usAqi.license})`
                : "Awaiting live AQI telemetry"
          }
        >
          <VerifiedIcon size={19} />
        </div>
      </div>

      {/* Liquid Glass Concentric Optics & Precision Arc Dial */}
      <div className="relative z-10 my-5 flex flex-col items-center justify-center">
        <div className="relative flex h-60 w-60 items-center justify-center sm:h-72 sm:w-72">
          {/* Concentric Outer Glass Lens Ring */}
          <div
            className={`liquid-glass-lens absolute inset-0 rounded-full border border-white/20 ${
              status === "loading" ? "animate-pulse" : ""
            }`}
          />
          {/* Mid Refraction Ring */}
          <div className="absolute inset-4 rounded-full border border-white/15 bg-white/[0.02] shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]" />
          {/* Inner Frosted Depth Chamber */}
          <div className="absolute inset-8 rounded-full border border-white/20 bg-gradient-to-b from-white/10 to-transparent shadow-[inset_0_2px_6px_rgba(255,255,255,0.3),0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:inset-9" />

          {/* SVG Precision Arc Dial (Mapped to active 0–500 standard: CPCB IND-NAQI or US EPA AQI) */}
          <svg
            className="relative z-10 h-56 w-56 -rotate-90 transform sm:h-64 sm:w-64"
            viewBox="0 0 120 120"
            role="img"
            aria-label={
              isCpcbPrimary && cpcbAqi && cpcbCategory
                ? `India CPCB AQI ${cpcbAqi.value}, rated ${cpcbCategory.label}, station ${cpcbAqi.stationName}`
                : usAqi && usCategory
                  ? `US AQI ${usAqi.value}, rated ${usCategory.label}, Open-Meteo modeled estimate`
                  : "AQI gauge awaiting live data"
            }
          >
            <defs>
              <linearGradient
                id="arcNeonGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={activeCategory?.secondaryHex ?? "#38bdf8"}
                />
                <stop
                  offset="60%"
                  stopColor={activeCategory?.accentHex ?? "#4edea3"}
                />
                <stop
                  offset="100%"
                  stopColor={activeCategory?.accentHex ?? "#57e1ce"}
                />
              </linearGradient>
              <filter
                id="arcGlow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="2.8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Track Circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="transparent"
              stroke="rgba(255,255,255,0.11)"
              strokeWidth="7.5"
            />

            {/* Glowing Active Arc (0–500 active standard; never driven by OpenWeather 1–5) */}
            {activeValue !== null && activeCategory && (
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="transparent"
                stroke="url(#arcNeonGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                filter="url(#arcGlow)"
                style={{
                  transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            )}
          </svg>

          {/* Dial Center Content */}
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
            <span className="tabular-telemetry text-[10px] font-semibold tracking-[0.1em] text-on-surface-variant uppercase">
              {isCpcbPrimary
                ? activeCategory?.isBeyondScale
                  ? "CPCB AQI (>500)"
                  : "INDIA AQI (CPCB)"
                : activeCategory?.isBeyondScale
                  ? "US AQI (>500)"
                  : "US AQI (0–500)"}
            </span>

            {status === "loading" ? (
              <div className="my-2 h-11 w-20 animate-pulse rounded-xl bg-white/15" />
            ) : activeValue !== null ? (
              <span className="tabular-telemetry my-0.5 text-[46px] leading-none font-bold tracking-tighter text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] sm:text-[54px]">
                {activeValue}
              </span>
            ) : (
              <span className="tabular-telemetry my-1 text-3xl font-bold text-white/60">
                --
              </span>
            )}

            {/* Active Standard Category Badge */}
            {status === "loading" ? (
              <div className="liquid-pill mt-1 inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1 text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="tabular-telemetry text-[10px] font-bold tracking-wider uppercase">
                  Syncing Live
                </span>
              </div>
            ) : activeCategory ? (
              <div
                className={`liquid-pill mt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${activeCategory.badgeBorderClass} ${activeCategory.textClass}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${activeCategory.dotClass}`}
                />
                <span className="tabular-telemetry text-[10px] font-bold tracking-wider uppercase">
                  {activeCategory.shortLabel}
                </span>
              </div>
            ) : (
              <div className="liquid-pill mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-on-surface-variant">
                <span className="tabular-telemetry text-[10px] font-bold tracking-wider uppercase">
                  {status === "idle" ? "Select Location" : "AQI Unavailable"}
                </span>
              </div>
            )}

            {/* Dominant Pollutant Readout */}
            <span className="tabular-telemetry mt-2 text-[11px] font-medium text-primary">
              {isCpcbPrimary && cpcbAqi
                ? `Dominant: ${cpcbAqi.dominantPollutant.label} (${cpcbAqi.dominantPollutant.aqi})`
                : usAqi?.dominantPollutant
                  ? `Dominant: ${usAqi.dominantPollutant.label} (${usAqi.dominantPollutant.aqi})`
                  : pm25 !== null
                    ? `OW PM2.5: ${pm25.toFixed(1)} µg/m³`
                    : "PM2.5: -- µg/m³"}
            </span>
          </div>
        </div>

        {/* Secondary Compact Badges (Separately Labeled — Never Merged) */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {isCpcbPrimary &&
            cpcbAqi &&
            cpcbAqi.distanceBand === "extended_25km" && (
              <div
                className="liquid-pill inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 px-3 py-1 text-[11px] text-amber-200"
                title="Station is between 10 and 25 km from the selected coordinates"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                <span className="tabular-telemetry font-semibold">
                  Station {cpcbAqi.stationDistanceKm.toFixed(1)} km away
                </span>
              </div>
            )}

          {!isCpcbPrimary && cpcbRegionalRef && cpcbRegionalCat && (
            <div
              className={`liquid-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${cpcbRegionalCat.badgeBorderClass}`}
              title={`Regional CPCB Reference Only (not exact location) • ${cpcbRegionalRef.stationName} (${cpcbRegionalRef.stationDistanceKm.toFixed(1)} km)`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${cpcbRegionalCat.dotClass}`}
              />
              <span className="text-on-surface-variant">
                Regional CPCB Ref ({cpcbRegionalRef.stationDistanceKm.toFixed(0)} km):
              </span>
              <span
                className={`tabular-telemetry font-bold ${cpcbRegionalCat.textClass}`}
              >
                {cpcbRegionalRef.value} ({cpcbRegionalCat.shortLabel})
              </span>
            </div>
          )}

          {isCpcbPrimary && usAqi && usCategory && (
            <div
              className={`liquid-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${usCategory.badgeBorderClass}`}
              title={`Open-Meteo CAMS Modeled Estimate • Valid ${formatTimestampReadable(usAqi.validAt)}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${usCategory.dotClass}`} />
              <span className="text-on-surface-variant">US AQI (Modeled):</span>
              <span className={`tabular-telemetry font-bold ${usCategory.textClass}`}>
                {usAqi.value} ({usCategory.shortLabel})
              </span>
            </div>
          )}

          {owLevel && data && (
            <div
              className={`liquid-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${owLevel.badgeBorderClass}`}
              title={`OpenWeather Air Pollution API (SILAM Modeled) • Valid ${formatTimestampReadable(data.observedAt)}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${owLevel.dotClass}`} />
              <span className="text-on-surface-variant">OpenWeather:</span>
              <span className={`tabular-telemetry font-bold ${owLevel.textClass}`}>
                {owLevel.index}/5 ({owLevel.label})
              </span>
            </div>
          )}

          {subIndexEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSubIndices((prev) => !prev)}
              className="liquid-btn tabular-telemetry rounded-full px-3 py-1 text-[10px] font-semibold tracking-wider text-primary uppercase"
              aria-expanded={showSubIndices}
            >
              {showSubIndices
                ? "Hide Sub-Indices"
                : isCpcbPrimary
                  ? "CPCB Sub-Indices"
                  : "US AQI Breakdown"}
            </button>
          )}

          {(cpcbAqi || cpcbRegionalRef || nearestStationMeta) && (
            <button
              type="button"
              onClick={() => setShowStationInfo((prev) => !prev)}
              className="liquid-btn tabular-telemetry rounded-full px-3 py-1 text-[10px] font-semibold tracking-wider text-secondary uppercase"
              aria-expanded={showStationInfo}
            >
              {showStationInfo ? "Hide Station Info" : "Nearest CPCB Info"}
            </button>
          )}
        </div>

        {/* Expandable Nearest CPCB Station Information */}
        {showStationInfo &&
          (cpcbAqi || cpcbRegionalRef || nearestStationMeta) && (
            <div className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left text-[11px] leading-relaxed text-on-surface-variant">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="tabular-telemetry text-[10px] font-bold tracking-wider text-secondary uppercase">
                  Nearest CPCB Monitoring Station
                </span>
                <span className="tabular-telemetry rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white">
                  {(
                    cpcbAqi?.stationDistanceKm ??
                    cpcbRegionalRef?.stationDistanceKm ??
                    nearestStationMeta?.distanceKm ??
                    0
                  ).toFixed(1)}{" "}
                  km away
                </span>
              </div>
              <p className="mt-1 font-semibold text-white">
                {cpcbAqi?.stationName ??
                  cpcbRegionalRef?.stationName ??
                  nearestStationMeta?.stationName}
              </p>
              <p className="tabular-telemetry mt-0.5 text-[10px]">
                Observed:{" "}
                {formatTimestampReadable(
                  cpcbAqi?.observedAt ??
                    cpcbRegionalRef?.observedAt ??
                    nearestStationMeta?.observedAt ??
                    ""
                )}{" "}
                •{" "}
                {cpcbAqi
                  ? `Active Primary (${cpcbAqi.distanceBand === "local_10km" ? "≤10 km local" : "10–25 km nearby"}, ${cpcbAqi.validPollutantCount} pollutants)`
                  : cpcbRegionalRef
                    ? `Regional Reference Only (25–50 km — AQI ${cpcbRegionalRef.value}, not used as exact location AQI)`
                    : nearestStationMeta
                      ? `Not used as primary (${nearestStationMeta.valid ? `${nearestStationMeta.distanceKm.toFixed(1)} km > 25 km` : `only ${nearestStationMeta.validPollutantCount} valid pollutants`})`
                      : "Fallback active"}
              </p>
              {data?.cpcbUnavailableReason && (
                <p className="mt-1 text-[10px] text-amber-200/90">
                  {data.cpcbUnavailableReason}
                </p>
              )}
            </div>
          )}

        {/* Optional Pollutant-Specific Sub-Index Breakdown */}
        {showSubIndices && subIndexEntries.length > 0 && (
          <div className="mt-3 grid w-full grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
            {subIndexEntries.map((entry) => {
              const cat = isCpcbPrimary
                ? classifyCpcbAqi(entry.value)
                : classifyUsAqi(entry.value);
              const isDom = isCpcbPrimary
                ? cpcbAqi?.dominantPollutant.key === entry.key
                : usAqi?.dominantPollutant?.key === entry.key;
              return (
                <div
                  key={entry.key}
                  className={`rounded-xl border px-2 py-1.5 ${
                    isDom
                      ? "border-primary/40 bg-primary/10"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <span className="tabular-telemetry block text-[10px] text-on-surface-variant">
                    {entry.label}
                    {isDom ? " ★" : ""}
                  </span>
                  <span
                    className={`tabular-telemetry text-xs font-bold ${cat.textClass}`}
                  >
                    {entry.value}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Guidance & Source Transparency */}
        <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-on-surface-variant">
          {status === "loading"
            ? "Retrieving ground-station CPCB (India), modeled US AQI (Open-Meteo), and OpenWeather telemetry…"
            : isCpcbPrimary && cpcbAqi && cpcbCategory
              ? `${cpcbCategory.label} (${cpcbCategory.rangeLabel}). Station: ${cpcbAqi.stationName} (${cpcbAqi.stationDistanceKm.toFixed(1)} km) • Observed ${formatTimestampReadable(cpcbAqi.observedAt)} via CPCB / data.gov.in.`
              : usCategory && usAqi
                ? `${usCategory.label} (${usCategory.rangeLabel}). Valid ${formatTimestampReadable(usAqi.validAt)} via Open-Meteo CAMS model.${data?.cpcbUnavailableReason ? ` ${data.cpcbUnavailableReason}` : ""}`
                : status === "idle"
                  ? "Select your browser location or search any city worldwide to load live air quality readings."
                  : data?.usAqiUnavailableReason ??
                    "Primary 0–500 AQI is unavailable for these coordinates. OpenWeather 1–5 is shown separately without scale conversion."}
        </p>

        {data && (
          <p className="mt-1.5 max-w-sm text-center text-[10px] leading-relaxed text-on-surface-variant/80">
            {isCpcbPrimary ? CPCB_STANDARD_DISCLOSURE : US_VS_CPCB_DISCLOSURE}
          </p>
        )}

        {status === "idle" && (
          <button
            type="button"
            onClick={onSelectLocation}
            className="liquid-cta mt-3 rounded-full px-4 py-2 text-xs font-bold text-on-primary-container"
          >
            Choose Location
          </button>
        )}
      </div>

      {/* Dial Footer Environmental Baseline (Real OpenWeather Weather Data or Honest Unavailable) */}
      <div className="relative z-10 grid grid-cols-3 gap-1.5 rounded-2xl p-2.5 text-center liquid-pill sm:p-3">
        <div className="flex flex-col items-center justify-center">
          <span className="tabular-telemetry flex items-center gap-1 text-[10px] font-semibold tracking-wider text-on-surface-variant/85 uppercase">
            <WindIcon size={12} className="text-primary" />
            Airflow
          </span>
          <span className="tabular-telemetry mt-0.5 text-xs font-semibold text-white">
            {windMph !== null
              ? `${windMph} mph${windDir ? ` ${windDir}` : ""}`
              : "Unavailable"}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center border-x border-white/10 px-1">
          <span className="tabular-telemetry text-[10px] font-semibold tracking-wider text-on-surface-variant/85 uppercase">
            Ambient
          </span>
          <span className="tabular-telemetry mt-0.5 text-xs font-semibold text-white">
            {tempC !== null && tempF !== null
              ? `${tempF}°F / ${tempC}°C`
              : "Unavailable"}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center">
          <span className="tabular-telemetry flex items-center gap-1 text-[10px] font-semibold tracking-wider text-on-surface-variant/85 uppercase">
            <DropletIcon size={12} className="text-tertiary" />
            Humidity
          </span>
          <span className="tabular-telemetry mt-0.5 text-xs font-semibold text-secondary">
            {weather !== null ? `${Math.round(weather.humidity)}% RH` : "Unavailable"}
          </span>
        </div>
      </div>
    </section>
  );
}
