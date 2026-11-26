"use client";

import { useMemo, useState } from "react";
import {
  OPENWEATHER_AQI_SCALE,
  type ForecastPoint,
} from "@/lib/air-quality";
import { classifyUsAqi, type UsAqiForecastPoint } from "@/lib/us-aqi";
import type { AirQualityStatus } from "@/components/LocationContext";
import { TimelineIcon } from "@/components/Icons";

type MetricMode = "us_aqi" | "ow_aqi" | "pm2_5" | "o3";

interface TrajectoryChartProps {
  status: AirQualityStatus;
  forecast: ForecastPoint[];
  usAqiForecast?: UsAqiForecastPoint[];
  providerName?: string;
}

interface ChartPoint {
  x: number;
  y: number;
  value: number;
  timestamp: string;
  colorHex: string;
  textClass: string;
  categoryLabel: string;
  label: string;
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function formatHourLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrajectoryChart({
  status,
  forecast,
  usAqiForecast = [],
  providerName,
}: TrajectoryChartProps) {
  const [mode, setMode] = useState<MetricMode>("us_aqi");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const rawSeries: Array<{
      timestamp: string;
      value: number;
      colorHex: string;
      textClass: string;
      categoryLabel: string;
    }> = [];

    if (mode === "us_aqi") {
      for (const pt of usAqiForecast) {
        if (!Number.isFinite(pt.usAqi)) continue;
        const meta = classifyUsAqi(pt.usAqi);
        rawSeries.push({
          timestamp: pt.timestamp,
          value: pt.usAqi,
          colorHex: meta.accentHex,
          textClass: meta.textClass,
          categoryLabel: meta.label,
        });
      }
    } else {
      for (const pt of forecast) {
        const val =
          mode === "ow_aqi"
            ? pt.aqi
            : mode === "pm2_5"
              ? pt.pm2_5
              : pt.o3;
        if (val === null || !Number.isFinite(val)) continue;
        const owMeta = OPENWEATHER_AQI_SCALE[pt.aqi];
        rawSeries.push({
          timestamp: pt.timestamp,
          value: val,
          colorHex: owMeta.accentHex,
          textClass: owMeta.textClass,
          categoryLabel: owMeta.label,
        });
      }
    }

    if (rawSeries.length < 2) {
      return {
        points: [] as ChartPoint[],
        milestones: [] as ChartPoint[],
        linePath: "",
        areaPath: "",
      };
    }

    const width = 800;
    const height = 180;
    const padX = 24;
    const padTop = 26;
    const padBottom = 28;

    const rawValues = rawSeries.map((p) => p.value);
    const minVal =
      mode === "ow_aqi"
        ? 1
        : Math.max(0, Math.min(...rawValues) - (mode === "us_aqi" ? 10 : 1));
    const maxVal =
      mode === "ow_aqi"
        ? 5
        : Math.max(...rawValues, minVal + (mode === "us_aqi" ? 20 : 1));
    const span = Math.max(0.001, maxVal - minVal);

    const points: ChartPoint[] = rawSeries.map((pt, index) => {
      const ratioX = index / (rawSeries.length - 1);
      const x = padX + ratioX * (width - padX * 2);
      const ratioY = (pt.value - minVal) / span;
      const y = height - padBottom - ratioY * (height - padTop - padBottom);
      return {
        x,
        y,
        value: pt.value,
        timestamp: pt.timestamp,
        colorHex: pt.colorHex,
        textClass: pt.textClass,
        categoryLabel: pt.categoryLabel,
        label: index === 0 ? "NOW" : `+${index}H`,
      };
    });

    const linePath = buildSmoothPath(points);
    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = `${linePath} L ${last.x.toFixed(1)},${height} L ${first.x.toFixed(1)},${height} Z`;

    const targetIndices = [
      0,
      Math.min(points.length - 1, Math.round((points.length - 1) * 0.2)),
      Math.min(points.length - 1, Math.round((points.length - 1) * 0.45)),
      Math.min(points.length - 1, Math.round((points.length - 1) * 0.72)),
      points.length - 1,
    ];
    const uniqueIndices = Array.from(new Set(targetIndices));
    const milestones = uniqueIndices.map((idx) => points[idx]);

    return { points, milestones, linePath, areaPath };
  }, [forecast, usAqiForecast, mode]);

  const activePoint =
    selectedIdx !== null && chartData.points[selectedIdx]
      ? chartData.points[selectedIdx]
      : chartData.points[0] ?? null;

  const sourceSubtitle =
    mode === "us_aqi"
      ? "Hourly US AQI (0–500) modeled forecast from Open-Meteo (Copernicus CAMS)"
      : `Hourly forecast series from ${providerName ?? "OpenWeather Air Pollution API"} (${
          mode === "ow_aqi" ? "OpenWeather 1–5 scale" : "µg/m³"
        })`;

  return (
    <section
      aria-label="24-Hour Atmospheric Trajectory"
      className="liquid-glass below-fold-section mb-6 overflow-hidden rounded-3xl p-5 sm:p-6"
    >
      {/* Header + Segmented Pill Switcher */}
      <div className="flex flex-col justify-between gap-4 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2.5">
            <div className="liquid-pill flex h-7 w-7 items-center justify-center rounded-xl text-tertiary">
              <TimelineIcon size={18} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">
              24-Hour Atmospheric Trajectory
            </h2>
          </div>
          <p className="text-xs text-on-surface-variant sm:text-[13px]">
            {sourceSubtitle}
          </p>
        </div>

        {/* Liquid Pill Segment Selector */}
        <div
          className="liquid-pill inline-flex flex-wrap self-start rounded-full border border-white/15 p-1 sm:self-auto"
          role="tablist"
          aria-label="Forecast metric selector"
        >
          {(
            [
              { id: "us_aqi", label: "US AQI" },
              { id: "ow_aqi", label: "OW 1–5" },
              { id: "pm2_5", label: "PM2.5" },
              { id: "o3", label: "O₃" },
            ] as const
          ).map((tab) => {
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMode(tab.id);
                  setSelectedIdx(null);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "border border-white/25 bg-white/20 font-semibold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]"
                    : "text-on-surface-variant hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading / Unavailable / Live Chart Body */}
      {status === "loading" ? (
        <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="h-24 w-11/12 animate-pulse rounded-2xl bg-white/10" />
          <span className="mt-3 text-xs text-on-surface-variant">
            Loading 24-hour forecast series…
          </span>
        </div>
      ) : chartData.points.length < 2 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-4 text-center">
          <p className="text-sm font-semibold text-white">
            24-Hour Forecast Unavailable
          </p>
          <p className="mt-1 max-w-md text-xs text-on-surface-variant">
            Hourly forecast points appear here once provider forecast telemetry
            is loaded for your selected location. No simulated curves are
            generated.
          </p>
        </div>
      ) : (
        <>
          {/* Active Point Inspection Strip */}
          {activePoint && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs">
              <span className="text-on-surface-variant">
                Selected forecast point:{" "}
                <strong className="text-white">
                  {formatHourLabel(activePoint.timestamp)}
                </strong>
              </span>
              <span className="tabular-telemetry font-semibold text-primary">
                {mode === "us_aqi"
                  ? `US AQI ${Math.round(activePoint.value)} (${activePoint.categoryLabel}) • Open-Meteo modeled`
                  : mode === "ow_aqi"
                    ? `OpenWeather AQI ${activePoint.value}/5 (${activePoint.categoryLabel})`
                    : `${mode === "pm2_5" ? "PM2.5" : "O₃"}: ${activePoint.value.toFixed(1)} µg/m³`}
              </span>
            </div>
          )}

          {/* Screen-reader accessible text summary of the trajectory curve */}
          <div id="trajectory-chart-desc" className="sr-only">
            24-hour forecast summary ({sourceSubtitle}):{" "}
            {chartData.milestones
              .map(
                (pt, idx) =>
                  `${idx === 0 ? "Now" : pt.label} at ${formatHourLabel(pt.timestamp)}: ${
                    mode === "ow_aqi"
                      ? `OpenWeather ${pt.value} of 5 (${pt.categoryLabel})`
                      : mode === "us_aqi"
                        ? `US AQI ${Math.round(pt.value)} (${pt.categoryLabel})`
                        : `${pt.value.toFixed(1)} micrograms per cubic meter`
                  }`
              )
              .join("; ")}
            .
          </div>

          {/* SVG Spline Container */}
          <div className="relative h-48 w-full pt-2 pb-1 sm:h-56">
            <svg
              className="h-full w-full overflow-visible"
              viewBox="0 0 800 180"
              preserveAspectRatio="none"
              role="img"
              aria-labelledby="trajectory-svg-title"
              aria-describedby="trajectory-chart-desc"
            >
              <title id="trajectory-svg-title">
                24-hour air quality trajectory chart
              </title>
              <defs>
                <linearGradient
                  id="curveLiquidGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.42" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#060a14" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                  id="strokeLiquidGradient"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#4edea3" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#57e1ce" />
                </linearGradient>
                <filter
                  id="splineGlow"
                  x="-10%"
                  y="-30%"
                  width="120%"
                  height="160%"
                >
                  <feGaussianBlur stdDeviation="2.6" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <line
                x1="0"
                x2="800"
                y1="40"
                y2="40"
                stroke="#ffffff"
                strokeDasharray="4 6"
                strokeOpacity="0.1"
              />
              <line
                x1="0"
                x2="800"
                y1="95"
                y2="95"
                stroke="#ffffff"
                strokeDasharray="4 6"
                strokeOpacity="0.1"
              />
              <line
                x1="0"
                x2="800"
                y1="145"
                y2="145"
                stroke="#ffffff"
                strokeDasharray="4 6"
                strokeOpacity="0.1"
              />

              <path d={chartData.areaPath} fill="url(#curveLiquidGradient)" />
              <path
                d={chartData.linePath}
                fill="none"
                stroke="url(#strokeLiquidGradient)"
                strokeWidth="3.2"
                strokeLinecap="round"
                filter="url(#splineGlow)"
              />

              {chartData.milestones.map((pt, i) => {
                const pointIdx = chartData.points.indexOf(pt);
                const isSelected = selectedIdx === pointIdx;
                return (
                  <g
                    key={pt.timestamp}
                    className="cursor-pointer"
                    onClick={() => setSelectedIdx(pointIdx)}
                  >
                    {i === 0 && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="9"
                        fill={pt.colorHex}
                        className="animate-ping opacity-35"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? "7" : "5.5"}
                      fill={pt.colorHex}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Timeline X-Axis Milestones */}
          <div className="mt-2 grid grid-cols-5 gap-1 border-t border-white/10 pt-3 text-center">
            {chartData.milestones.map((pt, idx) => {
              const pointIdx = chartData.points.indexOf(pt);
              const isSelected = selectedIdx === pointIdx;
              return (
                <button
                  key={pt.timestamp}
                  type="button"
                  onClick={() => setSelectedIdx(pointIdx)}
                  className={`flex flex-col items-center rounded-xl px-1 py-1.5 transition-colors ${
                    isSelected ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`tabular-telemetry text-[10px] font-bold sm:text-[11px] ${pt.textClass}`}
                  >
                    {idx === 0 ? "NOW" : pt.label} •{" "}
                    {mode === "ow_aqi"
                      ? `${pt.value}/5`
                      : Math.round(pt.value)}
                  </span>
                  <span className="mt-0.5 text-[11px] font-medium text-on-surface-variant sm:text-xs">
                    {formatHourLabel(pt.timestamp)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
