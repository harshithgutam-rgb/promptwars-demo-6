import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  variant?: "card" | "vessel" | "bar" | "pill";
  interactive?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<GlassPanelProps["variant"]>, string> = {
  card: "liquid-glass rounded-2xl p-4 sm:p-5",
  vessel: "liquid-glass rounded-3xl p-5 sm:p-6",
  bar: "liquid-glass rounded-2xl p-4",
  pill: "liquid-pill rounded-full px-3.5 py-1.5",
};

export function GlassPanel({
  children,
  variant = "card",
  interactive = false,
  className = "",
}: GlassPanelProps) {
  return (
    <div
      className={`${VARIANT_CLASSES[variant]} ${
        interactive ? "liquid-glass-interactive" : ""
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}
