"use client";

import {
  formatCoordinates,
  formatLocationLabel,
  formatRelativeTime,
  formatTimestampReadable,
} from "@/lib/air-quality";
import { useLocationContext } from "@/components/LocationContext";
import { AqiGaugeCard } from "@/components/AqiGaugeCard";
import { PollutantGrid } from "@/components/PollutantGrid";
import { TrajectoryChart } from "@/components/TrajectoryChart";
import { UpcomingModulesSection } from "@/components/UpcomingModulesSection";
import { LocationClusterBar } from "@/components/LocationClusterBar";
import {
  AlertTriangleIcon,
  CrosshairIcon,
  LocationPinIcon,
  RefreshIcon,
  SatelliteIcon,
} from "@/components/Icons";

export function DashboardView() {
  const {
    activeLocation,
    detectedLocation,
    openLocationModal,
    requestBrowserLocation,
    geolocationStatus,
    airQualityStatus,
    airQualityData,
    airQualityError,
    refreshAirQuality,
  } = useLocationContext();

  const isLive = airQualityStatus === "ready" && airQualityData !== null;

  return (
    <div className="flex w-full flex-col">
      {/* Live Status & Telemetry Liquid Glass Bar (Preserved Stitch Header Bar) */}
      <section
        aria-label="Active location and provider metadata"
        className="mb-5 sm:mb-6"
      >
        <div className="liquid-glass flex flex-col justify-between gap-4 rounded-2xl p-4 sm:p-5 xl:flex-row xl:items-center">
          {/* Location & Dual-Provider Identity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`liquid-pill tabular-telemetry inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase ${
                  isLive
                    ? "text-secondary"
                    : airQualityStatus === "loading"
                      ? "text-primary"
                      : "text-amber-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isLive
                      ? "bg-secondary shadow-[0_0_10px_rgba(78,222,163,1)] animate-pulse"
                      : airQualityStatus === "loading"
                        ? "bg-primary animate-pulse"
                        : "bg-amber-400"
                  }`}
                />
                {isLive
                  ? "Live Telemetry"
                  : airQualityStatus === "loading"
                    ? "Syncing Telemetry"
                    : airQualityStatus === "missing_key"
                      ? "API Key Needed"
                      : airQualityStatus === "error"
                        ? "Telemetry Error"
                        : "Select Location"}
              </span>

              <span className="text-sm text-white/35">/</span>

              <h1 className="text-lg font-bold tracking-tight text-white drop-shadow-sm sm:text-xl">
                {activeLocation
                  ? formatLocationLabel(activeLocation)
                  : "No Location Selected"}
              </h1>

              {activeLocation && (
                <span className="liquid-pill tabular-telemetry rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
                  {activeLocation.source === "geolocation"
                    ? "GPS Detected"
                    : "Manual City"}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-on-surface-variant sm:text-[13px]">
              <span className="inline-flex items-center gap-1.5">
                <SatelliteIcon size={15} className="text-tertiary" />
                {airQualityData?.cpcbAqi ? (
                  <span>
                    India AQI (CPCB):{" "}
                    <strong className="text-white">
                      {airQualityData.cpcbAqi.stationName}
                    </strong>{" "}
                    <span className="tabular-telemetry text-secondary">
                      ({airQualityData.cpcbAqi.stationDistanceKm.toFixed(1)} km)
                    </span>
                  </span>
                ) : (
                  <span>
                    US AQI (0–500):{" "}
                    <strong className="text-white">Open-Meteo CAMS</strong>
                  </span>
                )}
              </span>

              <span className="h-1 w-1 rounded-full bg-white/25" />

              <span className="tabular-telemetry text-on-surface/90">
                Pollutants (µg/m³) &amp; 1–5:{" "}
                <strong className="text-white">OpenWeather (Modeled)</strong>
              </span>

              {activeLocation && (
                <>
                  <span className="hidden h-1 w-1 rounded-full bg-white/25 sm:inline-block" />
                  <span className="tabular-telemetry hidden text-on-surface-variant sm:inline">
                    {formatCoordinates(activeLocation.lat, activeLocation.lon)}
                  </span>
                </>
              )}

              {airQualityData?.cpcbAqi ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-white/25" />
                  <span className="font-medium text-secondary">
                    CPCB observed{" "}
                    {formatTimestampReadable(airQualityData.cpcbAqi.observedAt)}
                  </span>
                </>
              ) : airQualityData?.usAqi?.validAt ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-white/25" />
                  <span className="font-medium text-primary">
                    US AQI valid{" "}
                    {formatTimestampReadable(airQualityData.usAqi.validAt)}
                  </span>
                </>
              ) : null}

              {airQualityData?.observedAt && (
                <>
                  <span className="h-1 w-1 rounded-full bg-white/25" />
                  <span className="text-on-surface-variant">
                    OW modeled{" "}
                    {formatRelativeTime(airQualityData.observedAt)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Pill Capsule Group */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openLocationModal}
              className="liquid-btn inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white active:scale-95"
            >
              <LocationPinIcon size={16} className="text-primary" />
              <span>Switch Location</span>
            </button>

            <button
              type="button"
              onClick={requestBrowserLocation}
              disabled={geolocationStatus === "requesting"}
              className="liquid-btn inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white active:scale-95 disabled:opacity-60"
            >
              <CrosshairIcon
                size={16}
                className={`text-tertiary ${
                  geolocationStatus === "requesting" ? "animate-spin" : ""
                }`}
              />
              <span>
                {geolocationStatus === "requesting"
                  ? "Locating…"
                  : detectedLocation
                    ? "Refresh GPS"
                    : "Use My Location"}
              </span>
            </button>

            <button
              type="button"
              onClick={refreshAirQuality}
              disabled={!activeLocation || airQualityStatus === "loading"}
              className="liquid-cta inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-primary-container active:scale-95 disabled:opacity-50"
            >
              <RefreshIcon
                size={16}
                className={airQualityStatus === "loading" ? "animate-spin" : ""}
              />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </section>

      {/* Honest Missing API Key Banner */}
      {airQualityStatus === "missing_key" && (
        <section
          role="alert"
          className="liquid-glass mb-6 rounded-2xl border border-amber-400/35 p-4 sm:p-5"
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3">
              <div className="liquid-pill mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/35 text-amber-300">
                <AlertTriangleIcon size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-amber-200 sm:text-base">
                  OpenWeather API Key Required for Live Readings
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant sm:text-[13px]">
                  Add{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white">
                    OPENWEATHER_API_KEY
                  </code>{" "}
                  to{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white">
                    .env.local
                  </code>{" "}
                  and restart the Next.js server to stream real-time air
                  pollution data and 24-hour forecasts.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshAirQuality}
              className="liquid-btn inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white"
            >
              <RefreshIcon size={15} />
              <span>Retry Connection</span>
            </button>
          </div>
        </section>
      )}

      {/* Honest Upstream Error Banner */}
      {airQualityStatus === "error" && airQualityError && (
        <section
          role="alert"
          className="liquid-glass mb-6 rounded-2xl border border-rose-400/35 p-4 sm:p-5"
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3">
              <div className="liquid-pill mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-400/35 text-rose-300">
                <AlertTriangleIcon size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-rose-200 sm:text-base">
                  Unable to Load Live Air Quality Data
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant sm:text-[13px]">
                  {airQualityError}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openLocationModal}
                className="liquid-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white"
              >
                <LocationPinIcon size={15} />
                <span>Change City</span>
              </button>
              <button
                type="button"
                onClick={refreshAirQuality}
                className="liquid-cta inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-on-primary-container"
              >
                <RefreshIcon size={15} />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Spatial Bento Grid: Left Spatial Dial (5 cols) + Right Vital Pollutants (7 cols) */}
      <div className="mb-6 grid w-full grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <AqiGaugeCard
          status={airQualityStatus}
          data={airQualityData}
          onSelectLocation={openLocationModal}
        />
        <PollutantGrid status={airQualityStatus} data={airQualityData} />
      </div>

      {/* 24-Hour Atmospheric Trajectory (Open-Meteo US AQI + OpenWeather Forecast) */}
      <TrajectoryChart
        status={airQualityStatus}
        forecast={airQualityData?.forecast24h ?? []}
        usAqiForecast={airQualityData?.usAqi?.hourlyForecast24h ?? []}
        providerName={airQualityData?.provider}
      />

      {/* Gemini AI Atmospheric Intelligence Modules */}
      <UpcomingModulesSection />

      {/* Bottom Horizontal Location Switcher Strip */}
      <LocationClusterBar />

      {/* Compact Collapsible Data Sources & Methodology Transparency Disclosure */}
      <details className="liquid-glass mt-5 rounded-2xl p-4 text-xs text-on-surface-variant">
        <summary className="cursor-pointer list-none font-semibold text-white">
          <span className="inline-flex items-center gap-2">
            <span className="tabular-telemetry rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
              Methodology
            </span>
            <span>
              How AirWise AI sources readings, separates AQI standards, and
              grounds Gemini AI
            </span>
          </span>
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-white/10 pt-3 leading-relaxed md:grid-cols-3">
          <div>
            <p className="font-semibold text-white">
              US AQI (0–500+) vs. OpenWeather (1–5) vs. CPCB
            </p>
            <p className="mt-1">
              Primary numerical US AQI is an hourly modeled estimate from{" "}
              <strong className="text-white">Open-Meteo (Copernicus CAMS)</strong>{" "}
              using EPA averaging windows. Pollutant concentrations (µg/m³) and
              the 1–5 index come independently from{" "}
              <strong className="text-white">OpenWeather</strong>. US AQI is
              distinct from India&apos;s CPCB National AQI; readings are never
              converted between standards.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">
              Server-Grounded Gemini AI &amp; Health Safety
            </p>
            <p className="mt-1">
              Every Gemini Advisor, Daily Routine, Indoor Air Rescue, and
              What-If explanation verifies live readings server-side before
              responding. Guidance is informational lifestyle advice — not a
              medical diagnosis — and outdoor readings do not measure indoor air
              without physical indoor sensors.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">
              Deterministic What-If CO₂e Estimates
            </p>
            <p className="mt-1">
              Transport emission comparisons are calculated deterministically in
              TypeScript using published UK DESNZ / DEFRA 2024 passenger-km
              factors, not AI-invented numbers. Individual trip changes lower
              personal emissions estimates but do not measurably alter city-wide
              AQI alone.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
