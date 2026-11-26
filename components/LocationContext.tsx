"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type AirQualityData,
  type AirQualityErrorResponse,
  type GeocodeApiResponse,
  type LocationPoint,
} from "@/lib/air-quality";

const STORAGE_ACTIVE_KEY = "airwise:active-location:v1";
const STORAGE_DETECTED_KEY = "airwise:detected-location:v1";
const STORAGE_SAVED_KEY = "airwise:saved-locations:v1";

export type AirQualityStatus =
  | "idle"
  | "loading"
  | "ready"
  | "missing_key"
  | "error";

export type GeolocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "timeout"
  | "unavailable"
  | "unsupported";

interface LocationContextValue {
  hydrated: boolean;
  activeLocation: LocationPoint | null;
  detectedLocation: LocationPoint | null;
  savedLocations: LocationPoint[];
  isLocationModalOpen: boolean;
  isFirstVisitModal: boolean;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  selectLocation: (location: Omit<LocationPoint, "savedAt">) => void;
  removeSavedLocation: (id: string) => void;
  geolocationStatus: GeolocationStatus;
  geolocationMessage: string | null;
  requestBrowserLocation: () => void;
  airQualityStatus: AirQualityStatus;
  airQualityData: AirQualityData | null;
  airQualityError: string | null;
  airQualityErrorCode: AirQualityErrorResponse["code"] | null;
  refreshAirQuality: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

function isValidStoredLocation(val: unknown): val is LocationPoint {
  if (!val || typeof val !== "object") return false;
  const item = val as Partial<LocationPoint>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.lat === "number" &&
    Number.isFinite(item.lat) &&
    typeof item.lon === "number" &&
    Number.isFinite(item.lon) &&
    (item.source === "geolocation" ||
      item.source === "search" ||
      item.source === "preset")
  );
}

function readStoredJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStoredJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [activeLocation, setActiveLocation] = useState<LocationPoint | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<LocationPoint | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationPoint[]>([]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isFirstVisitModal, setIsFirstVisitModal] = useState(false);

  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [geolocationMessage, setGeolocationMessage] = useState<string | null>(null);

  const [airQualityStatus, setAirQualityStatus] = useState<AirQualityStatus>("idle");
  const [airQualityData, setAirQualityData] = useState<AirQualityData | null>(null);
  const [airQualityError, setAirQualityError] = useState<string | null>(null);
  const [airQualityErrorCode, setAirQualityErrorCode] =
    useState<AirQualityErrorResponse["code"] | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Hydrate persisted locations on client mount; open onboarding modal on first visit
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedActive = readStoredJson<unknown>(STORAGE_ACTIVE_KEY);
      const storedDetected = readStoredJson<unknown>(STORAGE_DETECTED_KEY);
      const storedSaved = readStoredJson<unknown>(STORAGE_SAVED_KEY);

      if (isValidStoredLocation(storedDetected)) {
        setDetectedLocation(storedDetected);
      }
      if (Array.isArray(storedSaved)) {
        setSavedLocations(storedSaved.filter(isValidStoredLocation));
      }

      if (isValidStoredLocation(storedActive)) {
        setActiveLocation(storedActive);
        setIsFirstVisitModal(false);
        setIsLocationModalOpen(false);
      } else {
        setIsFirstVisitModal(true);
        setIsLocationModalOpen(true);
      }

      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut to open location search modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsLocationModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch real air quality data whenever activeLocation or refreshNonce changes
  useEffect(() => {
    if (!activeLocation) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    async function fetchTelemetry(location: LocationPoint) {
      setAirQualityStatus("loading");
      setAirQualityError(null);
      setAirQualityErrorCode(null);

      try {
        const params = new URLSearchParams({
          lat: location.lat.toFixed(4),
          lon: location.lon.toFixed(4),
        });
        if (refreshNonce > 0) {
          params.set("refresh", "1");
        }
        const res = await fetch(`/api/air-quality?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        const payload: unknown = await res.json();

        if (!res.ok) {
          const errPayload = payload as Partial<AirQualityErrorResponse>;
          const code = errPayload.code ?? "UPSTREAM_ERROR";
          const message =
            typeof errPayload.error === "string"
              ? errPayload.error
              : `Air quality service responded with status ${res.status}.`;
          setAirQualityData(null);
          setAirQualityError(message);
          setAirQualityErrorCode(code);
          setAirQualityStatus(code === "API_KEY_MISSING" ? "missing_key" : "error");
          return;
        }

        const data = payload as AirQualityData;
        if (
          !data ||
          typeof data.provider !== "string" ||
          !data.current ||
          typeof data.current.aqi !== "number"
        ) {
          setAirQualityData(null);
          setAirQualityError("Air quality response failed validation.");
          setAirQualityErrorCode("INVALID_UPSTREAM_RESPONSE");
          setAirQualityStatus("error");
          return;
        }

        setAirQualityData(data);
        setAirQualityStatus("ready");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setAirQualityData(null);
        setAirQualityError(
          "Could not connect to the AirWise air quality endpoint. Check your network connection and retry."
        );
        setAirQualityErrorCode("UPSTREAM_ERROR");
        setAirQualityStatus("error");
      }
    }

    void fetchTelemetry(activeLocation);

    return () => {
      controller.abort();
    };
  }, [activeLocation, refreshNonce]);

  const selectLocation = useCallback((locInput: Omit<LocationPoint, "savedAt">) => {
    const location: LocationPoint = {
      ...locInput,
      savedAt: new Date().toISOString(),
    };

    setActiveLocation(location);
    writeStoredJson(STORAGE_ACTIVE_KEY, location);

    if (location.source === "geolocation") {
      setDetectedLocation(location);
      writeStoredJson(STORAGE_DETECTED_KEY, location);
    } else {
      setSavedLocations((prev) => {
        const deduped = prev.filter(
          (item) =>
            item.id !== location.id &&
            !(
              Math.abs(item.lat - location.lat) < 0.02 &&
              Math.abs(item.lon - location.lon) < 0.02
            )
        );
        const next = [location, ...deduped].slice(0, 6);
        writeStoredJson(STORAGE_SAVED_KEY, next);
        return next;
      });
    }

    setIsFirstVisitModal(false);
    setIsLocationModalOpen(false);
  }, []);

  const removeSavedLocation = useCallback((id: string) => {
    setSavedLocations((prev) => {
      const next = prev.filter((item) => item.id !== id);
      writeStoredJson(STORAGE_SAVED_KEY, next);
      return next;
    });
  }, []);

  const requestBrowserLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeolocationStatus("unsupported");
      setGeolocationMessage(
        "Geolocation is not supported by this browser. Search any city worldwide below instead."
      );
      return;
    }

    setGeolocationStatus("requesting");
    setGeolocationMessage("Requesting coordinates from your browser…");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        let resolvedName = "Current Location";
        let resolvedRegion: string | undefined;
        let resolvedCountry: string | undefined;

        try {
          const res = await fetch(
            `/api/geocode?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
            { cache: "no-store" }
          );
          if (res.ok) {
            const geo = (await res.json()) as GeocodeApiResponse;
            const first = geo.results?.[0];
            if (first?.name) {
              resolvedName = first.name;
              resolvedRegion = first.region;
              resolvedCountry = first.country;
            }
          }
        } catch {
          // Keep clean fallback label if reverse geocoding fails
        }

        setGeolocationStatus("granted");
        setGeolocationMessage(null);

        selectLocation({
          id: `geo-${lat.toFixed(3)}-${lon.toFixed(3)}`,
          name: resolvedName,
          region: resolvedRegion,
          country: resolvedCountry,
          lat,
          lon,
          source: "geolocation",
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeolocationStatus("denied");
          setGeolocationMessage(
            "Location permission was denied. You can enable it in browser settings or search any worldwide city below."
          );
        } else if (error.code === error.TIMEOUT) {
          setGeolocationStatus("timeout");
          setGeolocationMessage(
            "Location lookup timed out. Please retry or select a city manually below."
          );
        } else {
          setGeolocationStatus("unavailable");
          setGeolocationMessage(
            "Your device could not determine a GPS position right now. Use worldwide city search below."
          );
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, [selectLocation]);

  const openLocationModal = useCallback(() => {
    setIsLocationModalOpen(true);
  }, []);

  const closeLocationModal = useCallback(() => {
    setIsLocationModalOpen(false);
    setIsFirstVisitModal(false);
  }, []);

  const refreshAirQuality = useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      hydrated,
      activeLocation,
      detectedLocation,
      savedLocations,
      isLocationModalOpen,
      isFirstVisitModal,
      openLocationModal,
      closeLocationModal,
      selectLocation,
      removeSavedLocation,
      geolocationStatus,
      geolocationMessage,
      requestBrowserLocation,
      airQualityStatus,
      airQualityData,
      airQualityError,
      airQualityErrorCode,
      refreshAirQuality,
    }),
    [
      hydrated,
      activeLocation,
      detectedLocation,
      savedLocations,
      isLocationModalOpen,
      isFirstVisitModal,
      openLocationModal,
      closeLocationModal,
      selectLocation,
      removeSavedLocation,
      geolocationStatus,
      geolocationMessage,
      requestBrowserLocation,
      airQualityStatus,
      airQualityData,
      airQualityError,
      airQualityErrorCode,
      refreshAirQuality,
    ]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocationContext must be used inside LocationProvider");
  }
  return ctx;
}
