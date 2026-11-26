"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  formatCoordinates,
  formatLocationLabel,
  formatTimestampReadable,
  formatWindDirection,
  OPENWEATHER_AQI_SCALE,
  WORLDWIDE_QUICK_CITIES,
  type AirQualityData,
  type GeocodeApiResponse,
  type GeocodeResult,
  type LocationSource,
} from "@/lib/air-quality";
import {
  classifyUsAqi,
  US_AQI_LEGEND,
  US_VS_CPCB_DISCLOSURE,
} from "@/lib/us-aqi";
import { classifyCpcbAqi, CPCB_AQI_LEGEND } from "@/lib/cpcb-aqi";
import type {
  MapMarkerReading,
  MapMarkersApiResponse,
} from "@/app/api/map-markers/route";
import type {
  CustomMapPin,
  MapAqiStandard,
} from "@/components/InteractiveGlobalMap";
import { useLocationContext } from "@/components/LocationContext";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CloseIcon,
  CrosshairIcon,
  GlobeIcon,
  LocationPinIcon,
  RefreshIcon,
  SearchIcon,
  SparklesIcon,
  WindIcon,
} from "@/components/Icons";

const InteractiveGlobalMap = dynamic(
  () => import("@/components/InteractiveGlobalMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[340px] w-full items-center justify-center rounded-2xl border border-white/15 bg-[#070c18]/90 sm:h-[420px] lg:h-[460px]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-pulse rounded-full bg-primary/30" />
          <p className="mt-2 text-xs text-on-surface-variant">
            Initializing interactive map tiles…
          </p>
        </div>
      </div>
    ),
  }
);

interface TrackedMapLocation {
  id: string;
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
  source: LocationSource;
}

interface CustomMapSelection {
  id: string;
  lat: number;
  lon: number;
  name: string;
  region?: string;
  country?: string;
  reverseGeocoded: boolean;
  loading: boolean;
  error: string | null;
  data: AirQualityData | null;
}

export function GlobalMapView() {
  const router = useRouter();
  const {
    activeLocation,
    detectedLocation,
    savedLocations,
    selectLocation,
    removeSavedLocation,
    requestBrowserLocation,
    geolocationStatus,
    geolocationMessage,
  } = useLocationContext();

  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interactive Map State
  const [standard, setStandard] = useState<MapAqiStandard>("us_aqi");
  const [showWindVectors, setShowWindVectors] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showCoordForm, setShowCoordForm] = useState(false);
  const [coordLatInput, setCoordLatInput] = useState("");
  const [coordLonInput, setCoordLonInput] = useState("");
  const [coordFormError, setCoordFormError] = useState<string | null>(null);
  const [customSelection, setCustomSelection] =
    useState<CustomMapSelection | null>(null);

  const customAbortRef = useRef<AbortController | null>(null);
  const customSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      customAbortRef.current?.abort();
    };
  }, []);

  const [markers, setMarkers] = useState<MapMarkerReading[]>([]);
  const [mapStatus, setMapStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("loading");
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [mapRefreshNonce, setMapRefreshNonce] = useState(0);

  // Deduplicated list of up to 10 real worldwide locations to display on the map
  const trackedLocations = useMemo<TrackedMapLocation[]>(() => {
    const ordered: TrackedMapLocation[] = [];
    const pushUnique = (loc: TrackedMapLocation) => {
      const exists = ordered.some(
        (existing) =>
          existing.id === loc.id ||
          (Math.abs(existing.lat - loc.lat) < 0.05 &&
            Math.abs(existing.lon - loc.lon) < 0.05)
      );
      if (!exists && ordered.length < 10) {
        ordered.push(loc);
      }
    };

    if (activeLocation) pushUnique(activeLocation);
    if (detectedLocation) pushUnique(detectedLocation);
    for (const saved of savedLocations) pushUnique(saved);
    for (const preset of WORLDWIDE_QUICK_CITIES) pushUnique(preset);
    return ordered;
  }, [activeLocation, detectedLocation, savedLocations]);

  const trackedKey = useMemo(
    () =>
      trackedLocations
        .map((l) => `${l.id}:${l.lat.toFixed(2)},${l.lon.toFixed(2)}`)
        .join("|"),
    [trackedLocations]
  );

  const trackedLocationsRef = useRef(trackedLocations);
  useEffect(() => {
    trackedLocationsRef.current = trackedLocations;
  }, [trackedLocations]);

  const activeLocationIdRef = useRef(activeLocation?.id ?? null);
  useEffect(() => {
    activeLocationIdRef.current = activeLocation?.id ?? null;
  }, [activeLocation?.id]);

  // Batched, quota-safe marker fetch (runs ONLY when tracked location set changes or user clicks Refresh — never on pan/zoom or selecting an already-pinned city)
  useEffect(() => {
    const locationsToFetch = trackedLocationsRef.current;
    if (locationsToFetch.length === 0) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMapStatus("loading");
      setMapError(null);
      try {
        const res = await fetch("/api/map-markers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            locations: locationsToFetch.map((l) => ({
              id: l.id,
              name: l.name,
              region: l.region,
              country: l.country,
              lat: l.lat,
              lon: l.lon,
            })),
          }),
        });
        if (!res.ok) {
          setMapError(`Unable to load live map readings (HTTP ${res.status}).`);
          setMapStatus("error");
          return;
        }
        const data = (await res.json()) as MapMarkersApiResponse;
        const list = Array.isArray(data.markers) ? data.markers : [];
        setMarkers(list);
        setMapStatus("ready");
        setSelectedMarkerId((prev) => {
          if (prev && list.some((m) => m.id === prev)) return prev;
          const activeId = activeLocationIdRef.current;
          if (activeId && list.some((m) => m.id === activeId)) {
            return activeId;
          }
          return list[0]?.id ?? null;
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setMapError("Network error while loading map marker readings.");
        setMapStatus("error");
      }
    }, 50);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trackedKey, mapRefreshNonce]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setSearchStatus("idle");
      setResults([]);
      setErrorMsg(null);
      setProvider(null);
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchStatus("loading");
      setErrorMsg(null);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const payload: unknown = await res.json();
        if (!res.ok) {
          setErrorMsg(
            typeof (payload as { error?: unknown })?.error === "string"
              ? (payload as { error: string }).error
              : "Search request failed."
          );
          setResults([]);
          setSearchStatus("error");
          return;
        }
        const data = payload as GeocodeApiResponse;
        setResults(Array.isArray(data.results) ? data.results : []);
        setProvider(data.provider ?? null);
        setSearchStatus("ready");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorMsg("Unable to reach worldwide city search.");
        setResults([]);
        setSearchStatus("error");
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleSelectOnMap = useCallback(
    (loc: TrackedMapLocation) => {
      customAbortRef.current?.abort();
      setCustomSelection(null);
      selectLocation(loc);
      setSelectedMarkerId(loc.id);
    },
    [selectLocation]
  );

  const handleSelectMarker = useCallback((marker: MapMarkerReading) => {
    customAbortRef.current?.abort();
    setCustomSelection(null);
    setSelectedMarkerId(marker.id);
  }, []);

  // Intentional arbitrary map point selection (click/tap in Select Mode or keyboard coordinate entry)
  const handleSelectMapPoint = useCallback(async (lat: number, lon: number) => {
    customAbortRef.current?.abort();
    const controller = new AbortController();
    customAbortRef.current = controller;
    const seq = ++customSeqRef.current;

    const coordLabel = formatCoordinates(lat, lon);
    const pointId = `map-${lat.toFixed(4)}-${lon.toFixed(4)}`;

    setCustomSelection({
      id: pointId,
      lat,
      lon,
      name: coordLabel,
      reverseGeocoded: false,
      loading: true,
      error: null,
      data: null,
    });

    const params = new URLSearchParams({
      lat: lat.toFixed(4),
      lon: lon.toFixed(4),
    });

    // Run reverse geocoding and server-side AQI fetch in parallel so reverse-geocoding
    // failures never block air-quality retrieval.
    const geoPromise = fetch(`/api/geocode?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as GeocodeApiResponse;
      })
      .catch(() => null);

    const aqiPromise = fetch(`/api/air-quality?${params.toString()}`, {
      signal: controller.signal,
    }).then(async (res) => {
      const payload = (await res.json()) as AirQualityData & { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : `Air quality lookup failed (HTTP ${res.status}).`
        );
      }
      return payload as AirQualityData;
    });

    const [geoRes, aqiSettled] = await Promise.all([
      geoPromise,
      aqiPromise.then(
        (data) => ({ ok: true as const, data }),
        (err: unknown) => ({ ok: false as const, err })
      ),
    ]);

    // Ignore outdated responses if the user clicked a newer point
    if (controller.signal.aborted || seq !== customSeqRef.current) {
      return;
    }

    const firstGeo =
      geoRes &&
      geoRes.provider !== "Coordinates Fallback" &&
      Array.isArray(geoRes.results) &&
      geoRes.results[0]
        ? geoRes.results[0]
        : null;

    if (!aqiSettled.ok) {
      const errObj = aqiSettled.err;
      if (errObj instanceof DOMException && errObj.name === "AbortError") {
        return;
      }
      setCustomSelection({
        id: firstGeo?.id ?? pointId,
        lat,
        lon,
        name: firstGeo?.name ?? coordLabel,
        region: firstGeo?.region,
        country: firstGeo?.country,
        reverseGeocoded: Boolean(firstGeo),
        loading: false,
        error:
          errObj instanceof Error
            ? errObj.message
            : "Unable to load live air quality for these coordinates.",
        data: null,
      });
      return;
    }

    setCustomSelection({
      id: firstGeo?.id ?? pointId,
      lat,
      lon,
      name: firstGeo?.name ?? coordLabel,
      region: firstGeo?.region,
      country: firstGeo?.country,
      reverseGeocoded: Boolean(firstGeo),
      loading: false,
      error: null,
      data: aqiSettled.data,
    });
  }, []);

  const handleCoordFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const lat = Number(coordLatInput.trim());
      const lon = Number(coordLonInput.trim());
      if (
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        !Number.isFinite(lon) ||
        lon < -180 ||
        lon > 180
      ) {
        setCoordFormError(
          "Enter a valid latitude (-90 to 90) and longitude (-180 to 180)."
        );
        return;
      }
      setCoordFormError(null);
      void handleSelectMapPoint(Number(lat.toFixed(4)), Number(lon.toFixed(4)));
    },
    [coordLatInput, coordLonInput, handleSelectMapPoint]
  );

  const handleSyncAndNavigate = useCallback(
    (
      loc: {
        id: string;
        name: string;
        region?: string;
        country?: string;
        lat: number;
        lon: number;
      },
      destination: "/" | "/gemini-ai"
    ) => {
      selectLocation({
        id: loc.id,
        name: loc.name,
        region: loc.region,
        country: loc.country,
        lat: loc.lat,
        lon: loc.lon,
        source: "search",
      });
      router.push(destination);
    },
    [selectLocation, router]
  );

  const customPin = useMemo<CustomMapPin | null>(() => {
    if (!customSelection) return null;
    return {
      lat: customSelection.lat,
      lon: customSelection.lon,
      label: customSelection.name,
      loading: customSelection.loading,
      cpcbValue: customSelection.data?.cpcbAqi?.value ?? null,
      usAqiValue: customSelection.data?.usAqi?.value ?? null,
      owAqi: customSelection.data?.current.aqi ?? null,
    };
  }, [customSelection]);

  const selectedMarker = useMemo(
    () =>
      markers.find((m) => m.id === selectedMarkerId) ?? markers[0] ?? null,
    [markers, selectedMarkerId]
  );

  const selectedUsCategory = selectedMarker?.usAqi
    ? classifyUsAqi(selectedMarker.usAqi.value)
    : null;
  const selectedCpcbCategory = selectedMarker?.cpcbAqi
    ? classifyCpcbAqi(selectedMarker.cpcbAqi.value)
    : null;
  const selectedOwMeta = selectedMarker?.openWeather
    ? OPENWEATHER_AQI_SCALE[selectedMarker.openWeather.aqi]
    : null;

  const customCpcbCat = customSelection?.data?.cpcbAqi
    ? classifyCpcbAqi(customSelection.data.cpcbAqi.value)
    : null;
  const customRegionalCat = customSelection?.data?.cpcbRegionalReference
    ? classifyCpcbAqi(customSelection.data.cpcbRegionalReference.value)
    : null;
  const customUsCat = customSelection?.data?.usAqi
    ? classifyUsAqi(customSelection.data.usAqi.value)
    : null;
  const customOwMeta = customSelection?.data
    ? OPENWEATHER_AQI_SCALE[customSelection.data.current.aqi]
    : null;

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header & Worldwide Search Panel */}
      <section className="liquid-glass rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="liquid-pill flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/35 text-primary">
              <GlobeIcon size={22} />
            </div>
            <div>
              <span className="tabular-telemetry text-[11px] font-bold tracking-wider text-primary uppercase">
                Worldwide Geocoding &amp; Interactive Map
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Global Map &amp; City Search
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={requestBrowserLocation}
            disabled={geolocationStatus === "requesting"}
            className="liquid-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-on-primary-container disabled:opacity-60"
          >
            <CrosshairIcon
              size={16}
              className={geolocationStatus === "requesting" ? "animate-spin" : ""}
            />
            <span>
              {geolocationStatus === "requesting"
                ? "Detecting GPS…"
                : "Use My Location"}
            </span>
          </button>
        </div>

        {geolocationMessage && (
          <p className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2 text-xs text-primary-fixed">
            {geolocationMessage}
          </p>
        )}

        {/* Worldwide City Search Input */}
        <div className="relative mt-5">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search any city worldwide (e.g., Mumbai, Bengaluru, Seoul, Madrid, Nairobi)…"
            className="liquid-input w-full rounded-2xl py-3.5 pr-4 pl-11 text-sm text-white placeholder:text-on-surface-variant/70"
          />
        </div>

        {searchStatus === "loading" && (
          <p className="mt-3 text-xs text-on-surface-variant">
            Searching worldwide locations…
          </p>
        )}
        {searchStatus === "error" && errorMsg && (
          <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
            {errorMsg}
          </p>
        )}
        {searchStatus === "ready" && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/15 bg-[#0a1020]/80">
            {results.length === 0 ? (
              <p className="px-4 py-3 text-xs text-on-surface-variant">
                No matching cities found for &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <ul className="divide-y divide-white/10">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectOnMap({ ...item, source: "search" });
                        setQuery("");
                        setSearchStatus("idle");
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/10"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.name}
                          {item.region ? `, ${item.region}` : ""}
                          {item.country ? `, ${item.country}` : ""}
                        </p>
                        <p className="tabular-telemetry text-[11px] text-on-surface-variant">
                          {formatCoordinates(item.lat, item.lon)}
                        </p>
                      </div>
                      <span className="liquid-pill inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-primary">
                        <span>Pin on Map</span>
                        <ArrowRightIcon size={13} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {provider && (
              <div className="border-t border-white/10 px-4 py-1.5 text-[10px] text-on-surface-variant">
                Geocoding source: {provider}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Main Responsive Split: Left Saved & Quick Locations (5 cols), Right Real Interactive Map (7 cols) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Panel: Saved & Quick Worldwide Locations */}
        <section className="liquid-glass flex flex-col justify-between rounded-3xl p-5 sm:p-6 lg:col-span-5">
          <div>
            <h2 className="text-lg font-bold text-white">
              Saved &amp; Quick Worldwide Locations
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Select any city to synchronize your active location and focus its
              live marker on the map.
            </p>

            <div className="mt-4 space-y-2.5">
              {detectedLocation && (
                <div className="liquid-pill flex items-center justify-between gap-3 rounded-2xl border border-secondary/30 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSelectOnMap(detectedLocation)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <CrosshairIcon
                      size={18}
                      className="shrink-0 text-secondary"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {formatLocationLabel(detectedLocation)}
                      </p>
                      <p className="tabular-telemetry text-[11px] text-on-surface-variant">
                        GPS •{" "}
                        {formatCoordinates(
                          detectedLocation.lat,
                          detectedLocation.lon
                        )}
                      </p>
                    </div>
                  </button>
                  <span className="rounded-full bg-secondary/20 px-2.5 py-1 text-[10px] font-bold text-secondary uppercase">
                    {activeLocation?.id === detectedLocation.id
                      ? "Active"
                      : "Focus"}
                  </span>
                </div>
              )}

              {savedLocations.map((loc) => {
                const liveMarker = markers.find((m) => m.id === loc.id);
                const liveUs = liveMarker?.usAqi;
                const liveUsCat = liveUs ? classifyUsAqi(liveUs.value) : null;
                return (
                  <div
                    key={loc.id}
                    className={`liquid-pill flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 ${
                      activeLocation?.id === loc.id
                        ? "border border-primary/45"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectOnMap(loc)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <LocationPinIcon
                        size={17}
                        className="shrink-0 text-primary"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {formatLocationLabel(loc)}
                        </p>
                        <p className="tabular-telemetry text-[11px] text-on-surface-variant">
                          {formatCoordinates(loc.lat, loc.lon)}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {liveUs && liveUsCat && (
                        <span
                          className={`tabular-telemetry rounded-full border px-2 py-0.5 text-[10px] font-bold ${liveUsCat.badgeBorderClass} ${liveUsCat.textClass}`}
                        >
                          US {liveUs.value}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSavedLocation(loc.id)}
                        aria-label={`Remove ${loc.name}`}
                        className="liquid-btn flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:text-white"
                      >
                        <CloseIcon size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className="tabular-telemetry mt-6 mb-2.5 text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
              Quick Worldwide Cities
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {WORLDWIDE_QUICK_CITIES.map((city) => {
                const liveMarker = markers.find(
                  (m) =>
                    m.id === city.id ||
                    (Math.abs(m.lat - city.lat) < 0.05 &&
                      Math.abs(m.lon - city.lon) < 0.05)
                );
                const liveUs = liveMarker?.usAqi;
                const liveUsCat = liveUs ? classifyUsAqi(liveUs.value) : null;
                const isSelected =
                  selectedMarker?.id === liveMarker?.id ||
                  activeLocation?.id === city.id;

                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => handleSelectOnMap(city)}
                    className={`flex min-h-[54px] flex-col items-start justify-center rounded-2xl px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "border border-primary/50 bg-primary/15"
                        : "liquid-btn"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold text-white">
                        {city.name}
                      </span>
                      {liveUs && liveUsCat ? (
                        <span
                          className={`tabular-telemetry shrink-0 text-[10px] font-bold ${liveUsCat.textClass}`}
                        >
                          {liveUs.value}
                        </span>
                      ) : (
                        <span className="tabular-telemetry text-[10px] text-on-surface-variant">
                          {city.country}
                        </span>
                      )}
                    </div>
                    <span className="tabular-telemetry mt-0.5 text-[10px] text-on-surface-variant">
                      {city.country} • {formatCoordinates(city.lat, city.lon)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-on-surface-variant/85">
            {US_VS_CPCB_DISCLOSURE}
          </p>
        </section>

        {/* Right Panel: Real Interactive Geographical Map (Replaces Upcoming Layer Placeholder) */}
        <section
          aria-label="Interactive Global Air Quality Map"
          className="liquid-glass flex flex-col gap-4 rounded-3xl p-4 sm:p-6 lg:col-span-7"
        >
          {/* Map Toolbar: Standard Switcher, Optional Wind Vectors Toggle, Refresh */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-white">
                Live Air Quality Map
              </h2>
              <p className="text-xs text-on-surface-variant">
                Click any marker to inspect verified readings. Pan &amp; zoom
                never trigger uncontrolled API calls.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Standard Switcher */}
              <div
                className="liquid-pill inline-flex rounded-full border border-white/15 p-0.5"
                role="tablist"
                aria-label="Map AQI standard"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={standard === "us_aqi"}
                  onClick={() => setStandard("us_aqi")}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                    standard === "us_aqi"
                      ? "bg-white/20 text-white"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  US AQI (0–500)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={standard === "cpcb_india"}
                  onClick={() => setStandard("cpcb_india")}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                    standard === "cpcb_india"
                      ? "bg-white/20 text-white"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  India CPCB
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={standard === "openweather"}
                  onClick={() => setStandard("openweather")}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                    standard === "openweather"
                      ? "bg-white/20 text-white"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  OW (1–5)
                </button>
              </div>

              {/* Intentional Map Point Selection Toggle */}
              <button
                type="button"
                onClick={() => setIsSelectMode((v) => !v)}
                aria-pressed={isSelectMode}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                  isSelectMode
                    ? "border border-secondary/55 bg-secondary/20 text-white shadow-[0_0_16px_rgba(78,222,163,0.3)]"
                    : "liquid-btn text-on-surface-variant hover:text-white"
                }`}
                title="Click or tap anywhere on the map to inspect live air quality at exact coordinates"
              >
                <LocationPinIcon size={13} className="text-secondary" />
                <span>{isSelectMode ? "Selecting Point" : "Select Location"}</span>
              </button>

              {/* Keyboard-Accessible Coordinate Entry Alternative */}
              <button
                type="button"
                onClick={() => setShowCoordForm((v) => !v)}
                aria-expanded={showCoordForm}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                  showCoordForm
                    ? "border border-primary/45 bg-primary/20 text-white"
                    : "liquid-btn text-on-surface-variant hover:text-white"
                }`}
                title="Enter latitude and longitude directly using the keyboard"
              >
                <CrosshairIcon size={13} className="text-primary" />
                <span>Coordinates</span>
              </button>

              {/* Real Surface Wind Direction Toggle (Not a fabricated plume!) */}
              <button
                type="button"
                onClick={() => setShowWindVectors((v) => !v)}
                aria-pressed={showWindVectors}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                  showWindVectors
                    ? "border border-primary/45 bg-primary/20 text-white"
                    : "liquid-btn text-on-surface-variant hover:text-white"
                }`}
                title="Show OpenWeather surface wind bearing arrows on markers (not a pollution plume)"
              >
                <WindIcon size={13} className="text-primary" />
                <span>Surface Wind</span>
              </button>

              <button
                type="button"
                disabled={mapStatus === "loading"}
                onClick={() => setMapRefreshNonce((n) => n + 1)}
                aria-label="Refresh map marker readings"
                className="liquid-btn flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:text-white disabled:opacity-45"
              >
                <RefreshIcon
                  size={14}
                  className={mapStatus === "loading" ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          {/* Active Select-Location Mode Guidance Banner */}
          {isSelectMode && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-secondary/35 bg-secondary/10 px-4 py-2 text-xs text-secondary"
            >
              <span>
                <strong>Select Location mode active:</strong> Click or tap
                anywhere on the map to drop a pin and fetch live AQI. Dragging
                or zooming will not trigger selection.
              </span>
              <button
                type="button"
                onClick={() => setIsSelectMode(false)}
                className="rounded-full border border-secondary/40 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-white/10"
              >
                Done
              </button>
            </div>
          )}

          {/* Keyboard-Accessible Coordinate Entry Form */}
          {showCoordForm && (
            <form
              onSubmit={handleCoordFormSubmit}
              aria-label="Inspect exact coordinates"
              className="flex flex-col gap-2.5 rounded-2xl border border-white/15 bg-white/[0.04] p-3.5 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label
                  htmlFor="map-coord-lat"
                  className="tabular-telemetry mb-1 block text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase"
                >
                  Latitude (-90 to 90)
                </label>
                <input
                  id="map-coord-lat"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  required
                  value={coordLatInput}
                  onChange={(e) => setCoordLatInput(e.target.value)}
                  placeholder="e.g. 17.9689"
                  className="liquid-input w-full rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-on-surface-variant/60"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="map-coord-lon"
                  className="tabular-telemetry mb-1 block text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase"
                >
                  Longitude (-180 to 180)
                </label>
                <input
                  id="map-coord-lon"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  required
                  value={coordLonInput}
                  onChange={(e) => setCoordLonInput(e.target.value)}
                  placeholder="e.g. 79.5941"
                  className="liquid-input w-full rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-on-surface-variant/60"
                />
              </div>
              <button
                type="submit"
                className="liquid-cta inline-flex min-h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-on-primary-container"
              >
                <LocationPinIcon size={14} />
                <span>Inspect Point</span>
              </button>
              {coordFormError && (
                <p role="alert" className="text-[11px] text-rose-300">
                  {coordFormError}
                </p>
              )}
            </form>
          )}

          {/* Map Error Banner (Graceful Degradation) */}
          {mapStatus === "error" && mapError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200"
            >
              <span className="flex items-center gap-2">
                <AlertTriangleIcon size={15} className="shrink-0" />
                {mapError}
              </span>
              <button
                type="button"
                onClick={() => setMapRefreshNonce((n) => n + 1)}
                className="rounded-full border border-rose-300/40 px-3 py-1 font-semibold text-white hover:bg-white/10"
              >
                Retry
              </button>
            </div>
          )}

          {/* Interactive Leaflet Map Canvas */}
          <div className="relative">
            <InteractiveGlobalMap
              markers={markers}
              selectedMarkerId={customSelection ? null : (selectedMarker?.id ?? null)}
              activeLocationId={activeLocation?.id ?? null}
              standard={standard}
              showWindVectors={showWindVectors}
              isSelectMode={isSelectMode}
              customPin={customPin}
              onSelectMarker={handleSelectMarker}
              onSelectMapPoint={(lat, lon) => void handleSelectMapPoint(lat, lon)}
            />
            {(mapStatus === "loading" || customSelection?.loading) && (
              <div className="pointer-events-none absolute top-3 right-3 z-[500] rounded-full border border-primary/35 bg-[#060a14]/85 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur-md">
                {customSelection?.loading
                  ? "Fetching selected point AQI…"
                  : "Updating live markers…"}
              </div>
            )}
          </div>

          {/* Standard-Specific AQI Legend */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-on-surface-variant">
              <span className="tabular-telemetry font-bold tracking-wider uppercase">
                {standard === "us_aqi"
                  ? "Legend: US EPA AQI (0–500+, Open-Meteo Modeled)"
                  : standard === "cpcb_india"
                    ? "Legend: India CPCB National AQI (0–500, Ground Stations via data.gov.in — non-India markers show --)"
                    : "Legend: OpenWeather AQI (1–5 SILAM Modeled Index)"}
              </span>
              {showWindVectors && (
                <span className="text-primary">
                  ▲ Surface wind direction (OpenWeather) — not a dispersion
                  plume
                </span>
              )}
            </div>

            {standard === "us_aqi" ? (
              <div className="flex flex-wrap gap-1.5">
                {US_AQI_LEGEND.map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-on-surface"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.accentHex }}
                    />
                    <span className="tabular-telemetry font-semibold">
                      {item.rangeLabel}
                    </span>
                    <span className="text-on-surface-variant">
                      {item.shortLabel}
                    </span>
                  </span>
                ))}
              </div>
            ) : standard === "cpcb_india" ? (
              <div className="flex flex-wrap gap-1.5">
                {CPCB_AQI_LEGEND.map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-on-surface"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.accentHex }}
                    />
                    <span className="tabular-telemetry font-semibold">
                      {item.rangeLabel}
                    </span>
                    <span className="text-on-surface-variant">
                      {item.shortLabel}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {([1, 2, 3, 4, 5] as const).map((idx) => {
                  const ow = OPENWEATHER_AQI_SCALE[idx];
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-on-surface"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: ow.accentHex }}
                      />
                      <span className="tabular-telemetry font-semibold">
                        {ow.index}/5
                      </span>
                      <span className="text-on-surface-variant">
                        {ow.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Map Point Telemetry Inspector */}
          {customSelection && (
            <div
              aria-live="polite"
              className="rounded-2xl border border-primary/40 bg-white/[0.05] p-4 shadow-[0_0_24px_rgba(56,189,248,0.12)]"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular-telemetry rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
                      Custom Map Pin
                    </span>
                    {!customSelection.loading && !customSelection.reverseGeocoded && (
                      <span className="text-[10px] text-on-surface-variant">
                        Coordinates-only location
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-base font-bold text-white sm:text-lg">
                    {customSelection.name}
                    {customSelection.region ? `, ${customSelection.region}` : ""}
                    {customSelection.country
                      ? `, ${customSelection.country}`
                      : ""}
                  </h3>
                  <p className="tabular-telemetry text-[11px] text-on-surface-variant">
                    {formatCoordinates(customSelection.lat, customSelection.lon)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSyncAndNavigate(customSelection, "/")
                    }
                    className="liquid-cta inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-on-primary-container"
                  >
                    <span>View Full Dashboard</span>
                    <ArrowRightIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSyncAndNavigate(customSelection, "/gemini-ai")
                    }
                    className="liquid-btn inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-primary/35 px-3.5 py-1.5 text-xs font-semibold text-primary hover:text-white"
                  >
                    <SparklesIcon size={14} />
                    <span>AI Recommendations</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      customAbortRef.current?.abort();
                      setCustomSelection(null);
                    }}
                    aria-label="Clear custom map pin"
                    className="liquid-btn flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:text-white"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              </div>

              {customSelection.loading ? (
                <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="h-24 animate-pulse rounded-xl bg-white/10" />
                  <div className="h-24 animate-pulse rounded-xl bg-white/10" />
                </div>
              ) : customSelection.error ? (
                <div
                  role="alert"
                  className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
                >
                  <span>{customSelection.error}</span>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSelectMapPoint(
                        customSelection.lat,
                        customSelection.lon
                      )
                    }
                    className="rounded-full border border-rose-300/40 px-3 py-1 font-semibold text-white hover:bg-white/10"
                  >
                    Retry
                  </button>
                </div>
              ) : customSelection.data ? (
                <>
                  <div
                    className={`mt-3.5 grid grid-cols-1 gap-3 ${
                      customSelection.data.cpcbAqi ||
                      customSelection.data.cpcbRegionalReference
                        ? "sm:grid-cols-3"
                        : "sm:grid-cols-2"
                    }`}
                  >
                    {/* India CPCB Primary Station (<= 25 km) OR Regional Reference (25–50 km) */}
                    {customSelection.data.cpcbAqi && customCpcbCat ? (
                      <div className="rounded-xl border border-secondary/35 bg-[#070c18]/75 p-3">
                        <span className="tabular-telemetry block text-[10px] font-semibold tracking-wider text-secondary uppercase">
                          Primary • India AQI (CPCB)
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span
                            className={`tabular-telemetry text-2xl font-bold ${customCpcbCat.textClass}`}
                          >
                            {customSelection.data.cpcbAqi.value}
                          </span>
                          <span
                            className={`tabular-telemetry text-xs font-semibold ${customCpcbCat.textClass}`}
                          >
                            {customCpcbCat.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-on-surface-variant">
                          {customSelection.data.cpcbAqi.stationName} (
                          {customSelection.data.cpcbAqi.stationDistanceKm.toFixed(
                            1
                          )}{" "}
                          km)
                        </p>
                        <p className="mt-0.5 text-[10px] text-on-surface-variant/85">
                          Dom:{" "}
                          {customSelection.data.cpcbAqi.dominantPollutant.label}{" "}
                          • Observed{" "}
                          {formatTimestampReadable(
                            customSelection.data.cpcbAqi.observedAt
                          )}
                        </p>
                      </div>
                    ) : customSelection.data.cpcbRegionalReference &&
                      customRegionalCat ? (
                      <div className="rounded-xl border border-amber-400/30 bg-[#070c18]/75 p-3">
                        <span className="tabular-telemetry block text-[10px] font-semibold tracking-wider text-amber-300 uppercase">
                          Regional CPCB Ref (25–50 km)
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span
                            className={`tabular-telemetry text-2xl font-bold ${customRegionalCat.textClass}`}
                          >
                            {customSelection.data.cpcbRegionalReference.value}
                          </span>
                          <span
                            className={`tabular-telemetry text-xs font-semibold ${customRegionalCat.textClass}`}
                          >
                            {customRegionalCat.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-on-surface-variant">
                          {
                            customSelection.data.cpcbRegionalReference
                              .stationName
                          }{" "}
                          (
                          {customSelection.data.cpcbRegionalReference.stationDistanceKm.toFixed(
                            1
                          )}{" "}
                          km) — not exact location
                        </p>
                      </div>
                    ) : null}

                    {/* US AQI (Open-Meteo Modeled) */}
                    <div className="rounded-xl border border-white/10 bg-[#070c18]/75 p-3">
                      <span className="tabular-telemetry block text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                        {customSelection.data.cpcbAqi
                          ? "US AQI — Open-Meteo Modeled"
                          : "Primary • US AQI (Open-Meteo)"}
                      </span>
                      {customSelection.data.usAqi && customUsCat ? (
                        <>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span
                              className={`tabular-telemetry text-2xl font-bold ${customUsCat.textClass}`}
                            >
                              {customSelection.data.usAqi.value}
                            </span>
                            <span
                              className={`tabular-telemetry text-xs font-semibold ${customUsCat.textClass}`}
                            >
                              {customUsCat.label}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-on-surface-variant">
                            {customSelection.data.usAqi.dominantPollutant
                              ? `Dom: ${customSelection.data.usAqi.dominantPollutant.label} • `
                              : ""}
                            Valid{" "}
                            {formatTimestampReadable(
                              customSelection.data.usAqi.validAt
                            )}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Unavailable for these coordinates.
                        </p>
                      )}
                    </div>

                    {/* OpenWeather 1–5 + Pollutants */}
                    <div className="rounded-xl border border-white/10 bg-[#070c18]/75 p-3">
                      <span className="tabular-telemetry block text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                        OpenWeather (1–5 Modeled)
                      </span>
                      {customOwMeta && (
                        <>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span
                              className={`tabular-telemetry text-2xl font-bold ${customOwMeta.textClass}`}
                            >
                              {customOwMeta.index}/5
                            </span>
                            <span
                              className={`tabular-telemetry text-xs font-semibold ${customOwMeta.textClass}`}
                            >
                              {customOwMeta.label}
                            </span>
                          </div>
                          <p className="tabular-telemetry mt-1 text-[11px] text-on-surface-variant">
                            PM2.5:{" "}
                            {customSelection.data.current.components.pm2_5 !==
                            null
                              ? customSelection.data.current.components.pm2_5.toFixed(
                                  1
                                )
                              : "--"}{" "}
                            • PM10:{" "}
                            {customSelection.data.current.components.pm10 !==
                            null
                              ? customSelection.data.current.components.pm10.toFixed(
                                  1
                                )
                              : "--"}{" "}
                            µg/m³
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {customSelection.data.cpcbUnavailableReason && (
                    <p className="mt-2.5 text-[11px] text-amber-200/90">
                      {customSelection.data.cpcbUnavailableReason}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* Selected Marker Telemetry Inspector (Shown when no custom pin is active) */}
          {!customSelection && selectedMarker && (
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <span className="tabular-telemetry text-[10px] font-semibold tracking-wider text-primary uppercase">
                    Selected Map Location
                  </span>
                  <h3 className="text-base font-bold text-white sm:text-lg">
                    {selectedMarker.name}
                    {selectedMarker.region ? `, ${selectedMarker.region}` : ""}
                    {selectedMarker.country
                      ? `, ${selectedMarker.country}`
                      : ""}
                  </h3>
                  <p className="tabular-telemetry text-[11px] text-on-surface-variant">
                    {formatCoordinates(selectedMarker.lat, selectedMarker.lon)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSyncAndNavigate(selectedMarker, "/")
                    }
                    className="liquid-cta inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-on-primary-container"
                  >
                    <span>View Full Dashboard</span>
                    <ArrowRightIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSyncAndNavigate(selectedMarker, "/gemini-ai")
                    }
                    className="liquid-btn inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-primary/35 px-3.5 py-1.5 text-xs font-semibold text-primary hover:text-white"
                  >
                    <SparklesIcon size={14} />
                    <span>AI Recommendations</span>
                  </button>
                </div>
              </div>

              {/* Multi-Standard Telemetry Cards for Selected Marker (Never Merged) */}
              <div
                className={`mt-3.5 grid grid-cols-1 gap-3 ${
                  selectedMarker.cpcbAqi ? "sm:grid-cols-3" : "sm:grid-cols-2"
                }`}
              >
                {/* India CPCB Ground Station (when within 25 km & fresh) */}
                {selectedMarker.cpcbAqi && selectedCpcbCategory && (
                  <div className="rounded-xl border border-secondary/30 bg-[#070c18]/75 p-3">
                    <span className="tabular-telemetry block text-[10px] font-semibold tracking-wider text-secondary uppercase">
                      India AQI (CPCB) — Ground Station
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span
                        className={`tabular-telemetry text-2xl font-bold ${selectedCpcbCategory.textClass}`}
                      >
                        {selectedMarker.cpcbAqi.value}
                      </span>
                      <span
                        className={`tabular-telemetry text-xs font-semibold ${selectedCpcbCategory.textClass}`}
                      >
                        {selectedCpcbCategory.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      {selectedMarker.cpcbAqi.stationName} (
                      {selectedMarker.cpcbAqi.stationDistanceKm.toFixed(1)} km)
                    </p>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant/85">
                      Dominant: {selectedMarker.cpcbAqi.dominantPollutant.label}{" "}
                      ({selectedMarker.cpcbAqi.dominantPollutant.aqi}) •{" "}
                      {formatTimestampReadable(
                        selectedMarker.cpcbAqi.observedAt
                      )}
                    </p>
                  </div>
                )}

                {/* US AQI (Open-Meteo modeled) */}
                <div className="rounded-xl border border-white/10 bg-[#070c18]/75 p-3">
                  <span className="tabular-telemetry block text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                    US AQI — Open-Meteo Modeled
                  </span>
                  {selectedMarker.usAqi && selectedUsCategory ? (
                    <>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span
                          className={`tabular-telemetry text-2xl font-bold ${selectedUsCategory.textClass}`}
                        >
                          {selectedMarker.usAqi.value}
                        </span>
                        <span
                          className={`tabular-telemetry text-xs font-semibold ${selectedUsCategory.textClass}`}
                        >
                          {selectedUsCategory.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-on-surface-variant">
                        {selectedMarker.usAqi.dominantPollutant
                          ? `Dominant: ${selectedMarker.usAqi.dominantPollutant.label} (${selectedMarker.usAqi.dominantPollutant.aqi}) • `
                          : ""}
                        Valid{" "}
                        {formatTimestampReadable(selectedMarker.usAqi.validAt)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Unavailable for these coordinates.
                    </p>
                  )}
                </div>

                {/* OpenWeather 1–5 + Pollutants (Modeled SILAM) */}
                <div className="rounded-xl border border-white/10 bg-[#070c18]/75 p-3">
                  <span className="tabular-telemetry block text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                    OpenWeather (1–5 Modeled)
                  </span>
                  {selectedMarker.openWeather && selectedOwMeta ? (
                    <>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span
                          className={`tabular-telemetry text-2xl font-bold ${selectedOwMeta.textClass}`}
                        >
                          {selectedOwMeta.index}/5
                        </span>
                        <span
                          className={`tabular-telemetry text-xs font-semibold ${selectedOwMeta.textClass}`}
                        >
                          {selectedOwMeta.label}
                        </span>
                      </div>
                      <p className="tabular-telemetry mt-1 text-[11px] text-on-surface-variant">
                        PM2.5:{" "}
                        {selectedMarker.openWeather.components.pm2_5 !== null
                          ? `${selectedMarker.openWeather.components.pm2_5.toFixed(1)}`
                          : "--"}{" "}
                        • PM10:{" "}
                        {selectedMarker.openWeather.components.pm10 !== null
                          ? `${selectedMarker.openWeather.components.pm10.toFixed(1)}`
                          : "--"}{" "}
                        µg/m³
                      </p>
                      <p className="mt-0.5 text-[10px] text-on-surface-variant/85">
                        Modeled{" "}
                        {formatTimestampReadable(
                          selectedMarker.openWeather.observedAt
                        )}
                        {selectedMarker.openWeather.weather
                          ? ` • Wind ${(
                              selectedMarker.openWeather.weather.windSpeedMs *
                              2.23694
                            ).toFixed(1)} mph ${formatWindDirection(
                              selectedMarker.openWeather.weather.windDeg
                            )}`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      OpenWeather reading unavailable.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
