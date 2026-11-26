"use client";

import { WORLDWIDE_QUICK_CITIES } from "@/lib/air-quality";
import { useLocationContext } from "@/components/LocationContext";
import { CrosshairIcon, HubIcon, LocationPinIcon, SearchIcon } from "@/components/Icons";

export function LocationClusterBar() {
  const {
    activeLocation,
    detectedLocation,
    savedLocations,
    selectLocation,
    openLocationModal,
  } = useLocationContext();

  const quickFallbacks = WORLDWIDE_QUICK_CITIES.filter(
    (city) =>
      !savedLocations.some(
        (saved) =>
          Math.abs(saved.lat - city.lat) < 0.05 &&
          Math.abs(saved.lon - city.lon) < 0.05
      )
  ).slice(0, Math.max(0, 4 - savedLocations.length));

  return (
    <section
      aria-label="Worldwide Location Switcher"
      className="liquid-glass below-fold-section w-full rounded-2xl p-4"
    >
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-2">
          <HubIcon size={20} className="text-secondary" />
          <span className="tabular-telemetry text-[11px] font-bold tracking-[0.08em] text-white uppercase">
            Quick Location Switcher
          </span>
        </div>

        {/* Horizontal Scrollable Pill Strip on Mobile, Flex Wrap on Desktop */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5 md:flex-wrap md:overflow-visible">
          {detectedLocation && (
            <button
              type="button"
              onClick={() => selectLocation(detectedLocation)}
              className={`inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeLocation?.id === detectedLocation.id
                  ? "border border-secondary/50 bg-secondary/20 text-white shadow-[0_0_12px_rgba(78,222,163,0.3)]"
                  : "liquid-pill border border-secondary/20 text-on-surface hover:border-secondary/45"
              }`}
            >
              <CrosshairIcon size={13} className="text-secondary" />
              <span>{detectedLocation.name}</span>
              <span className="tabular-telemetry text-[10px] font-bold text-secondary uppercase">
                GPS
              </span>
            </button>
          )}

          {savedLocations.map((loc) => {
            const isActive = activeLocation?.id === loc.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => selectLocation(loc)}
                className={`inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border border-primary/50 bg-primary/20 text-white shadow-[0_0_12px_rgba(56,189,248,0.3)]"
                    : "liquid-pill border border-white/15 text-on-surface hover:border-primary/40"
                }`}
              >
                <LocationPinIcon size={13} className="text-primary" />
                <span>{loc.name}</span>
                {loc.country && (
                  <span className="tabular-telemetry text-[10px] text-on-surface-variant">
                    {loc.country}
                  </span>
                )}
              </button>
            );
          })}

          {quickFallbacks.map((city) => {
            const isActive =
              activeLocation &&
              Math.abs(activeLocation.lat - city.lat) < 0.05 &&
              Math.abs(activeLocation.lon - city.lon) < 0.05;
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => selectLocation(city)}
                className={`inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border border-primary/50 bg-primary/20 text-white shadow-[0_0_12px_rgba(56,189,248,0.3)]"
                    : "liquid-pill border border-white/15 text-on-surface hover:border-primary/40"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />
                <span>{city.name}</span>
                <span className="tabular-telemetry text-[10px] text-on-surface-variant">
                  {city.country}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={openLocationModal}
            className="liquid-btn inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-primary"
          >
            <SearchIcon size={13} />
            <span>Search Worldwide</span>
          </button>
        </div>
      </div>
    </section>
  );
}
