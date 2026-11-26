"use client";

import { memo } from "react";
import {
  classifyPollutant,
  formatWindDirection,
  type AirQualityData,
} from "@/lib/air-quality";
import type { AirQualityStatus } from "@/components/LocationContext";
import { WindIcon } from "@/components/Icons";

interface PollutantGridProps {
  status: AirQualityStatus;
  data: AirQualityData | null;
}

interface PollutantCardConfig {
  key: "pm2_5" | "pm10" | "o3" | "no2";
  title: string;
  symbol: string;
  subtitle: string;
}

const PRIMARY_POLLUTANTS: PollutantCardConfig[] = [
  {
    key: "pm2_5",
    title: "Fine Particulate",
    symbol: "PM2.5",
    subtitle: "Respirable fine aerosols",
  },
  {
    key: "pm10",
    title: "Coarse Particulate",
    symbol: "PM10",
    subtitle: "Coarse dust & airborne particles",
  },
  {
    key: "o3",
    title: "Tropospheric Ozone",
    symbol: "O₃",
    subtitle: "Ground-level ozone concentration",
  },
  {
    key: "no2",
    title: "Nitrogen Dioxide",
    symbol: "NO₂",
    subtitle: "Combustion & urban trace gas",
  },
];

export const PollutantGrid = memo(function PollutantGrid({
  status,
  data,
}: PollutantGridProps) {
  const components = data?.current.components ?? null;
  const weather = data?.weather ?? null;

  const windMph =
    weather !== null ? (weather.windSpeedMs * 2.23694).toFixed(1) : null;
  const windDir = weather !== null ? formatWindDirection(weather.windDeg) : "";

  return (
    <section
      aria-label="Primary Pollutants and Atmospheric Telemetry"
      className="flex flex-col justify-between gap-4 lg:col-span-7"
    >
      {/* 2x2 Liquid Glass Pollutant Metrics Array (2 cols on mobile & desktop, matching Stitch!) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {PRIMARY_POLLUTANTS.map((item) => {
          const rawValue = components ? components[item.key] : null;
          const meta = classifyPollutant(item.key, rawValue);

          return (
            <article
              key={item.key}
              className="liquid-glass liquid-glass-interactive flex flex-col justify-between rounded-2xl p-3.5 sm:p-5"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="tabular-telemetry truncate text-[10px] font-semibold tracking-[0.07em] text-on-surface-variant uppercase sm:text-[11px]">
                  {item.title}
                </span>
                <span
                  className={`liquid-pill inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold sm:px-2.5 ${meta.borderClass} ${meta.textClass}`}
                >
                  {status === "loading" ? "…" : meta.status}
                </span>
              </div>

              <div className="my-2.5 sm:my-3">
                {status === "loading" ? (
                  <div className="h-9 w-24 animate-pulse rounded-lg bg-white/15" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="tabular-telemetry text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
                      {rawValue !== null ? rawValue.toFixed(1) : "--"}
                    </span>
                    <span className="tabular-telemetry text-xs text-on-surface-variant sm:text-[13px]">
                      µg/m³
                    </span>
                  </div>
                )}
                <p className="mt-1 truncate text-[11px] text-on-surface-variant sm:text-[13px]">
                  <span className="font-semibold text-white/90">
                    {item.symbol}
                  </span>{" "}
                  • {rawValue !== null ? meta.thresholdNote : item.subtitle}
                </p>
              </div>

              {/* Luminous Progress Track */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 p-[1px] shadow-inner">
                <div
                  className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${meta.barGradientClass}`}
                  style={{
                    width:
                      status === "loading"
                        ? "35%"
                        : `${rawValue !== null ? meta.percent : 0}%`,
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>

      {/* Integrated Atmospheric Dispersion & Secondary Trace Gases Liquid Glass Slab */}
      <div className="liquid-glass flex flex-col items-start justify-between gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="liquid-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 text-primary shadow-inner sm:h-12 sm:w-12">
            <WindIcon size={24} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white sm:text-lg">
              {weather?.description
                ? `Atmosphere: ${weather.description.replace(
                    /\b\w/g,
                    (c) => c.toUpperCase()
                  )}`
                : "Secondary Trace Gases & Dispersion"}
            </h3>
            <p className="text-xs text-on-surface-variant sm:text-[13px]">
              {windMph !== null
                ? `Measured surface airflow ${windMph} mph${
                    windDir ? ` ${windDir}` : ""
                  }${
                    weather?.pressureHpa
                      ? ` • Baro ${Math.round(weather.pressureHpa)} hPa`
                      : ""
                  }`
                : "Additional OpenWeather trace gases measured in µg/m³"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-center">
          <span className="liquid-pill tabular-telemetry rounded-full border border-tertiary/25 px-3 py-1 text-[11px] font-bold text-tertiary">
            SO₂:{" "}
            {components?.so2 !== null && components?.so2 !== undefined
              ? `${components.so2.toFixed(1)} µg/m³`
              : "--"}
          </span>
          <span className="liquid-pill tabular-telemetry rounded-full border border-primary/25 px-3 py-1 text-[11px] font-bold text-primary">
            CO:{" "}
            {components?.co !== null && components?.co !== undefined
              ? `${Math.round(components.co)} µg/m³`
              : "--"}
          </span>
          <span className="liquid-pill tabular-telemetry rounded-full border border-secondary/25 px-3 py-1 text-[11px] font-bold text-secondary">
            NH₃:{" "}
            {components?.nh3 !== null && components?.nh3 !== undefined
              ? `${components.nh3.toFixed(1)} µg/m³`
              : "--"}
          </span>
        </div>
      </div>
    </section>
  );
});
