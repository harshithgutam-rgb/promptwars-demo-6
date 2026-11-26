"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { OPENWEATHER_AQI_SCALE } from "@/lib/air-quality";
import { classifyUsAqi } from "@/lib/us-aqi";
import { classifyCpcbAqi } from "@/lib/cpcb-aqi";
import type { MapMarkerReading } from "@/app/api/map-markers/route";
import { AlertTriangleIcon } from "@/components/Icons";

export type MapAqiStandard = "us_aqi" | "cpcb_india" | "openweather";

export interface CustomMapPin {
  lat: number;
  lon: number;
  label: string;
  loading: boolean;
  cpcbValue: number | null;
  usAqiValue: number | null;
  owAqi: (1 | 2 | 3 | 4 | 5) | null;
}

interface InteractiveGlobalMapProps {
  markers: MapMarkerReading[];
  selectedMarkerId: string | null;
  activeLocationId: string | null;
  standard: MapAqiStandard;
  showWindVectors: boolean;
  isSelectMode: boolean;
  customPin: CustomMapPin | null;
  onSelectMarker: (marker: MapMarkerReading) => void;
  onSelectMapPoint: (lat: number, lon: number) => void;
}

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

function getConfiguredCartoKey(): string | null {
  const raw = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY?.trim();
  if (
    !raw ||
    raw.startsWith("REPLACE_WITH_") ||
    raw.startsWith("your_")
  ) {
    return null;
  }
  return raw;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getMarkerDisplay(
  marker: MapMarkerReading,
  standard: MapAqiStandard
): {
  valueText: string;
  colorHex: string;
  glowRgba: string;
  ariaLabel: string;
} {
  if (standard === "us_aqi") {
    if (marker.usAqi) {
      const cat = classifyUsAqi(marker.usAqi.value);
      return {
        valueText: String(marker.usAqi.value),
        colorHex: cat.accentHex,
        glowRgba: cat.glowRgba,
        ariaLabel: `${marker.name}: US AQI ${marker.usAqi.value} (${cat.label})`,
      };
    }
    return {
      valueText: "--",
      colorHex: "#94a3b8",
      glowRgba: "rgba(148,163,184,0.28)",
      ariaLabel: `${marker.name}: US AQI unavailable`,
    };
  }

  if (standard === "cpcb_india") {
    if (marker.cpcbAqi) {
      const cat = classifyCpcbAqi(marker.cpcbAqi.value);
      return {
        valueText: String(marker.cpcbAqi.value),
        colorHex: cat.accentHex,
        glowRgba: cat.glowRgba,
        ariaLabel: `${marker.name}: India CPCB AQI ${marker.cpcbAqi.value} (${cat.label}), station ${marker.cpcbAqi.stationName}`,
      };
    }
    return {
      valueText: "--",
      colorHex: "#64748b",
      glowRgba: "rgba(100,116,139,0.22)",
      ariaLabel: `${marker.name}: No active India CPCB station within 25 km`,
    };
  }

  if (marker.openWeather) {
    const ow = OPENWEATHER_AQI_SCALE[marker.openWeather.aqi];
    return {
      valueText: `${ow.index}/5`,
      colorHex: ow.accentHex,
      glowRgba: ow.glowRgba,
      ariaLabel: `${marker.name}: OpenWeather AQI ${ow.index} of 5 (${ow.label})`,
    };
  }

  return {
    valueText: "--",
    colorHex: "#94a3b8",
    glowRgba: "rgba(148,163,184,0.28)",
    ariaLabel: `${marker.name}: OpenWeather AQI unavailable`,
  };
}

function normalizeLongitude(lon: number): number {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return Number(wrapped.toFixed(4));
}

function getCustomPinDisplay(
  pin: CustomMapPin,
  standard: MapAqiStandard
): {
  valueText: string;
  colorHex: string;
  glowRgba: string;
  ariaLabel: string;
} {
  if (pin.loading) {
    return {
      valueText: "…",
      colorHex: "#38bdf8",
      glowRgba: "rgba(56,189,248,0.5)",
      ariaLabel: `Loading air quality for ${pin.label}`,
    };
  }
  if (standard === "cpcb_india") {
    if (pin.cpcbValue !== null) {
      const cat = classifyCpcbAqi(pin.cpcbValue);
      return {
        valueText: String(pin.cpcbValue),
        colorHex: cat.accentHex,
        glowRgba: cat.glowRgba,
        ariaLabel: `${pin.label}: India CPCB AQI ${pin.cpcbValue} (${cat.label})`,
      };
    }
    return {
      valueText: "--",
      colorHex: "#94a3b8",
      glowRgba: "rgba(148,163,184,0.35)",
      ariaLabel: `${pin.label}: CPCB station unavailable within 25 km`,
    };
  }
  if (standard === "us_aqi") {
    if (pin.usAqiValue !== null) {
      const cat = classifyUsAqi(pin.usAqiValue);
      return {
        valueText: String(pin.usAqiValue),
        colorHex: cat.accentHex,
        glowRgba: cat.glowRgba,
        ariaLabel: `${pin.label}: US AQI ${pin.usAqiValue} (${cat.label})`,
      };
    }
    return {
      valueText: "--",
      colorHex: "#94a3b8",
      glowRgba: "rgba(148,163,184,0.35)",
      ariaLabel: `${pin.label}: US AQI unavailable`,
    };
  }
  if (pin.owAqi !== null) {
    const ow = OPENWEATHER_AQI_SCALE[pin.owAqi];
    return {
      valueText: `${ow.index}/5`,
      colorHex: ow.accentHex,
      glowRgba: ow.glowRgba,
      ariaLabel: `${pin.label}: OpenWeather AQI ${ow.index} of 5 (${ow.label})`,
    };
  }
  return {
    valueText: "--",
    colorHex: "#94a3b8",
    glowRgba: "rgba(148,163,184,0.35)",
    ariaLabel: `${pin.label}: OpenWeather AQI unavailable`,
  };
}

export default function InteractiveGlobalMap({
  markers,
  selectedMarkerId,
  activeLocationId,
  standard,
  showWindVectors,
  isSelectMode,
  customPin,
  onSelectMarker,
  onSelectMapPoint,
}: InteractiveGlobalMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const customLayerRef = useRef<L.LayerGroup | null>(null);
  const lastCenteredIdRef = useRef<string | null>(null);
  const lastCustomCoordRef = useRef<string | null>(null);

  // Refs for gesture/click disambiguation without recreating the Leaflet map
  const isSelectModeRef = useRef(isSelectMode);
  const onSelectMapPointRef = useRef(onSelectMapPoint);
  const isDraggingOrZoomingRef = useRef(false);
  const lastGestureAtRef = useRef(0);
  const lastMarkerClickAtRef = useRef(0);

  useEffect(() => {
    isSelectModeRef.current = isSelectMode;
    const container = mapRef.current?.getContainer();
    if (container) {
      container.style.cursor = isSelectMode ? "crosshair" : "";
    }
  }, [isSelectMode]);

  useEffect(() => {
    onSelectMapPointRef.current = onSelectMapPoint;
  }, [onSelectMapPoint]);

  const cartoKey = getConfiguredCartoKey();
  const [tileError, setTileError] = useState(false);

  // Initialize Leaflet map once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [24, 15],
      zoom: 2,
      minZoom: 2,
      maxZoom: 14,
      worldCopyJump: true,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    if (cartoKey) {
      // Official CARTO Dark Matter raster tile endpoint with API key
      const tileUrl = `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(
        cartoKey
      )}`;

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: CARTO_ATTRIBUTION,
      });

      tileLayer.on("tileerror", () => {
        setTileError(true);
      });
      tileLayer.on("tileload", () => {
        setTileError(false);
      });

      tileLayer.addTo(map);
    } else {
      // Keep OpenStreetMap & CARTO attribution visible even before key is configured
      map.attributionControl.addAttribution(CARTO_ATTRIBUTION);
    }

    const group = L.layerGroup().addTo(map);
    const customGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;
    customLayerRef.current = customGroup;

    // Track drag/zoom gestures so pan/pinch/zoom never triggers accidental point selection
    const onGestureStart = () => {
      isDraggingOrZoomingRef.current = true;
    };
    const onGestureEnd = () => {
      isDraggingOrZoomingRef.current = false;
      lastGestureAtRef.current = Date.now();
    };
    map.on("dragstart", onGestureStart);
    map.on("zoomstart", onGestureStart);
    map.on("dragend", onGestureEnd);
    map.on("zoomend", onGestureEnd);

    // Intentional click/tap handler (only active in Select Location mode)
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!isSelectModeRef.current) return;
      if (isDraggingOrZoomingRef.current) return;
      const now = Date.now();
      if (now - lastGestureAtRef.current < 240) return;
      if (now - lastMarkerClickAtRef.current < 240) return;

      const lat = Math.max(-90, Math.min(90, Number(e.latlng.lat.toFixed(4))));
      const lon = normalizeLongitude(e.latlng.lng);
      onSelectMapPointRef.current(lat, lon);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      customLayerRef.current = null;
    };
  }, [cartoKey]);

  // Render AQI-colored markers + optional verified OpenWeather surface wind arrows
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    for (const marker of markers) {
      const display = getMarkerDisplay(marker, standard);
      const isSelected = marker.id === selectedMarkerId;
      const isActive = marker.id === activeLocationId;

      const windDeg = marker.openWeather?.weather?.windDeg ?? null;
      const windSpeedMs = marker.openWeather?.weather?.windSpeedMs ?? null;
      const hasWind =
        showWindVectors &&
        windDeg !== null &&
        windSpeedMs !== null &&
        Number.isFinite(windDeg);

      const windArrowHtml = hasWind
        ? `<div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%) rotate(${Math.round(
            windDeg
          )}deg);color:#8ed5ff;font-size:11px;line-height:1;filter:drop-shadow(0 0 4px rgba(56,189,248,0.85));pointer-events:none;" title="Surface wind bearing ${Math.round(
            windDeg
          )}°">▲</div>`
        : "";

      const ringCss = isSelected
        ? `box-shadow:0 0 0 3px rgba(255,255,255,0.85), 0 0 22px ${display.glowRgba}, 0 6px 16px rgba(0,0,0,0.65);transform:scale(1.12);`
        : isActive
          ? `box-shadow:0 0 0 2px rgba(142,213,255,0.8), 0 0 18px ${display.glowRgba}, 0 4px 12px rgba(0,0,0,0.6);`
          : `box-shadow:0 0 14px ${display.glowRgba}, 0 4px 12px rgba(0,0,0,0.6);`;

      const html = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          ${windArrowHtml}
          <div style="
            min-width:40px;
            height:30px;
            padding:0 8px;
            border-radius:9999px;
            background:linear-gradient(155deg, rgba(16,24,42,0.92), rgba(7,12,24,0.96));
            border:2px solid ${display.colorHex};
            color:#ffffff;
            font-family:'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
            font-size:12px;
            font-weight:700;
            display:flex;
            align-items:center;
            justify-content:center;
            white-space:nowrap;
            ${ringCss}
          ">${escapeHtml(display.valueText)}</div>
          <div style="
            margin-top:3px;
            padding:1px 6px;
            border-radius:9999px;
            background:rgba(6,10,20,0.84);
            border:1px solid rgba(255,255,255,0.16);
            color:#e2e8f0;
            font-size:10px;
            font-weight:600;
            white-space:nowrap;
            max-width:110px;
            overflow:hidden;
            text-overflow:ellipsis;
          ">${escapeHtml(marker.name)}</div>
        </div>
      `;

      const icon = L.divIcon({
        className: "airwise-marker-icon",
        html,
        iconSize: [72, 48],
        iconAnchor: [36, 18],
      });

      const leafletMarker = L.marker([marker.lat, marker.lon], {
        icon,
        keyboard: true,
        title: display.ariaLabel,
        alt: display.ariaLabel,
        zIndexOffset: isSelected ? 600 : isActive ? 400 : 100,
      });

      leafletMarker.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        lastMarkerClickAtRef.current = Date.now();
        onSelectMarker(marker);
      });

      leafletMarker.addTo(group);
    }
  }, [
    markers,
    selectedMarkerId,
    activeLocationId,
    standard,
    showWindVectors,
    onSelectMarker,
  ]);

  // Render distinctive custom pin whenever user selects an arbitrary map point
  useEffect(() => {
    const map = mapRef.current;
    const customGroup = customLayerRef.current;
    if (!map || !customGroup) return;

    customGroup.clearLayers();
    if (!customPin) {
      lastCustomCoordRef.current = null;
      return;
    }

    const display = getCustomPinDisplay(customPin, standard);
    const html = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="
          min-width:46px;
          height:34px;
          padding:0 10px;
          border-radius:9999px;
          background:linear-gradient(145deg, rgba(14,165,233,0.95), rgba(15,23,42,0.96));
          border:2.5px solid #ffffff;
          color:#ffffff;
          font-family:'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
          font-size:12px;
          font-weight:800;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:4px;
          white-space:nowrap;
          box-shadow:0 0 0 4px ${display.glowRgba}, 0 0 24px rgba(56,189,248,0.65), 0 8px 18px rgba(0,0,0,0.7);
        ">
          <span style="width:7px;height:7px;border-radius:9999px;background:${display.colorHex};display:inline-block;"></span>
          <span>${escapeHtml(display.valueText)}</span>
        </div>
        <div style="
          width:0;
          height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid #ffffff;
          margin-top:-1px;
        "></div>
        <div style="
          margin-top:2px;
          padding:2px 8px;
          border-radius:9999px;
          background:rgba(6,10,20,0.92);
          border:1px solid rgba(142,213,255,0.55);
          color:#e0f2fe;
          font-size:10px;
          font-weight:700;
          white-space:nowrap;
          max-width:140px;
          overflow:hidden;
          text-overflow:ellipsis;
        ">${escapeHtml(customPin.label)}</div>
      </div>
    `;

    const icon = L.divIcon({
      className: "airwise-custom-pin-icon",
      html,
      iconSize: [120, 62],
      iconAnchor: [60, 42],
    });

    const pinMarker = L.marker([customPin.lat, customPin.lon], {
      icon,
      keyboard: true,
      title: display.ariaLabel,
      alt: display.ariaLabel,
      zIndexOffset: 900,
    });
    pinMarker.on("click", (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      lastMarkerClickAtRef.current = Date.now();
    });
    pinMarker.addTo(customGroup);

    const coordKey = `${customPin.lat.toFixed(4)},${customPin.lon.toFixed(4)}`;
    if (lastCustomCoordRef.current !== coordKey) {
      lastCustomCoordRef.current = coordKey;
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const targetZoom = Math.max(map.getZoom(), 6);
      if (prefersReduced) {
        map.setView([customPin.lat, customPin.lon], targetZoom, {
          animate: false,
        });
      } else {
        map.flyTo([customPin.lat, customPin.lon], targetZoom, {
          duration: 0.65,
        });
      }
    }
  }, [customPin, standard]);

  // Smoothly focus the map whenever selectedMarkerId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedMarkerId) return;
    if (lastCenteredIdRef.current === selectedMarkerId) return;

    const target = markers.find((m) => m.id === selectedMarkerId);
    if (!target) return;

    lastCenteredIdRef.current = selectedMarkerId;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const targetZoom = Math.max(map.getZoom(), 4);
    if (prefersReduced) {
      map.setView([target.lat, target.lon], targetZoom, { animate: false });
    } else {
      map.flyTo([target.lat, target.lon], targetZoom, { duration: 0.75 });
    }
  }, [selectedMarkerId, markers]);

  return (
    <div className="relative w-full">
      {/* Helpful Configuration Banner when CARTO Basemap Key is missing or rejected */}
      {!cartoKey && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2.5 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100"
        >
          <AlertTriangleIcon
            size={16}
            className="mt-0.5 shrink-0 text-amber-300"
          />
          <div>
            <p className="font-semibold text-amber-200">
              CARTO Dark Matter Basemap Key Required
            </p>
            <p className="mt-0.5 text-on-surface-variant">
              Add a free CARTO Basemaps key to{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white">
                NEXT_PUBLIC_CARTO_BASEMAP_KEY
              </code>{" "}
              in{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white">
                .env.local
              </code>{" "}
              (from{" "}
              <a
                href="https://carto.com/basemaps/apikey/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-2"
              >
                carto.com/basemaps/apikey
              </a>
              ) and restart Next.js to load Dark Matter tiles without watermarks.
              Live AQI markers remain interactive below.
            </p>
          </div>
        </div>
      )}

      {cartoKey && tileError && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2.5 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200"
        >
          <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
          <span>
            CARTO Dark Matter map tiles failed to load. Verify your{" "}
            <code className="rounded bg-white/10 px-1 font-mono text-white">
              NEXT_PUBLIC_CARTO_BASEMAP_KEY
            </code>{" "}
            value in <code className="font-mono text-white">.env.local</code>{" "}
            and check network connectivity.
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className="airwise-leaflet-map h-[340px] w-full rounded-2xl border border-white/15 sm:h-[420px] lg:h-[460px]"
        aria-label="Interactive worldwide air quality map"
      />
    </div>
  );
}
