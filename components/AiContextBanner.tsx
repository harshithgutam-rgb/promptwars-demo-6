"use client";

import {
  formatLocationLabel,
  formatTimestampReadable,
  OPENWEATHER_AQI_SCALE,
} from "@/lib/air-quality";
import { classifyUsAqi } from "@/lib/us-aqi";
import { classifyCpcbAqi } from "@/lib/cpcb-aqi";
import { useLocationContext } from "@/components/LocationContext";
import { LocationPinIcon, RefreshIcon, SatelliteIcon } from "@/components/Icons";

export function AiContextBanner() {
  const {
    activeLocation,
    openLocationModal,
    airQualityStatus,
    airQualityData,
    refreshAirQuality,
  } = useLocationContext();

  const aqiLevel = airQualityData
    ? OPENWEATHER_AQI_SCALE[airQualityData.current.aqi]
    : null;
  const cpcbAqi = airQualityData?.cpcbAqi ?? null;
  const cpcbMeta = cpcbAqi ? classifyCpcbAqi(cpcbAqi.value) : null;
  const usAqi = airQualityData?.usAqi ?? null;
  const usMeta = usAqi ? classifyUsAqi(usAqi.value) : null;

  return (
    <section
      aria-label="Current location and air quality context"
      className="liquid-glass rounded-2xl p-4 sm:p-5"
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="liquid-pill tabular-telemetry inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider text-primary uppercase">
              <SatelliteIcon size={13} />
              <span>Grounded Context</span>
            </span>

            <span className="text-base font-bold text-white sm:text-lg">
              {activeLocation
                ? formatLocationLabel(activeLocation)
                : "No location selected"}
            </span>

            {cpcbAqi && cpcbMeta && (
              <span
                className={`liquid-pill tabular-telemetry inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold ${cpcbMeta.badgeBorderClass} ${cpcbMeta.textClass}`}
                title={`India CPCB Station: ${cpcbAqi.stationName} (${cpcbAqi.stationDistanceKm.toFixed(1)} km)`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cpcbMeta.dotClass}`} />
                <span>
                  India CPCB {cpcbAqi.value} ({cpcbMeta.shortLabel})
                </span>
              </span>
            )}

            {usAqi && usMeta && (
              <span
                className={`liquid-pill tabular-telemetry inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold ${usMeta.badgeBorderClass} ${usMeta.textClass}`}
                title="US AQI — Open-Meteo modeled estimate (0–500)"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${usMeta.dotClass}`} />
                <span>
                  US AQI {usAqi.value} ({usMeta.shortLabel})
                </span>
              </span>
            )}

            {aqiLevel ? (
              <span
                className={`liquid-pill tabular-telemetry inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold ${aqiLevel.badgeBorderClass} ${aqiLevel.textClass}`}
                title="OpenWeather 1–5 SILAM modeled index"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${aqiLevel.dotClass}`} />
                <span>
                  OW {aqiLevel.index}/5 ({aqiLevel.label})
                </span>
              </span>
            ) : !usAqi && !cpcbAqi ? (
              <span className="liquid-pill tabular-telemetry rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-on-surface-variant">
                {airQualityStatus === "loading" ? "Loading AQI…" : "AQI Unavailable"}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
            <span className="tabular-telemetry">
              PM2.5:{" "}
              <strong className="text-white">
                {airQualityData?.current.components.pm2_5 !== null &&
                airQualityData?.current.components.pm2_5 !== undefined
                  ? `${airQualityData.current.components.pm2_5.toFixed(1)} µg/m³`
                  : "--"}
              </strong>
            </span>
            <span className="tabular-telemetry">
              PM10:{" "}
              <strong className="text-white">
                {airQualityData?.current.components.pm10 !== null &&
                airQualityData?.current.components.pm10 !== undefined
                  ? `${airQualityData.current.components.pm10.toFixed(1)} µg/m³`
                  : "--"}
              </strong>
            </span>
            <span className="tabular-telemetry">
              O₃:{" "}
              <strong className="text-white">
                {airQualityData?.current.components.o3 !== null &&
                airQualityData?.current.components.o3 !== undefined
                  ? `${airQualityData.current.components.o3.toFixed(1)} µg/m³`
                  : "--"}
              </strong>
            </span>
            <span className="tabular-telemetry">
              NO₂:{" "}
              <strong className="text-white">
                {airQualityData?.current.components.no2 !== null &&
                airQualityData?.current.components.no2 !== undefined
                  ? `${airQualityData.current.components.no2.toFixed(1)} µg/m³`
                  : "--"}
              </strong>
            </span>
            {cpcbAqi ? (
              <span className="text-secondary">
                • CPCB observed {formatTimestampReadable(cpcbAqi.observedAt)} (
                {cpcbAqi.stationDistanceKm.toFixed(1)} km)
              </span>
            ) : airQualityData?.observedAt ? (
              <span className="text-primary">
                • OW modeled {formatTimestampReadable(airQualityData.observedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openLocationModal}
            className="liquid-btn inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white"
          >
            <LocationPinIcon size={15} className="text-primary" />
            <span>{activeLocation ? "Switch City" : "Select City"}</span>
          </button>
          <button
            type="button"
            onClick={refreshAirQuality}
            disabled={!activeLocation || airQualityStatus === "loading"}
            className="liquid-btn inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-white disabled:opacity-45"
          >
            <RefreshIcon
              size={14}
              className={airQualityStatus === "loading" ? "animate-spin" : ""}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </section>
  );
}
