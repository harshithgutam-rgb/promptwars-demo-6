"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatCoordinates,
  formatLocationLabel,
  WORLDWIDE_QUICK_CITIES,
  type GeocodeApiResponse,
  type GeocodeResult,
} from "@/lib/air-quality";
import { useLocationContext } from "@/components/LocationContext";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CloseIcon,
  CrosshairIcon,
  GlobeIcon,
  LocationPinIcon,
  SearchIcon,
} from "@/components/Icons";

export function LocationModal() {
  const {
    isLocationModalOpen,
    isFirstVisitModal,
    closeLocationModal,
    activeLocation,
    detectedLocation,
    savedLocations,
    selectLocation,
    removeSavedLocation,
    geolocationStatus,
    geolocationMessage,
    requestBrowserLocation,
  } = useLocationContext();

  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchProvider, setSearchProvider] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Manage keyboard focus: focus input on open, trap Tab inside modal, close on Escape, restore focus on close
  useEffect(() => {
    if (!isLocationModalOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLocationModal();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isLocationModalOpen, closeLocationModal]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setSearchStatus("idle");
      setSearchResults([]);
      setSearchError(null);
      setSearchProvider(null);
    }
  };

  // Debounced worldwide city search via /api/geocode
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchStatus("loading");
      setSearchError(null);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const payload: unknown = await res.json();
        if (!res.ok) {
          const msg =
            typeof (payload as { error?: unknown })?.error === "string"
              ? (payload as { error: string }).error
              : "Search could not be completed.";
          setSearchError(msg);
          setSearchResults([]);
          setSearchStatus("error");
          return;
        }
        const data = payload as GeocodeApiResponse;
        setSearchResults(Array.isArray(data.results) ? data.results : []);
        setSearchProvider(data.provider ?? null);
        setSearchStatus("ready");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSearchError("Unable to reach worldwide city search. Please try again.");
        setSearchResults([]);
        setSearchStatus("error");
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (!isLocationModalOpen) return null;

  const isGeoLoading = geolocationStatus === "requesting";
  const isGeoError =
    geolocationStatus === "denied" ||
    geolocationStatus === "timeout" ||
    geolocationStatus === "unavailable" ||
    geolocationStatus === "unsupported";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
    >
      {/* Frosted Obsidian Backdrop */}
      <div
        className="fixed inset-0 bg-[#040710]/82 backdrop-blur-md transition-opacity"
        onClick={closeLocationModal}
        aria-hidden="true"
      />

      {/* Liquid Glass Modal Vessel */}
      <div
        ref={dialogRef}
        className="liquid-modal relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl p-5 sm:p-7 text-on-surface"
      >
        {/* Specular Top Edge Highlight */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-px rounded-t-3xl"
          style={{
            background:
              "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.65) 30%, rgba(142,213,255,0.9) 50%, rgba(255,255,255,0.65) 70%, transparent 95%)",
          }}
        />

        {/* Ambient Internal Backlight (Pure radial gradients for smooth mobile compositing) */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 68%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(78,222,163,0.14) 0%, transparent 68%)",
          }}
        />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="liquid-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/30 text-primary shadow-[0_0_20px_rgba(56,189,248,0.28)]">
                <GlobeIcon size={22} />
              </div>
              <div>
                <span className="tabular-telemetry block text-[11px] font-semibold tracking-[0.09em] text-primary uppercase">
                  {isFirstVisitModal
                    ? "Hyperlocal Telemetry Setup"
                    : "Switch Monitoring Location"}
                </span>
                <h2
                  id="location-modal-title"
                  className="text-xl font-bold tracking-tight text-white sm:text-2xl"
                >
                  {isFirstVisitModal
                    ? "Choose Your Air Quality Location"
                    : "Worldwide Location Switcher"}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={closeLocationModal}
              aria-label="Close location modal"
              className="liquid-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:text-white"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* Transparent Location Permission Explanation */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm leading-relaxed text-on-surface-variant">
              AirWise AI requests your browser location only to fetch real-time
              air pollution telemetry (PM2.5, PM10, O₃, NO₂) for your exact
              coordinates. Location access is never triggered automatically—only
              when you tap{" "}
              <span className="font-semibold text-white">Use My Location</span>{" "}
              below, or you can search any city worldwide.
            </p>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={requestBrowserLocation}
                disabled={isGeoLoading}
                className="liquid-cta inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-on-primary-container disabled:opacity-60"
              >
                <CrosshairIcon
                  size={18}
                  className={isGeoLoading ? "animate-spin" : ""}
                />
                <span>
                  {isGeoLoading ? "Detecting Your Location…" : "Use My Location"}
                </span>
              </button>

              {detectedLocation && (
                <button
                  type="button"
                  onClick={() => selectLocation(detectedLocation)}
                  className="liquid-btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-secondary"
                >
                  <LocationPinIcon size={15} />
                  <span>Use Detected: {detectedLocation.name}</span>
                </button>
              )}
            </div>

            {/* Geolocation Feedback Banner */}
            {geolocationMessage && (
              <div
                role="status"
                className={`mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                  isGeoError
                    ? "border-amber-400/35 bg-amber-500/10 text-amber-200"
                    : "border-primary/30 bg-primary/10 text-primary-fixed"
                }`}
              >
                {isGeoError ? (
                  <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <CheckCircleIcon size={16} className="mt-0.5 shrink-0" />
                )}
                <span>{geolocationMessage}</span>
              </div>
            )}
          </div>

          {/* Worldwide City Search */}
          <div className="mt-5">
            <label
              htmlFor="worldwide-city-search"
              className="tabular-telemetry mb-2 block text-[11px] font-semibold tracking-[0.08em] text-on-surface-variant uppercase"
            >
              Or Search Any City Worldwide
            </label>
            <div className="relative">
              <SearchIcon
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                ref={inputRef}
                id="worldwide-city-search"
                type="search"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search city, region, or country (e.g., Tokyo, Paris, Bengaluru)…"
                autoComplete="off"
                className="liquid-input w-full rounded-2xl py-3 pr-4 pl-11 text-sm text-white placeholder:text-on-surface-variant/70"
              />
            </div>

            {/* Search States & Results */}
            {searchStatus === "loading" && (
              <div className="mt-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-on-surface-variant">
                Searching worldwide locations…
              </div>
            )}

            {searchStatus === "error" && searchError && (
              <div className="mt-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                {searchError}
              </div>
            )}

            {searchStatus === "ready" && (
              <div className="mt-2.5 overflow-hidden rounded-2xl border border-white/15 bg-[#0a1020]/90">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-on-surface-variant">
                    No matching cities found for &ldquo;{query.trim()}&rdquo;. Try
                    another spelling or include a country code.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {searchResults.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            selectLocation({
                              ...item,
                              source: "search",
                            });
                            setQuery("");
                          }}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {item.name}
                              {item.region ? `, ${item.region}` : ""}
                              {item.country ? `, ${item.country}` : ""}
                            </p>
                            <p className="tabular-telemetry text-[11px] text-on-surface-variant">
                              {formatCoordinates(item.lat, item.lon)}
                            </p>
                          </div>
                          <span className="liquid-pill shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-primary">
                            Select
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {searchProvider && (
                  <div className="border-t border-white/10 bg-white/[0.03] px-4 py-1.5 text-[10px] text-on-surface-variant/80">
                    Geocoding source: {searchProvider}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Saved & Detected Locations Switcher */}
          {(detectedLocation || savedLocations.length > 0) && (
            <div className="mt-5">
              <span className="tabular-telemetry mb-2 block text-[11px] font-semibold tracking-[0.08em] text-on-surface-variant uppercase">
                Your Locations
              </span>
              <div className="flex flex-wrap gap-2">
                {detectedLocation && (
                  <button
                    type="button"
                    onClick={() => selectLocation(detectedLocation)}
                    className={`inline-flex min-h-[38px] items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      activeLocation?.id === detectedLocation.id
                        ? "border border-secondary/50 bg-secondary/20 text-white shadow-[0_0_16px_rgba(78,222,163,0.25)]"
                        : "liquid-pill text-on-surface hover:border-white/30"
                    }`}
                  >
                    <CrosshairIcon size={13} className="text-secondary" />
                    <span>{formatLocationLabel(detectedLocation)}</span>
                    <span className="rounded-full bg-secondary/20 px-1.5 py-0.5 text-[10px] font-bold text-secondary">
                      GPS
                    </span>
                  </button>
                )}

                {savedLocations.map((loc) => {
                  const isActive = activeLocation?.id === loc.id;
                  return (
                    <div
                      key={loc.id}
                      className={`inline-flex min-h-[38px] items-center rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? "border border-primary/50 bg-primary/20 text-white shadow-[0_0_16px_rgba(56,189,248,0.25)]"
                          : "liquid-pill text-on-surface hover:border-white/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectLocation(loc)}
                        className="inline-flex items-center gap-1.5 py-1.5 pr-2 pl-3.5"
                      >
                        <LocationPinIcon size={13} className="text-primary" />
                        <span>{loc.name}</span>
                        {loc.country && (
                          <span className="text-on-surface-variant">
                            {loc.country}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSavedLocation(loc.id)}
                        aria-label={`Remove ${loc.name} from saved locations`}
                        className="mr-1.5 flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant hover:bg-white/15 hover:text-white"
                      >
                        <CloseIcon size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Worldwide Cities */}
          <div className="mt-5">
            <span className="tabular-telemetry mb-2 block text-[11px] font-semibold tracking-[0.08em] text-on-surface-variant uppercase">
              Quick Worldwide Cities
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WORLDWIDE_QUICK_CITIES.map((city) => {
                const isActive =
                  activeLocation &&
                  Math.abs(activeLocation.lat - city.lat) < 0.05 &&
                  Math.abs(activeLocation.lon - city.lon) < 0.05;
                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => selectLocation(city)}
                    className={`flex min-h-[42px] items-center justify-between rounded-2xl px-3.5 py-2 text-left text-xs font-medium transition-all ${
                      isActive
                        ? "border border-primary/50 bg-primary/20 text-white"
                        : "liquid-btn text-on-surface hover:text-white"
                    }`}
                  >
                    <span className="truncate">{city.name}</span>
                    <span className="tabular-telemetry text-[10px] text-on-surface-variant">
                      {city.country}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
