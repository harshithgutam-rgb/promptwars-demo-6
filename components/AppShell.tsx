"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  formatRelativeTime,
  OPENWEATHER_AQI_SCALE,
} from "@/lib/air-quality";
import { classifyUsAqi } from "@/lib/us-aqi";
import { classifyCpcbAqi } from "@/lib/cpcb-aqi";
import { useLocationContext } from "@/components/LocationContext";

const LocationModal = dynamic(
  () => import("@/components/LocationModal").then((mod) => mod.LocationModal),
  { ssr: false }
);
import {
  AirWiseLogo,
  CalendarIcon,
  ChevronDownIcon,
  DashboardIcon,
  GlobeIcon,
  LocationPinIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  WindIcon,
} from "@/components/Icons";

const DESKTOP_NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/global-map", label: "Global Map & Search" },
  { href: "/daily-routine", label: "Daily Routine" },
  { href: "/what-if-simulator", label: "What-If Simulator" },
  { href: "/indoor-air-rescue", label: "Indoor Air Rescue" },
  { href: "/gemini-ai", label: "Gemini AI" },
];

const MOBILE_DOCK_ITEMS = [
  { href: "/", label: "Dash", icon: "dash" },
  { href: "/global-map", label: "Map", icon: "map" },
  { href: "/gemini-ai", label: "Insights", icon: "insights" },
  { href: "/daily-routine", label: "Routine", icon: "routine" },
  { href: "/indoor-air-rescue", label: "Rescue", icon: "rescue" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    activeLocation,
    isLocationModalOpen,
    openLocationModal,
    airQualityStatus,
    airQualityData,
    refreshAirQuality,
  } = useLocationContext();

  const aqiLevel = airQualityData
    ? OPENWEATHER_AQI_SCALE[airQualityData.current.aqi]
    : null;
  const cpcbAqi = airQualityData?.cpcbAqi ?? null;
  const cpcbAqiMeta = cpcbAqi ? classifyCpcbAqi(cpcbAqi.value) : null;
  const usAqi = airQualityData?.usAqi ?? null;
  const usAqiMeta = usAqi ? classifyUsAqi(usAqi.value) : null;
  const headlineMeta = cpcbAqiMeta ?? usAqiMeta;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Keyboard Skip Link (WCAG 2.2 AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-full focus:border focus:border-primary focus:bg-[#060a14] focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Desktop Floating Liquid Glass Header Navigation (Matches Approved Desktop Stitch) */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 hidden md:block">
        <div className="pointer-events-auto mx-auto max-w-7xl px-6 pt-4">
          <div className="liquid-glass flex h-20 items-center justify-between gap-4 rounded-full px-5 lg:px-6">
            {/* Brand & Version */}
            <Link
              href="/"
              className="flex shrink-0 items-center gap-3 focus:outline-none"
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-1 rounded-full bg-secondary/30 blur-md" />
                <AirWiseLogo className="relative h-8 w-8 drop-shadow-[0_2px_8px_rgba(52,211,153,0.45)]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-white drop-shadow-sm">
                  AirWise AI
                </span>
                <span className="tabular-telemetry ml-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary-fixed uppercase backdrop-blur-md">
                  PRO • V2.4
                </span>
              </div>
            </Link>

            {/* Fluid Liquid Navigation Segment */}
            <nav
              aria-label="Primary navigation"
              className="liquid-pill hidden items-center gap-1 rounded-full p-1.5 xl:flex"
            >
              {DESKTOP_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-full px-3.5 py-1.5 text-xs transition-all ${
                      isActive
                        ? "border border-white/20 bg-white/15 font-semibold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_8px_rgba(0,0,0,0.4)]"
                        : "font-medium text-on-surface-variant hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Glass Capsule Utilities */}
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                onClick={openLocationModal}
                className="liquid-pill flex items-center gap-2 rounded-full px-3.5 py-1.5 transition-all hover:border-white/30"
                title="Switch active location"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    headlineMeta
                      ? `${headlineMeta.dotClass} animate-pulse`
                      : aqiLevel
                        ? `${aqiLevel.dotClass} animate-pulse`
                        : airQualityStatus === "loading"
                          ? "bg-primary animate-pulse"
                          : "bg-on-surface-variant/60"
                  }`}
                />
                <span className="max-w-[125px] truncate text-xs font-medium text-white">
                  {activeLocation ? activeLocation.name : "Select Location"}
                </span>
                {cpcbAqi && cpcbAqiMeta ? (
                  <span
                    className={`tabular-telemetry text-[11px] font-bold ${cpcbAqiMeta.textClass}`}
                  >
                    CPCB {cpcbAqi.value} ({cpcbAqiMeta.shortLabel})
                  </span>
                ) : usAqi && usAqiMeta ? (
                  <span
                    className={`tabular-telemetry text-[11px] font-bold ${usAqiMeta.textClass}`}
                  >
                    US AQI {usAqi.value} ({usAqiMeta.shortLabel})
                  </span>
                ) : aqiLevel ? (
                  <span
                    className={`tabular-telemetry text-[11px] font-bold ${aqiLevel.textClass}`}
                  >
                    OW {aqiLevel.index}/5 ({aqiLevel.shortLabel})
                  </span>
                ) : null}
                {airQualityData?.observedAt && (
                  <span className="tabular-telemetry hidden text-[10px] text-on-surface-variant/80 2xl:inline">
                    • {formatRelativeTime(airQualityData.observedAt)}
                  </span>
                )}
                <ChevronDownIcon size={14} className="text-on-surface-variant" />
              </button>

              <button
                type="button"
                onClick={openLocationModal}
                aria-label="Search worldwide cities (⌘K)"
                className="liquid-btn flex items-center gap-1.5 rounded-full px-3 py-1.5 text-on-surface-variant hover:text-white"
              >
                <SearchIcon size={16} />
                <kbd
                  aria-hidden="true"
                  className="tabular-telemetry text-[10px] text-on-surface-variant/85 uppercase"
                >
                  ⌘K
                </kbd>
              </button>

              <button
                type="button"
                onClick={refreshAirQuality}
                disabled={!activeLocation || airQualityStatus === "loading"}
                aria-label="Refresh live air quality telemetry"
                className="liquid-btn flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:text-white disabled:opacity-45"
              >
                <RefreshIcon
                  size={17}
                  className={airQualityStatus === "loading" ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          {/* Tablet Horizontal Nav Row (md to xl) */}
          <nav
            aria-label="Tablet navigation"
            className="no-scrollbar mt-2 flex items-center gap-1.5 overflow-x-auto xl:hidden"
          >
            <div className="liquid-pill mx-auto flex items-center gap-1 rounded-full p-1">
              {DESKTOP_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    aria-current={isActive ? "page" : undefined}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs transition-all ${
                      isActive
                        ? "border border-white/20 bg-white/15 font-semibold text-white"
                        : "text-on-surface-variant hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Top Liquid Glass Header (Matches Approved Mobile Stitch) */}
      <header className="pt-safe fixed top-0 z-50 w-full border-b border-white/10 bg-[#060a14]/70 shadow-[0_1px_16px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:hidden">
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={openLocationModal}
              className="liquid-pill flex min-h-[38px] min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-left"
            >
              <LocationPinIcon size={16} className="shrink-0 text-primary" />
              <span className="max-w-[130px] truncate text-xs font-semibold text-white">
                {activeLocation ? activeLocation.name : "Choose City"}
              </span>
              <ChevronDownIcon
                size={14}
                className="shrink-0 text-on-surface-variant"
              />
            </button>

            <div
              className={`liquid-pill flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                headlineMeta
                  ? `${headlineMeta.badgeBorderClass} ${headlineMeta.textClass}`
                  : aqiLevel
                    ? `${aqiLevel.badgeBorderClass} ${aqiLevel.textClass}`
                    : "border-white/15 text-on-surface-variant"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  headlineMeta
                    ? `${headlineMeta.dotClass} animate-pulse`
                    : aqiLevel
                      ? `${aqiLevel.dotClass} animate-pulse`
                      : "bg-on-surface-variant/60"
                }`}
              />
              <span className="tabular-telemetry text-[11px] font-bold">
                {cpcbAqi
                  ? `CPCB ${cpcbAqi.value}`
                  : usAqi
                    ? `US ${usAqi.value}`
                    : aqiLevel
                      ? `OW ${aqiLevel.index}/5`
                      : "AQI --"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={openLocationModal}
              aria-label="Search worldwide cities"
              className="liquid-btn flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-white"
            >
              <SearchIcon size={18} />
            </button>
            <button
              type="button"
              onClick={refreshAirQuality}
              disabled={!activeLocation || airQualityStatus === "loading"}
              aria-label="Refresh telemetry"
              className="liquid-btn flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-white disabled:opacity-45"
            >
              <RefreshIcon
                size={18}
                className={airQualityStatus === "loading" ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Spatial Canvas */}
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pt-20 pb-28 focus:outline-none md:px-6 md:pt-36 md:pb-10 xl:pt-28"
      >
        {children}
      </main>

      {/* Desktop Liquid Glass Footer (Matches Stitch Footer) */}
      <footer className="relative z-10 hidden w-full pb-8 md:block">
        <div className="mx-auto max-w-7xl px-6">
          <div className="liquid-glass flex flex-col items-center justify-between gap-3 rounded-2xl p-4 lg:flex-row">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <WindIcon size={16} className="shrink-0 text-tertiary" />
              <span>
                US AQI (0–500 modeled) by{" "}
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white underline decoration-white/30 underline-offset-2 hover:text-primary"
                >
                  Open-Meteo.com
                </a>{" "}
                (CC BY 4.0 / CAMS) • Pollutants (µg/m³) &amp; 1–5 Index via{" "}
                <strong className="text-white">OpenWeather</strong>.
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-on-surface-variant">
              <Link
                href="/global-map"
                prefetch={false}
                className="rounded-full px-2.5 py-1 transition-colors hover:bg-white/10 hover:text-white"
              >
                Worldwide Search
              </Link>
              <Link
                href="/gemini-ai"
                prefetch={false}
                className="rounded-full px-2.5 py-1 transition-colors hover:bg-white/10 hover:text-white"
              >
                Gemini AI Advisor
              </Link>
              <Link
                href="/what-if-simulator"
                prefetch={false}
                className="rounded-full px-2.5 py-1 transition-colors hover:bg-white/10 hover:text-white"
              >
                What-If Simulator
              </Link>
              <button
                type="button"
                onClick={openLocationModal}
                className="rounded-full px-2.5 py-1 transition-colors hover:bg-white/10 hover:text-white"
              >
                Location Privacy
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Liquid Glass Bottom Navigation Dock (Matches Approved Mobile Stitch) */}
      <nav
        aria-label="Mobile navigation dock"
        className="pb-safe pointer-events-none fixed bottom-0 z-50 w-full md:hidden"
      >
        <div className="flex justify-center px-4 pt-1 pb-4">
          <div className="pointer-events-auto flex h-16 w-full max-w-md items-center justify-around rounded-full border border-white/20 bg-[#141c2f]/80 px-1.5 shadow-[0_20px_48px_-8px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.22)] backdrop-blur-3xl">
            {MOBILE_DOCK_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-12 min-w-[58px] flex-col items-center justify-center rounded-full px-2.5 transition-all duration-300 ${
                    isActive
                      ? "bg-white/15 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_4px_16px_rgba(56,189,248,0.22)]"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  {item.icon === "dash" && <DashboardIcon size={20} />}
                  {item.icon === "map" && <GlobeIcon size={20} />}
                  {item.icon === "insights" && <SparklesIcon size={20} />}
                  {item.icon === "routine" && <CalendarIcon size={20} />}
                  {item.icon === "rescue" && <ShieldIcon size={20} />}
                  <span className="tabular-telemetry mt-0.5 text-[10px] font-semibold">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* First-Visit & Anytime Liquid Glass Location Modal (Lazy-loaded on demand) */}
      {isLocationModalOpen && <LocationModal />}
    </div>
  );
}
