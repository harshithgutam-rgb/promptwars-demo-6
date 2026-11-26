import type { Metadata, Viewport } from "next";
import { LocationProvider } from "@/components/LocationContext";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AirWise AI — Liquid Glass Atmospheric Intelligence",
  description:
    "Real-time air pollution monitoring, worldwide city search, and atmospheric telemetry built with Next.js App Router for Prompt Wars Challenge 6.",
};

export const viewport: Viewport = {
  themeColor: "#060a14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="relative min-h-screen bg-[#060a14] text-on-surface antialiased selection:bg-primary/30 selection:text-white">
        {/* Volumetric Atmospheric Deep Midnight Navy + Specular Light Fields (GPU-friendly radial gradients matching Stitch optics) */}
        <div
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden contain-strict"
          aria-hidden="true"
        >
          <div
            className="glow-pulse absolute -top-48 left-1/4 h-[900px] w-[900px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(56,189,248,0.16) 0%, rgba(2,132,199,0.08) 38%, transparent 70%)",
            }}
          />
          <div
            className="absolute top-1/4 -right-40 h-[820px] w-[820px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(52,211,153,0.13) 0%, rgba(5,150,105,0.05) 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-24 left-1/5 h-[960px] w-[960px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(56,189,248,0.10) 0%, rgba(45,212,191,0.06) 40%, transparent 70%)",
            }}
          />
          {/* Optical Micro Sparkle Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />
        </div>

        <LocationProvider>
          <AppShell>{children}</AppShell>
        </LocationProvider>
      </body>
    </html>
  );
}
