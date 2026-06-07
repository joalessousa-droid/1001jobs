import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: any;
    __lovableGoogleMapsResolved?: boolean;
    __initLovableMaps?: () => void;
  }
}

const SCRIPT_ID = "lovable-google-maps-script";
let loadPromise: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const browserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!browserKey) return Promise.reject(new Error("Google Maps key não configurada"));

  loadPromise = new Promise<void>((resolve, reject) => {
    window.__initLovableMaps = () => { window.__lovableGoogleMapsResolved = true; resolve(); };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.maps) resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&loading=async&callback=__initLovableMaps${channel ? `&channel=${channel}` : ""}`;
    s.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(s);
  });
  return loadPromise;
};

export const useGoogleMaps = () => {
  const [ready, setReady] = useState<boolean>(!!window.google?.maps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => { if (!cancelled) setReady(true); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  return { ready, error };
};

/**
 * Decode an encoded polyline (Google's algorithm).
 */
export const decodePolyline = (encoded: string): { lat: number; lng: number }[] => {
  let index = 0, lat = 0, lng = 0;
  const points: { lat: number; lng: number }[] = [];
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
};
