"use client";

import { memo } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  RunnerIcon,
  ShieldIcon,
  SlidersIcon,
  SparklesIcon,
  WindowIcon,
} from "@/components/Icons";

interface ModuleCardSpec {
  href: string;
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
  accent: "secondary" | "tertiary" | "primary";
  icon: "runner" | "window" | "shield";
}

const LIVE_MODULE_CARDS: ModuleCardSpec[] = [
  {
    href: "/daily-routine",
    badge: "Live • Gemini AI",
    title: "Daily Routine Planner",
    description:
      "Morning, afternoon, and evening outdoor, commute, exercise, and family guidance grounded in live OpenWeather conditions and 24-hour forecast data.",
    ctaLabel: "Open Daily Routine",
    accent: "secondary",
    icon: "runner",
  },
  {
    href: "/indoor-air-rescue",
    badge: "Live • Gemini AI",
    title: "Indoor Air Rescue",
    description:
      "Practical ventilation, filtration, cooking, cleaning, and budget-conscious indoor source-reduction advice tailored to your home setup.",
    ctaLabel: "Open Indoor Air Rescue",
    accent: "tertiary",
    icon: "window",
  },
  {
    href: "/gemini-ai",
    badge: "Live • Ask AirWise",
    title: "Gemini AI Advisor",
    description:
      "Ask AirWise personalized questions about today's verified OpenWeather AQI (1–5) and pollutant readings with transparent priority labels.",
    ctaLabel: "Open Gemini AI Advisor",
    accent: "primary",
    icon: "shield",
  },
];

const ACCENT_STYLES = {
  secondary: {
    iconWrap:
      "text-secondary border-secondary/30 shadow-[0_0_12px_rgba(78,222,163,0.28)]",
    badge: "text-secondary border-secondary/25",
    topLine: "via-secondary/70",
    ctaIcon: "text-secondary",
  },
  tertiary: {
    iconWrap:
      "text-tertiary border-tertiary/30 shadow-[0_0_12px_rgba(87,225,206,0.28)]",
    badge: "text-tertiary border-tertiary/25",
    topLine: "via-tertiary/70",
    ctaIcon: "text-tertiary",
  },
  primary: {
    iconWrap:
      "text-primary border-primary/30 shadow-[0_0_12px_rgba(56,189,248,0.28)]",
    badge: "text-primary border-primary/25",
    topLine: "via-primary/70",
    ctaIcon: "text-primary",
  },
} as const;

export const UpcomingModulesSection = memo(function UpcomingModulesSection() {
  return (
    <section
      aria-label="Gemini AI Atmospheric Recommendations and Modules"
      className="below-fold-section mb-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="liquid-pill flex h-8 w-8 items-center justify-center rounded-xl border border-primary/30 text-primary shadow-[0_0_12px_rgba(56,189,248,0.3)]">
            <SparklesIcon size={18} />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Gemini AI Atmospheric Intelligence
          </h2>
        </div>

        <Link
          href="/what-if-simulator"
          prefetch={false}
          className="liquid-btn tabular-telemetry inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-3.5 py-1.5 text-[11px] font-semibold tracking-wider text-primary uppercase hover:text-white"
        >
          <SlidersIcon size={14} />
          <span>What-If Simulator</span>
          <ArrowRightIcon size={13} />
        </Link>
      </div>

      {/* Triple Bento Liquid Glass Cards (Matches Approved Stitch Desktop & Mobile Layout) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {LIVE_MODULE_CARDS.map((card) => {
          const styles = ACCENT_STYLES[card.accent];
          return (
            <article
              key={card.href}
              className="liquid-glass liquid-glass-interactive relative flex flex-col justify-between overflow-hidden rounded-3xl p-5"
            >
              {/* Subtle Top Rim Glow Accent */}
              <div
                className={`pointer-events-none absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-transparent ${styles.topLine} to-transparent`}
              />

              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className={`liquid-pill flex h-9 w-9 items-center justify-center rounded-full border ${styles.iconWrap}`}
                  >
                    {card.icon === "runner" && <RunnerIcon size={19} />}
                    {card.icon === "window" && <WindowIcon size={19} />}
                    {card.icon === "shield" && <ShieldIcon size={19} />}
                  </span>
                  <span
                    className={`liquid-pill tabular-telemetry rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${styles.badge}`}
                  >
                    {card.badge}
                  </span>
                </div>

                <h3 className="mb-1.5 text-lg font-bold text-white">
                  {card.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-on-surface-variant">
                  {card.description}
                </p>
              </div>

              <div className="mt-4 pt-2">
                <Link
                  href={card.href}
                  prefetch={false}
                  className="liquid-btn flex min-h-[42px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-white"
                >
                  <span>{card.ctaLabel}</span>
                  <ArrowRightIcon size={15} className={styles.ctaIcon} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
});
